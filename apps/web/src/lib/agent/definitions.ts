import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import {
  DEFAULT_BUDGET,
  isGrounding,
  parseBudget,
  parseVerbs,
  STATUSES,
  VERBS,
  type Grounding,
  type AgentDefinition,
  type AgentStatus,
  type Budget,
  type Verb,
} from "./definition";

/**
 * Described agents, stored.
 *
 * Reading is deliberately generous — a row written by an older version of the code is repaired on
 * the way out rather than trusted or thrown away — because these rows outlive deploys and an agent
 * that vanishes from the fleet page because a column changed shape is worse than one with a
 * defaulted budget.
 */

export interface DefinitionSummary extends AgentDefinition {
  /** How it has done: runs, what it proposed, and what people did with that. */
  runs: number;
  lastRunAt: string | null;
  proposed: number;
  accepted: number;
  dismissed: number;
  /** Still waiting in the review queue. */
  open: number;
  /** The agent that suggested this one, when an agent did. */
  parentName: string;
}

export function toDefinition(row: s.AgentDefinitionRow, ownerTeamName = ""): AgentDefinition {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    purpose: row.purpose,
    ownerTeamId: row.ownerTeamId,
    ownerTeamName,
    scope: row.scope,
    verbs: parseVerbs(row.verbs),
    grounding: isGrounding(row.grounding) ? row.grounding : "",
    providerId: row.providerId,
    model: row.model,
    trigger: "manual",
    budget: parseBudget(row.budget),
    status: ((STATUSES as readonly string[]).includes(row.status) ? row.status : "draft") as AgentStatus,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function teamNames(db: Db, workspaceId: string): Promise<Map<string, string>> {
  const rows = await db.select().from(s.teams).where(eq(s.teams.workspaceId, workspaceId));
  return new Map(rows.map((t) => [t.id, t.name]));
}

export async function getDefinition(db: Db, agentId: string): Promise<AgentDefinition | null> {
  const row = await db.query.agentDefinitions.findFirst({ where: eq(s.agentDefinitions.id, agentId) });
  if (!row) return null;
  const names = await teamNames(db, row.workspaceId);
  return toDefinition(row, names.get(row.ownerTeamId ?? "") ?? "");
}

/** Every described agent in the workspace, with the numbers that say whether it earns its place. */
export async function listDefinitions(db: Db, workspaceId: string): Promise<DefinitionSummary[]> {
  const [rows, names, runs, decisions, open] = await Promise.all([
    db.select().from(s.agentDefinitions).where(eq(s.agentDefinitions.workspaceId, workspaceId)).orderBy(desc(s.agentDefinitions.createdAt)),
    teamNames(db, workspaceId),
    db.select().from(s.agentRuns).where(eq(s.agentRuns.workspaceId, workspaceId)),
    db.select().from(s.agentDecisions).where(eq(s.agentDecisions.workspaceId, workspaceId)),
    db.select().from(s.agentProposals).where(eq(s.agentProposals.workspaceId, workspaceId)),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return rows.map((row) => {
    const mine = runs.filter((r) => r.agentId === row.id);
    const decided = decisions.filter((d) => d.agentId === row.id);
    return {
      ...toDefinition(row, names.get(row.ownerTeamId ?? "") ?? ""),
      runs: mine.length,
      lastRunAt: mine.map((r) => r.createdAt).sort().at(-1) ?? null,
      // A dry run's proposals never reached anybody, so they are not counted as things it said.
      proposed: mine.filter((r) => !r.dryRun).reduce((n, r) => n + r.proposed, 0),
      accepted: decided.filter((d) => d.decision === "accepted").length,
      dismissed: decided.filter((d) => d.decision === "dismissed").length,
      open: open.filter((p) => p.agentId === row.id).length,
      parentName: byId.get(row.parentId ?? "") ?? "",
    };
  });
}

export interface StoredDefinition {
  name: string;
  purpose: string;
  ownerTeamId: string | null;
  scope: string;
  verbs: Verb[];
  grounding: Grounding;
  providerId: string | null;
  model: string;
  budget: Budget;
  status: AgentStatus;
}

export async function insertDefinition(db: Db, workspaceId: string, value: StoredDefinition, parentId: string | null = null): Promise<string> {
  const id = `agt_${nanoid(10)}`;
  const now = new Date().toISOString();
  await db.insert(s.agentDefinitions).values({
    id,
    workspaceId,
    name: value.name,
    purpose: value.purpose,
    ownerTeamId: value.ownerTeamId,
    scope: value.scope,
    verbs: JSON.stringify(value.verbs),
    grounding: value.grounding,
    providerId: value.providerId,
    model: value.model,
    trigger: "manual",
    budget: JSON.stringify(value.budget),
    status: value.status,
    parentId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function writeDefinition(db: Db, agentId: string, value: StoredDefinition) {
  await db
    .update(s.agentDefinitions)
    .set({
      name: value.name,
      purpose: value.purpose,
      ownerTeamId: value.ownerTeamId,
      scope: value.scope,
      verbs: JSON.stringify(value.verbs),
      grounding: value.grounding,
      providerId: value.providerId,
      model: value.model,
      budget: JSON.stringify(value.budget),
      status: value.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(s.agentDefinitions.id, agentId));
}

/**
 * The workspace's own reviewer.
 *
 * The graph agent (§5.26) existed before agents could be described, and the button that runs it is
 * on the Knowledge graph page where people already are. Rather than leave it outside the fleet —
 * one agent nobody owns, with no run log, invisible on the page that is supposed to list every
 * agent — it is created as an ordinary definition the first time it is needed. It differs from one
 * a person writes in exactly two ways: it is seeded active, and it reads the whole graph, which is
 * the job it has always had.
 */
export async function ensureReviewer(db: Db, workspaceId: string): Promise<AgentDefinition> {
  const existing = await db
    .select()
    .from(s.agentDefinitions)
    .where(and(eq(s.agentDefinitions.workspaceId, workspaceId), eq(s.agentDefinitions.name, REVIEWER_NAME)));
  const names = await teamNames(db, workspaceId);
  const first = existing[0];
  if (first) return toDefinition(first, names.get(first.ownerTeamId ?? "") ?? "");

  const teams = await db.select().from(s.teams).where(eq(s.teams.workspaceId, workspaceId));
  const id = await insertDefinition(db, workspaceId, {
    name: REVIEWER_NAME,
    purpose: "Read the whole model and say what is wrong with it: objects with no kind, one kind spelled two ways, the same thing recorded twice, an attribute the object's own words answer, a relation nobody has drawn.",
    ownerTeamId: teams[0]?.id ?? null,
    scope: "*",
    verbs: [...VERBS],
    grounding: "modelling",
    providerId: null,
    model: "",
    budget: { ...DEFAULT_BUDGET },
    status: "active",
  });
  const row = await db.query.agentDefinitions.findFirst({ where: eq(s.agentDefinitions.id, id) });
  return toDefinition(row!, names.get(teams[0]?.id ?? "") ?? "");
}

export const REVIEWER_NAME = "Model reviewer";

/** The runs of one agent, newest first. */
export async function runsFor(db: Db, agentId: string, limit = 20): Promise<s.AgentRunRow[]> {
  return db.select().from(s.agentRuns).where(eq(s.agentRuns.agentId, agentId)).orderBy(desc(s.agentRuns.createdAt)).limit(limit);
}

/** Every run in the workspace, newest first — the fleet's activity feed. */
export async function recentRuns(db: Db, workspaceId: string, limit = 25): Promise<s.AgentRunRow[]> {
  return db.select().from(s.agentRuns).where(eq(s.agentRuns.workspaceId, workspaceId)).orderBy(desc(s.agentRuns.createdAt)).limit(limit);
}

export async function deleteDefinition(db: Db, agentId: string) {
  // The runs go with it: they are its history, not the workspace's, and keeping orphans would put
  // rows in the activity feed that nothing can explain. What a person accepted stays in the graph.
  await db.delete(s.agentDefinitions).where(eq(s.agentDefinitions.id, agentId));
}

/** How many times this agent has run since midnight UTC, for the budget check. */
export async function runsToday(db: Db, agentId: string): Promise<number> {
  const rows = await db.select().from(s.agentRuns).where(eq(s.agentRuns.agentId, agentId));
  const day = new Date().toISOString().slice(0, 10);
  // A refused run never called a model, so it does not spend the budget it was refused by.
  return rows.filter((r) => r.createdAt.startsWith(day) && r.outcome !== "refused").length;
}

/** Which agent proposed the thing being decided, so the decision can be attributed. */
export async function agentForProposals(db: Db, workspaceId: string, keys: string[]): Promise<Map<string, string>> {
  if (!keys.length) return new Map();
  const rows = await db
    .select()
    .from(s.agentProposals)
    .where(and(eq(s.agentProposals.workspaceId, workspaceId), inArray(s.agentProposals.key, keys)));
  return new Map(rows.filter((r) => r.agentId).map((r) => [r.key, r.agentId!]));
}
