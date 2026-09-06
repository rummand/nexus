import type { Proposal, ProposalType } from "../graph-types";
import { VERBS, type Verb } from "./definition";
import { normalise as norm, quotesFrom } from "./quote";

/**
 * What a model is allowed to claim about the graph.
 *
 * This is the plan-then-validate boundary again (§5.17), pointed at the model rather than at a
 * board script. The model proposes; nothing it says reaches the database. What comes back is
 * turned into the ordinary `Proposal` shape — the same one the hand-written rules produce, and the
 * same accept / dismiss queue — or it is thrown away with a reason a person can read.
 *
 * Three rules do the work:
 *
 * 1. **Only five changes exist.** setKind, renameKind, merge, setAttribute, addRelation. There is
 *    no verb for deleting an entity, editing a board, changing a grant or calling anything, so the
 *    worst a compromised or confused model can propose is a suggestion somebody has to click.
 * 2. **Every id must be real.** Ids are checked against the graph that was actually sent, so a
 *    hallucinated system cannot become a proposal about a system.
 * 3. **Every claim must quote the graph.** The model has to say which object it read and copy the
 *    words it read, and the words are checked against that object's own text. This is the same
 *    discipline intake applies to a transcript (§5.15), and it is what turns "the model thinks
 *    Maximo is an Application" into "the model read *work-order management system* on Maximo".
 *    An unquotable claim is dropped and reported as dropped.
 *
 * Everything here is pure, so the interesting half of the agent can be tested without a key.
 */

export interface AgentEntity {
  id: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
}

export interface AgentRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  kind: string;
}

export interface AgentGraph {
  entities: AgentEntity[];
  relations: AgentRelation[];
}

export interface AgentReview {
  proposals: Proposal[];
  /** Claims that were thrown away, and why. Surfaced to the person, never swallowed. */
  rejected: string[];
}

const MAX_PROPOSALS = 40;
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ids = (v: unknown, max = 8): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 60)).filter(Boolean).slice(0, max) : [];

/** Everything an entity says about itself — the only text a claim about it may quote. */
function textOf(e: AgentEntity): string {
  const attrs = Object.entries(e.attributes).map(([k, v]) => `${k} ${v}`).join(" ");
  return norm(`${e.kind} ${e.name} ${e.description} ${attrs}`);
}

/** Snap a value onto the vocabulary this workspace already uses, or keep it as a new one. */
function snap(value: string, options: string[]): { value: string; isNew: boolean } {
  const hit = options.find((o) => norm(o) === norm(value));
  return hit ? { value: hit, isNew: false } : { value, isNew: true };
}

/**
 * A model's confidence is an opinion about its own opinion, so it is capped rather than trusted.
 * "high" is reserved for the deterministic rules: those can be bulk-accepted, and a model's should
 * never be applied fifty at a time by somebody in a hurry.
 */
const confidenceOf = (v: unknown): "medium" | "low" => (v === "low" ? "low" : "medium");

/**
 * `allowed` is the verbs *this* agent was given (§5.32). Undefined means all five, which is what
 * the workspace's own reviewer gets. A proposal outside the list is rejected in the open, with the
 * reason said out loud, because an agent quietly dropping a third of its own answers is how a
 * definition's scope stops being believed.
 */
