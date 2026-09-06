"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { ensureReviewer } from "./definitions";
import { runDefinition } from "./run";
import { clearRun } from "./store";

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
  const db = await getDb();
  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  await clearRun(db, workspaceId);
  if (workspace) revalidatePath(`/w/${workspace.slug}/graph`);
}
