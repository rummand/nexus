import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { choose, configured, whyNoModel } from "@/lib/models/resolve";
import { open } from "@/lib/models/secret";
import { DEFAULT_BASE, type ModelChoice } from "@/lib/models/types";
import { parseAttributes } from "../graph";
import { runQuery } from "../query";
import type { AgentDefinition } from "./definition";
import { getDefinition, runsToday } from "./definitions";
import { proposeWithModel } from "./propose";
import { saveRun } from "./store";
import type { AgentGraph } from "./validate";

/**
 * Running a described agent.
 *
 * Three things happen here that did not happen when the agent was a hand-written module, and each
 * one is the difference between an agent and a governed agent.
 *
 * **It reads only its scope.** The definition's query decides what goes into the prompt. An agent
 * for the OT estate cannot comment on finance systems, not because it was asked not to but because
 * it was never shown them.
 *
 * **It is refused before it costs anything.** A paused agent, a retired one, one that has used up
 * its runs for the day — all stop here, with a row in the log saying so, before a model is called.
 *
 * **It is written down.** Every run leaves a row: what it read, what it proposed, what validation
 * threw away and why, what the model said for itself. That log is the only thing that can later
 * answer whether the agent is worth having.
 *
 * A **draft** agent runs as a dry run: the proposals are kept on the run and never reach the review
 * queue. That is what lets a person read an agent's first opinions before granting it a voice, the
 * way they would with a new colleague.
 */

export interface RunOutcome {
  runId: string;
  outcome: "ok" | "failed" | "refused";
  dryRun: boolean;
  proposed: number;
  rejected: string[];
  grounded: string[];
  note: string;
  objectsRead: number;
  /** True when the scope was too big to send whole and had to be trimmed. */
  sampled: boolean;
  error?: string;
}

/** The whole model. An explicit choice a person has to write, not a default. */
const EVERYTHING = new Set(["*", "all", "everything"]);

/**
 * What this agent may read.
 *
 * Relations are kept only where both ends are in scope: a relation with one end outside would put
 * the name of an object the agent may not read into its prompt, which is the sort of leak that is
 * obvious once written down and invisible otherwise.
 */
export async function scopedGraph(db: Db, workspaceId: string, scope: string): Promise<AgentGraph> {
  const [entities, relations] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
  ]);

  let keep = new Set(entities.map((e) => e.id));
  if (!EVERYTHING.has(scope.trim().toLowerCase())) {
    const found = await runQuery(db, workspaceId, scope, 2000);
    keep = new Set(found.entities.map((e) => e.id));
  }

  return {
    entities: entities
      .filter((e) => keep.has(e.id))
      .map((e) => ({ id: e.id, kind: e.kind, name: e.name, description: e.description, attributes: parseAttributes(e.attributes) })),
    relations: relations
      .filter((r) => keep.has(r.fromEntityId) && keep.has(r.toEntityId))
      .map((r) => ({ id: r.id, fromEntityId: r.fromEntityId, toEntityId: r.toEntityId, kind: r.kind })),
  };
}

async function record(db: Db, workspaceId: string, agent: AgentDefinition, row: Partial<s.AgentRunRow>, id = `run_${nanoid(10)}`): Promise<string> {
  await db.insert(s.agentRuns).values({
    id,
    workspaceId,
    agentId: agent.id,
    agentName: agent.name,
    trigger: "manual",
    outcome: "ok",
    scope: agent.scope,
    createdAt: new Date().toISOString(),
    ...row,
  });
  return id;
}

/**
 * Which model this agent thinks with: its own provider, or whatever the graph-agent job is set to
 * (§5.31). A provider that has been deleted or disabled since the agent was written falls back
 * rather than failing — the agent's job is not to be the place a model outage is discovered.
 */
