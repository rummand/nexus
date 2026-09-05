import type * as s from "@/db/schema";
import type { Proposal } from "./graph-types";

/**
 * Proposals drawn from evidence the graph already holds.
 *
 * Estate health names the gaps — fifty-odd systems with no owner, no lifecycle — and then offers a
 * bulk edit form, which is a scold with extra steps. But the answers are often already in the
 * graph: intake recorded who attended which meeting, who raised which action, and what each
 * viewpoint was about. These rules read that back out and propose the attribute, citing the
 * sentence that justifies it.
 *
 * Pure over rows, and every proposal carries its evidence, because an attribute set by an agent
 * that cannot say why is worse than a blank one — a blank at least tells the truth.
 */

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** Kinds intake writes as records of what was said, rather than parts of the estate. */
const SOURCE_KINDS = new Set(["meeting", "document", "dataset", "sync"]);
const VIEWPOINT_KINDS = new Set(["decision", "action", "risk", "question", "need"]);
const SYSTEM_KINDS = new Set(["application", "system", "platform", "it component", "service", "database", "integration", "interface"]);

/** Phrases in a risk or decision that state where a system is in its life. */
const LIFECYCLE_PHRASES: Array<[RegExp, string]> = [
  [/\bout of support\b|\bend of life\b|\bunsupported\b|\bno longer supported\b/i, "end of life"],
  [/\bwill be (?:replaced|decommissioned|retired)\b|\bdecided to replace\b|\bphase (?:it )?out\b/i, "phasing out"],
  [/\bwe are (?:rolling out|introducing|adopting)\b|\bgoing live\b|\bin pilot\b/i, "emerging"],
];

interface Graph {
  entities: s.Entity[];
  relations: s.Relation[];
  attributesOf: (id: string) => Record<string, string>;
  decided: Set<string>;
}

const has = (attrs: Record<string, string>, key: string) =>
  Object.entries(attrs).some(([k, v]) => norm(k) === key && v.trim());

/**
 * Ownership, from who did the work.
 *
 * A person who raised an action about a system is the best available candidate for owning it —
 * far better than the fact they sat in the meeting. Attendance alone is only used when a single
 * person attended a source that mentions the system, which is a weak signal and says so.
 */