export function validateProposals(
  raw: unknown,
  graph: AgentGraph,
  decided: Set<string> = new Set(),
  allowed: readonly Verb[] = VERBS,
): AgentReview {
  const rejected: string[] = [];
  const out = new Map<string, Proposal>();
  if (!raw || typeof raw !== "object") return { proposals: [], rejected: ["the model returned nothing usable"] };

  const byId = new Map(graph.entities.map((e) => [e.id, e]));
  const textById = new Map(graph.entities.map((e) => [e.id, textOf(e)]));
  const kinds = [...new Set(graph.entities.map((e) => e.kind).filter(Boolean))];
  const relationKinds = [...new Set(graph.relations.map((r) => r.kind).filter(Boolean))];
  const attributeKeys = [...new Set(graph.entities.flatMap((e) => Object.keys(e.attributes)))];
  const wired = new Set(graph.relations.flatMap((r) => [`${r.fromEntityId}|${r.toEntityId}`, `${r.toEntityId}|${r.fromEntityId}`]));

  const list = (raw as { proposals?: unknown }).proposals;
  if (!Array.isArray(list)) return { proposals: [], rejected: ["the model returned no proposals"] };

  for (const item of list.slice(0, MAX_PROPOSALS)) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const change = str(p.change, 40);
    if ((VERBS as readonly string[]).includes(change) && !allowed.includes(change as Verb)) {
      rejected.push(`${change}: this agent may not propose that`);
      continue;
    }
    const why = str(p.why, 300);
    const quote = str(p.quote, 300);
    const readFrom = byId.get(str(p.readFrom, 60));
    const confidence = confidenceOf(p.confidence);
    const label = `${change || "a proposal"}${readFrom ? ` about ${readFrom.name}` : ""}`;

    if (!why) { rejected.push(`${label}: no reason given`); continue; }
    if (!readFrom) { rejected.push(`${label}: cited an object that is not in this graph`); continue; }
    if (!quotesFrom(textById.get(readFrom.id)!, quote)) {
      rejected.push(`${label}: quoted words that “${readFrom.name}” does not say`);
      continue;
    }
    const evidence = [`“${quote}” — read from ${readFrom.kind || "untyped"} · ${readFrom.name}`, why];

    const add = (proposal: Omit<Proposal, "source" | "confidence" | "evidence"> & { confidence?: Proposal["confidence"] }) => {
      if (decided.has(proposal.key) || out.has(proposal.key)) return;
      out.set(proposal.key, { ...proposal, confidence: proposal.confidence ?? confidence, evidence, source: "agent" });
    };

    switch (change) {
      case "setKind": {
        const target = byId.get(str(p.entityId, 60));
        if (!target) { rejected.push(`${label}: setKind names an object that is not in this graph`); continue; }
        const to = snap(str(p.to, 60), kinds);
        if (!to.value) { rejected.push(`${label}: setKind with no kind`); continue; }
        if (norm(to.value) === norm(target.kind)) { rejected.push(`${label}: “${target.name}” is already a ${target.kind}`); continue; }
        add({
          key: target.kind ? `agentkind:${target.id}=>${norm(to.value)}` : `untyped:${target.id}`,
          type: "untyped",
          title: target.kind ? `“${target.name}” looks like a ${to.value}, not a ${target.kind}` : `“${target.name}” has no kind`,
          detail: `${why}${to.isNew ? ` This would be a new kind — the workspace uses ${kinds.slice(0, 6).join(", ") || "none yet"}.` : ""}`,
          entityIds: [target.id],
          action: { kind: "setKind", entityId: target.id, to: to.value },
        });
        break;
      }

      case "renameKind": {
        const from = kinds.find((k) => norm(k) === norm(str(p.from, 60)));
        const to = str(p.to, 60);
        if (!from) { rejected.push(`${label}: renameKind names a kind this workspace does not use`); continue; }
        if (!to || norm(to) === norm(from)) { rejected.push(`${label}: renameKind to the same thing`); continue; }
        const touched = graph.entities.filter((e) => e.kind === from);
        add({
          key: `kind:${from}=>${to}`,
          type: "kind",
          title: `Kind “${from}” should be “${to}”`,
          detail: `${why} ${touched.length} object${touched.length === 1 ? "" : "s"} would be retyped.`,
          entityIds: touched.map((e) => e.id),
          action: { kind: "renameKind", from, to },
        });
        break;
      }

      case "merge": {
        const survivor = byId.get(str(p.survivorId, 60));
        const others = ids(p.otherIds).filter((id) => id !== survivor?.id && byId.has(id));
        if (!survivor) { rejected.push(`${label}: merge names a survivor that is not in this graph`); continue; }
        if (others.length === 0) { rejected.push(`${label}: merge with nothing to merge into “${survivor.name}”`); continue; }
        const all = [survivor.id, ...others].sort();
        add({
          key: `merge:${all.join(",")}`,
          type: "merge",
          title: `“${survivor.name}” and ${others.map((id) => `“${byId.get(id)!.name}”`).join(", ")} look like one thing`,
          detail: `${why} Merging keeps “${survivor.name}” and moves every relation and board onto it. This cannot be undone.`,
          entityIds: all,
          // Never "medium" by default for a merge: it is the one irreversible action here.
          confidence: "low",
          action: { kind: "merge", survivorId: survivor.id, otherIds: others },
        });
        break;
      }

      case "setAttribute": {
        const target = byId.get(str(p.entityId, 60));
        if (!target) { rejected.push(`${label}: setAttribute names an object that is not in this graph`); continue; }
        const key = snap(str(p.key, 60), attributeKeys).value;
        const value = str(p.to, 200);
        if (!key || !value) { rejected.push(`${label}: setAttribute with no key or no value`); continue; }
        const existing = Object.entries(target.attributes).find(([k]) => norm(k) === norm(key))?.[1] ?? "";
        // Filling a blank is a suggestion; overwriting an answer somebody gave is an argument, and
        // the agent does not get to have it here.
        if (existing.trim()) { rejected.push(`${label}: “${target.name}” already says ${key} is “${existing}”`); continue; }
        add({
          key: `attrmissing:${target.id}:${key}`,
          type: "attributeMissing",
          title: `${target.name} has no ${key}`,
          detail: `${why} Proposed value: “${value}”. Edit it before accepting if it is not right.`,
          entityIds: [target.id],
          action: { kind: "setAttribute", entityId: target.id, key, to: value },
        });
        break;
      }

      case "addRelation": {
        const from = byId.get(str(p.fromEntityId, 60));
        const to = byId.get(str(p.toEntityId, 60));
        if (!from || !to) { rejected.push(`${label}: addRelation names an object that is not in this graph`); continue; }
        if (from.id === to.id) { rejected.push(`${label}: a relation from “${from.name}” to itself`); continue; }
        if (wired.has(`${from.id}|${to.id}`)) { rejected.push(`${label}: “${from.name}” and “${to.name}” are already connected`); continue; }
        const kind = snap(str(p.relationKind, 60), relationKinds);
        if (!kind.value) { rejected.push(`${label}: addRelation with no relation type`); continue; }
        add({
          key: `agentrel:${from.id}|${norm(kind.value)}|${to.id}`,
          type: "newRelation",
          title: `${from.name} ${kind.value} ${to.name}`,
          detail: `${why}${kind.isNew ? ` “${kind.value}” would be a new relation type — the workspace uses ${relationKinds.slice(0, 6).join(", ") || "none yet"}.` : ""}`,
          entityIds: [from.id, to.id],
          action: { kind: "addRelation", fromEntityId: from.id, toEntityId: to.id, to: kind.value },
        });
        break;
      }

      default:
        rejected.push(`${label}: “${change}” is not something the agent can propose`);
    }
  }

  return { proposals: [...out.values()], rejected };
}

/** The proposal types a model may produce, for anything that has to switch on them. */
export const AGENT_TYPES: ProposalType[] = ["untyped", "kind", "merge", "attributeMissing", "newRelation"];
