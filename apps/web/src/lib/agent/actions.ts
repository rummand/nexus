"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { ensureReviewer } from "./definitions";
import { runDefinition } from "./run";
import { clearRun, storedProposals } from "./store";
import { nanoid } from "nanoid";
import { currentUser } from "@/lib/session";
import { agentBranchName, agentBranchWords, changesFromProposals } from "./branch";

/**
 * Asking the agent to look at the model.
 *
 * Deliberately a button rather than something that happens on page load: it costs money, it takes
 * a second or two, and an agent that runs unbidden every time somebody opens a page is an agent
 * people learn to resent.
 *
 * Since agents became describable (§5.32) this button no longer runs a hand-written module. It runs
 * the workspace's own **Model reviewer** — an ordinary definition, created the first time it is
 * needed, owned by a team, listed in the fleet and logged like every other agent. The button is the
 * same; what it starts is now something a person can read, budget and switch off.
 */

export interface AgentRunResult {
  proposed: number;
  rejected: string[];
  grounded: string[];
  note: string;
  sampled: boolean;
}

export async function askTheAgent(workspaceId: string): Promise<AgentRunResult | { error: string }> {
  const no = await deny(workspaceId, "agent.run");
  if (no) return no;
  const db = await getDb();
  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  if (!workspace) return { error: "That workspace is gone." };

  const reviewer = await ensureReviewer(db, workspaceId);
  const result = await runDefinition(db, workspaceId, reviewer.id);
  if ("error" in result) return result;
  if (result.outcome === "failed") return { error: result.error ?? "the model could not be reached" };
  // A refusal is a real answer — the budget is spent, the agent is paused — and reads better as a
  // sentence than as an empty run.
  if (result.outcome === "refused") return { error: result.note };

  revalidatePath(`/w/${workspace.slug}/graph`);
  revalidatePath(`/w/${workspace.slug}/agents`);
  return { proposed: result.proposed, rejected: result.rejected, grounded: result.grounded, note: result.note, sampled: result.sampled };
}

/** Throw the run away without deciding on any of it. */
export async function forgetAgentRun(workspaceId: string) {
  const no = await deny(workspaceId, "agent.run");
  if (no) return no;
  const db = await getDb();
  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  await clearRun(db, workspaceId);
  if (workspace) revalidatePath(`/w/${workspace.slug}/graph`);
}

/**
 * Put an agent's open proposals on a branch of its own (#141, §5.96).
 *
 * Guarded by `agent.run` rather than `graph.edit`: this writes nothing to the estate — it writes
 * a branch nobody has merged — and the power it actually exercises is "let this agent work",
 * which is the one the fleet is already governed by.
 *
 * Proposals that cannot be expressed as changes are left exactly where they are, and the caller
 * is told how many and why. An agent's finding disappearing because the branch could not hold it
 * would be the worst of both mechanisms.
 */
export async function branchFromProposals(workspaceId: string, agentName?: string): Promise<
  { ok: true; changeSetId: string; changes: number; left: Array<{ key: string; title: string; why: string }>; words: string } | { error: string }
> {
  const no = await deny(workspaceId, "agent.run");
  if (no) return no;

  const db = await getDb();
  const user = await currentUser();
  // Anything somebody has already accepted or dismissed is not open, so it does not go on.
  const decisions = await db.select({ key: s.agentDecisions.key }).from(s.agentDecisions).where(eq(s.agentDecisions.workspaceId, workspaceId));
  const all = await storedProposals(db, workspaceId, new Set(decisions.map((d) => d.key)));
  // By name, which is what a proposal carries and what a reviewer reads. An agent renamed
  // between runs starts a new branch, which is the honest outcome: it is a different agent now.
  const proposals = agentName ? all.filter((p) => p.agentName === agentName) : all;
  if (!proposals.length) return { error: "There is nothing open to put on a branch." };

  const entities = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const carried = changesFromProposals(proposals, entities);
  if (!carried.changes.length) {
    return { error: `None of those ${proposals.length} findings can be written as changes. ${carried.left[0]?.why ?? ""}`.trim() };
  }

  const named = agentName || "The fleet";
  const definition = agentName
    ? await db.query.agentDefinitions.findFirst({ where: and(eq(s.agentDefinitions.workspaceId, workspaceId), eq(s.agentDefinitions.name, agentName)) })
    : null;
  const changeSetId = `chg_${nanoid(10)}`;
  const at = new Date();
  await db.insert(s.changeSets).values({
    id: changeSetId,
    workspaceId,
    name: agentBranchName(named, at),
    description: agentBranchWords(named, carried.changes.length, carried.left.length),
    targetDate: "",
    status: "draft",
    agentId: definition?.id ?? null,
    createdById: user.id,
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
  });
  await db.insert(s.changes).values(carried.changes.map((change) => ({
    id: `chn_${nanoid(10)}`,
    changeSetId,
    op: change.op,
    entityId: change.entityId,
    relationId: change.relationId,
    payload: JSON.stringify(change.payload),
    note: change.note,
    createdAt: at.toISOString(),
  })));

  revalidatePath("/", "layout");
  return {
    ok: true,
    changeSetId,
    changes: carried.changes.length,
    left: carried.left,
    words: agentBranchWords(named, carried.changes.length, carried.left.length),
  };
}

