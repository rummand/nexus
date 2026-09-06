"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { modelConfigured, modelStatus, proposeWithModel } from "./propose";
import { agentGraph, clearRun, saveRun } from "./store";

/**
 * Asking the agent to look at the model.
 *
 * Deliberately a button rather than something that happens on page load: it costs money, it takes
 * a second or two, and an agent that runs unbidden every time somebody opens a page is an agent
 * people learn to resent. The result replaces the previous run.
 */

export interface AgentRunResult {
  proposed: number;
  rejected: string[];
  grounded: string[];
  note: string;
  sampled: boolean;
}

export async function askTheAgent(workspaceId: string): Promise<AgentRunResult | { error: string }> {
  if (!modelConfigured()) return { error: modelStatus() || "No model is configured." };
  const db = await getDb();
  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  if (!workspace) return { error: "That workspace is gone." };

  const graph = await agentGraph(db, workspaceId);
  if (graph.entities.length === 0) return { error: "There is nothing in the graph for the agent to read yet." };

  const decisions = await db.select().from(s.agentDecisions).where(eq(s.agentDecisions.workspaceId, workspaceId));
  const decided = new Set(decisions.map((d) => d.key));

  let run;
  try {
    run = await proposeWithModel(graph, decided);
  } catch (error) {
    // Configuration and transport trouble is the person's to see, not something to swallow into
    // "no proposals" — which would read as "your graph is fine".
    return { error: error instanceof Error ? error.message : "the model could not be reached" };
  }

  const proposed = await saveRun(db, workspaceId, run);
  revalidatePath(`/w/${workspace.slug}/graph`);
  return { proposed, rejected: run.rejected, grounded: run.grounded, note: run.note, sampled: run.sampled };
}

/** Throw the run away without deciding on any of it. */
export async function forgetAgentRun(workspaceId: string) {
  const db = await getDb();
  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  await clearRun(db, workspaceId);
  if (workspace) revalidatePath(`/w/${workspace.slug}/graph`);
}