export function ownershipProposals({ entities, relations, attributesOf, decided }: Graph): Proposal[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const out: Proposal[] = [];

  const isPerson = (id: string) => norm(byId.get(id)?.kind ?? "") === "person";
  const isViewpoint = (id: string) => VIEWPOINT_KINDS.has(norm(byId.get(id)?.kind ?? ""));
  const isSource = (id: string) => SOURCE_KINDS.has(norm(byId.get(id)?.kind ?? ""));

  // person → raised → viewpoint → about → system
  const raisedBy = new Map<string, Set<string>>();     // viewpoint id → person ids
  const aboutOf = new Map<string, Set<string>>();      // viewpoint id → entity ids
  const attendedBy = new Map<string, Set<string>>();   // source id → person ids
  const mentionedBy = new Map<string, Set<string>>();  // entity id → source ids

  for (const r of relations) {
    if (norm(r.kind) === "raised" && isPerson(r.fromEntityId) && isViewpoint(r.toEntityId)) {
      raisedBy.set(r.toEntityId, (raisedBy.get(r.toEntityId) ?? new Set()).add(r.fromEntityId));
    }
    if (norm(r.kind) === "about" && isViewpoint(r.fromEntityId)) {
      aboutOf.set(r.fromEntityId, (aboutOf.get(r.fromEntityId) ?? new Set()).add(r.toEntityId));
    }
    if (norm(r.kind) === "attended" && isPerson(r.fromEntityId) && isSource(r.toEntityId)) {
      attendedBy.set(r.toEntityId, (attendedBy.get(r.toEntityId) ?? new Set()).add(r.fromEntityId));
    }
    if (norm(r.kind) === "mentions" && isSource(r.fromEntityId)) {
      mentionedBy.set(r.toEntityId, (mentionedBy.get(r.toEntityId) ?? new Set()).add(r.fromEntityId));
    }
  }

  /** entity id → the people who took action about it, and what the action was */
  const actors = new Map<string, Array<{ person: s.Entity; viewpoint: s.Entity }>>();
  for (const [viewpointId, targets] of aboutOf) {
    const viewpoint = byId.get(viewpointId);
    const people = raisedBy.get(viewpointId);
    if (!viewpoint || !people) continue;
    // An action or a decision is a claim on the thing; a question is not.
    if (!["action", "decision", "need"].includes(norm(viewpoint.kind))) continue;
    for (const target of targets) {
      for (const personId of people) {
        const person = byId.get(personId);
        if (!person) continue;
        actors.set(target, [...(actors.get(target) ?? []), { person, viewpoint }]);
      }
    }
  }

  for (const entity of entities) {
    if (!SYSTEM_KINDS.has(norm(entity.kind))) continue;
    if (has(attributesOf(entity.id), "owner")) continue;

    const claims = actors.get(entity.id) ?? [];
    const names = [...new Set(claims.map((c) => c.person.name))];
    if (names.length === 1) {
      const claim = claims[0]!;
      const key = `owner:${entity.id}=${norm(names[0]!)}`;
      if (decided.has(key)) continue;
      out.push({
        key,
        type: "attributeMissing",
        confidence: "medium",
        title: `${entity.name} has no owner — ${names[0]} acted on it`,
        detail: `${names[0]} raised ${norm(claim.viewpoint.kind) === "action" ? "an action" : `a ${norm(claim.viewpoint.kind)}`} about ${entity.name}, and nothing else claims it. Set them as the owner, or correct it.`,
        entityIds: [entity.id, claim.person.id],
        action: { kind: "setAttribute", entityId: entity.id, key: "owner", to: names[0]! },
        evidence: [claim.viewpoint.name],
      });
      continue;
    }

    // Nobody acted on it, but exactly one person was in the only source that mentions it.
    const sources = [...(mentionedBy.get(entity.id) ?? [])];
    if (sources.length !== 1) continue;
    const attendees = [...(attendedBy.get(sources[0]!) ?? [])].map((id) => byId.get(id)).filter((p): p is s.Entity => !!p);
    if (attendees.length !== 1) continue;
    const key = `owner:${entity.id}=${norm(attendees[0]!.name)}`;
    if (decided.has(key)) continue;
    out.push({
      key,
      type: "attributeMissing",
      confidence: "low",
      title: `${entity.name} has no owner — only ${attendees[0]!.name} has discussed it`,
      detail: `${entity.name} appears in one source, “${byId.get(sources[0]!)?.name}”, and ${attendees[0]!.name} was the only person in it. Weak evidence: being present is not owning.`,
      entityIds: [entity.id, attendees[0]!.id],
      action: { kind: "setAttribute", entityId: entity.id, key: "owner", to: attendees[0]!.name },
      evidence: [byId.get(sources[0]!)?.name ?? ""],
    });
  }

  return out;
}

/** Lifecycle, from what people said about the system. */
export function lifecycleProposals({ entities, relations, attributesOf, decided }: Graph): Proposal[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const out: Proposal[] = [];
  const seen = new Set<string>();

  for (const r of relations) {
    if (norm(r.kind) !== "about") continue;
    const viewpoint = byId.get(r.fromEntityId);
    const target = byId.get(r.toEntityId);
    if (!viewpoint || !target) continue;
    if (!VIEWPOINT_KINDS.has(norm(viewpoint.kind))) continue;
    if (!SYSTEM_KINDS.has(norm(target.kind))) continue;
    if (has(attributesOf(target.id), "lifecycle")) continue;

    const said = `${viewpoint.name} ${viewpoint.description}`;
    const matched = LIFECYCLE_PHRASES.find(([re]) => re.test(said));
    if (!matched) continue;
    const key = `lifecycle:${target.id}=${matched[1]}`;
    if (decided.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      type: "attributeMissing",
      confidence: "medium",
      title: `${target.name} has no lifecycle — it was called “${matched[1]}”`,
      detail: `A ${norm(viewpoint.kind)} about ${target.name} says so. Setting it makes the estate answer "what is ending?" without anyone typing it in.`,
      entityIds: [target.id],
      action: { kind: "setAttribute", entityId: target.id, key: "lifecycle", to: matched[1] },
      evidence: [viewpoint.description || viewpoint.name],
    });
  }

  return out;
}

/** Everything the evidence supports, strongest first. */
export function evidenceProposals(graph: Graph): Proposal[] {
  const rank = { high: 3, medium: 2, low: 1 };
  return [...ownershipProposals(graph), ...lifecycleProposals(graph)]
    .sort((a, b) => rank[b.confidence] - rank[a.confidence] || a.title.localeCompare(b.title));
}
