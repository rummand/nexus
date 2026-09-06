import { and, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "../graph";
import type { Proposal, ProposalAction } from "../graph-types";
import type { AgentGraph } from "./validate";
import type { AgentRun } from "./propose";

/**
 * Keeping what the agent said.
 *
 * The hand-written rules are recomputed on every page load because they are cheap and always give
 * the same answer. A model is neither: asking costs money and a second or two, and asking twice
 * gives two different answers. So a run is written down and reviewed at leisure, and a re-run
 * replaces it — the agent has one current opinion about the graph, not a growing pile of them.
 */

/** The graph as the agent sees it: plain rows, attributes already parsed. */
export async function agentGraph(db: Db, workspaceId: string): Promise<AgentGraph> {
  const [entities, relations] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
  ]);
  return {
    entities: entities.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      description: e.description,
      attributes: parseAttributes(e.attributes),
    })),
    relations: relations.map((r) => ({ id: r.id, fromEntityId: r.fromEntityId, toEntityId: r.toEntityId, kind: r.kind })),
  };
}

/**
 * Replace this agent's stored run with a new one.
 *
 * Each agent has one current opinion, not a growing pile — but only its own. Before agents could be
 * described there was one agent and one queue, and replacing the queue was the same thing as
 * replacing the run; with a fleet, wiping the workspace's proposals because a second agent ran
 * would throw away the first agent's unreviewed work.
 */
export async function saveRun(db: Db, workspaceId: string, run: AgentRun, from: { agentId?: string | null; runId?: string | null } = {}): Promise<number> {
  const agentId = from.agentId ?? null;
  await db.delete(s.agentProposals).where(
    agentId
      ? and(eq(s.agentProposals.workspaceId, workspaceId), eq(s.agentProposals.agentId, agentId))
      : and(eq(s.agentProposals.workspaceId, workspaceId), isNull(s.agentProposals.agentId)),
  );
  if (run.proposals.length === 0) return 0;
  await db.insert(s.agentProposals).values(
    run.proposals.map((p) => ({
      id: `agp_${nanoid(10)}`,
      workspaceId,
      agentId,
      runId: from.runId ?? null,
      key: p.key,
      type: p.type,
      confidence: p.confidence,
      title: p.title,
      detail: p.detail,
      entityIds: JSON.stringify(p.entityIds),
      action: JSON.stringify(p.action),
      evidence: JSON.stringify(p.evidence ?? []),
      grounded: JSON.stringify(run.grounded),
    })),
  );
  return run.proposals.length;
}

const parseArray = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/**
 * A stored row is JSON written by a version of the code that may no longer exist, so the action is
 * parsed defensively here: a row whose action is not one of the five the agent may propose is
 * dropped rather than trusted, which is the same boundary as validation, enforced again on the way
 * back out.
 */
const ALLOWED: ReadonlySet<ProposalAction["kind"]> = new Set(["setKind", "renameKind", "merge", "setAttribute", "addRelation"]);

function parseAction(raw: string): ProposalAction | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const kind = (v as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !ALLOWED.has(kind as ProposalAction["kind"])) return null;
    return v as ProposalAction;
  } catch {
    return null;
  }
}

export async function storedProposals(db: Db, workspaceId: string, decided: Set<string>): Promise<Proposal[]> {
  const [rows, agents] = await Promise.all([
    db.select().from(s.agentProposals).where(eq(s.agentProposals.workspaceId, workspaceId)).orderBy(desc(s.agentProposals.createdAt)),
    db.select().from(s.agentDefinitions).where(eq(s.agentDefinitions.workspaceId, workspaceId)),
  ]);
  // Which agent said it. A reviewer deciding on a suggestion is entitled to know whose judgement
  // they are reading, and it is the thing that makes an agent's acceptance rate legible later.
  const named = new Map(agents.map((a) => [a.id, a.name]));
  const out: Proposal[] = [];
  for (const row of rows) {
    if (decided.has(row.key)) continue;
    const action = parseAction(row.action);
    if (!action) continue;
    out.push({
      key: row.key,
      type: row.type as Proposal["type"],
      confidence: row.confidence,
      title: row.title,
      detail: row.detail,
      entityIds: parseArray(row.entityIds),
      action,
      evidence: parseArray(row.evidence),
      grounded: parseArray(row.grounded),
      source: "agent",
      agentName: named.get(row.agentId ?? "") ?? "",
    });
  }
  return out;
}

/** Once somebody has decided, the row has done its job; the decision is remembered elsewhere. */
export async function forgetProposal(db: Db, workspaceId: string, key: string) {
  await db.delete(s.agentProposals).where(and(eq(s.agentProposals.workspaceId, workspaceId), eq(s.agentProposals.key, key)));
}

export async function clearRun(db: Db, workspaceId: string) {
  await db.delete(s.agentProposals).where(eq(s.agentProposals.workspaceId, workspaceId));
}

/** When the agent last looked, and what it was grounded in, for the panel's header. */
export async function lastRun(db: Db, workspaceId: string): Promise<{ at: string; grounded: string[] } | null> {
  const row = await db
    .select()
    .from(s.agentProposals)
    .where(eq(s.agentProposals.workspaceId, workspaceId))
    .orderBy(desc(s.agentProposals.createdAt))
    .limit(1);
  const first = row[0];
  return first ? { at: first.createdAt, grounded: parseArray(first.grounded) } : null;
}