async function modelFor(db: Db, workspaceId: string, agent: AgentDefinition): Promise<ModelChoice | null> {
  const fallback = await choose(db, workspaceId, "graph agent");
  if (!agent.providerId) return fallback;
  const row = await db.query.modelProviders.findFirst({ where: eq(s.modelProviders.id, agent.providerId) });
  if (!row || !row.enabled) return fallback;
  const apiKey = open(row.apiKey);
  if (row.apiKey && !apiKey) return null;
  const model = (agent.model || row.model).trim();
  if (!model) return fallback;
  return { dialect: row.dialect, baseUrl: row.baseUrl.trim() || DEFAULT_BASE[row.dialect], apiKey, model, from: "provider", providerName: row.name };
}

export async function runDefinition(db: Db, workspaceId: string, agentId: string): Promise<RunOutcome | { error: string }> {
  const agent = await getDefinition(db, agentId);
  if (!agent || agent.workspaceId !== workspaceId) return { error: "That agent is gone." };

  const refuse = async (why: string): Promise<RunOutcome> => {
    const runId = await record(db, workspaceId, agent, { outcome: "refused", detail: JSON.stringify([why]), note: why });
    return { runId, outcome: "refused", dryRun: agent.status === "draft", proposed: 0, rejected: [why], grounded: [], note: why, objectsRead: 0, sampled: false };
  };

  if (agent.status === "proposed") return refuse("Nobody has approved this agent yet. An agent suggested it; a person decides whether it exists.");
  if (agent.status === "paused") return refuse("This agent is paused, so it did not run.");
  if (agent.status === "retired") return refuse("This agent is retired. Bring it back to draft to run it again.");
  if (!agent.verbs.length) return refuse("This agent has nothing it is allowed to propose.");

  const today = await runsToday(db, agent.id);
  if (today >= agent.budget.runsPerDay) {
    return refuse(`Its budget is ${agent.budget.runsPerDay} run${agent.budget.runsPerDay === 1 ? "" : "s"} a day and it has used them. Raise the budget or wait.`);
  }

  const choice = await modelFor(db, workspaceId, agent);
  if (!choice) {
    const rows = await db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspaceId));
    return { error: whyNoModel(await configured(db, workspaceId), rows, "graph agent") };
  }

  const graph = await scopedGraph(db, workspaceId, agent.scope);
  if (graph.entities.length === 0) {
    return refuse(`Nothing in the model matches this agent's scope (${agent.scope}), so there was nothing to read.`);
  }

  const decisions = await db.select().from(s.agentDecisions).where(eq(s.agentDecisions.workspaceId, workspaceId));
  const decided = new Set(decisions.map((d) => d.key));

  const started = Date.now();
  let run;
  try {
    run = await proposeWithModel(graph, choice, decided, {
      verbs: agent.verbs,
      purpose: agent.purpose,
      maxProposals: agent.budget.maxProposals,
      grounding: agent.grounding,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "the model could not be reached";
    const runId = await record(db, workspaceId, agent, {
      outcome: "failed",
      objectsRead: graph.entities.length,
      error: message,
      model: choice.model,
      ms: Date.now() - started,
    });
    return { runId, outcome: "failed", dryRun: false, proposed: 0, rejected: [], grounded: [], note: "", objectsRead: graph.entities.length, sampled: false, error: message };
  }

  const dryRun = agent.status === "draft";
  // The id is minted here rather than by the insert, so the queued proposals can name the run that
  // produced them before the run itself is written.
  const runId = `run_${nanoid(10)}`;
  if (!dryRun) await saveRun(db, workspaceId, run, { agentId: agent.id, runId });

  await record(db, workspaceId, agent, {
    outcome: "ok",
    dryRun,
    objectsRead: graph.entities.length,
    proposed: run.proposals.length,
    rejected: run.rejected.length,
    detail: JSON.stringify(run.rejected.slice(0, 40)),
    proposals: JSON.stringify(run.proposals.map((p) => ({ title: p.title, detail: p.detail, evidence: p.evidence ?? [], confidence: p.confidence }))),
    note: run.note,
    model: choice.model,
    ms: Date.now() - started,
  }, runId);

  return {
    runId,
    outcome: "ok",
    dryRun,
    proposed: run.proposals.length,
    rejected: run.rejected,
    grounded: run.grounded,
    note: run.note,
    objectsRead: graph.entities.length,
    sampled: run.sampled,
  };
}
