"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { runQuery } from "@/lib/query";
import { checkDefinition, type DefinitionInput, type Verb } from "./definition";
import { deleteDefinition, getDefinition, insertDefinition, writeDefinition } from "./definitions";
import { runDefinition } from "./run";

/**
 * Writing an agent down, and running it.
 *
 * Every one of these takes the definition through the same check (`checkDefinition`) whoever is
 * asking — a person filling in the form, or later an agent proposing an agent. That is deliberate:
 * the rules about scope, owners, verbs and budgets are the fleet's, not the form's, and a second
 * path that skipped them would be the hole everything else is protecting.
 */

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

async function refresh(workspaceId: string, agentId?: string) {
  const slug = await slugOf(workspaceId);
  if (!slug) return;
  revalidatePath(`/w/${slug}/agents`);
  if (agentId) revalidatePath(`/w/${slug}/agents/${agentId}`);
  revalidatePath(`/w/${slug}/graph`);
}

async function context(workspaceId: string) {
  const db = await getDb();
  const [teams, providers] = await Promise.all([
    db.select().from(s.teams).where(eq(s.teams.workspaceId, workspaceId)),
    db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspaceId)),
  ]);
  return { teamIds: new Set(teams.map((t) => t.id)), providerIds: new Set(providers.map((p) => p.id)) };
}

export async function createAgent(workspaceId: string, input: DefinitionInput): Promise<{ id: string; warnings: string[] } | { error: string }> {
  const db = await getDb();
  const check = checkDefinition(input, await context(workspaceId));
  if (!check.ok) return { error: check.errors.join(" ") };
  // A new agent always starts in draft, whatever the form said. Its first opinions are shown
  // before it is given a voice, the way they would be for a new colleague.
  const id = await insertDefinition(db, workspaceId, { ...check.value, status: "draft" });
  await refresh(workspaceId, id);
  return { id, warnings: check.warnings };
}

export async function updateAgent(agentId: string, input: DefinitionInput): Promise<{ ok: true; warnings: string[] } | { error: string }> {
  const db = await getDb();
  const current = await getDefinition(db, agentId);
  if (!current) return { error: "That agent is gone." };
  const check = checkDefinition(input, await context(current.workspaceId));
  if (!check.ok) return { error: check.errors.join(" ") };
  await writeDefinition(db, agentId, check.value);
  await refresh(current.workspaceId, agentId);
  return { ok: true, warnings: check.warnings };
}

/** Draft → active is the moment an agent is given a voice, so it is its own action. */
export async function setAgentStatus(agentId: string, status: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const current = await getDefinition(db, agentId);
  if (!current) return { error: "That agent is gone." };
  const check = checkDefinition(
    { ...current, verbs: current.verbs as string[], status },
    await context(current.workspaceId),
  );
  if (!check.ok) return { error: `It cannot be activated as it stands: ${check.errors.join(" ")}` };
  await writeDefinition(db, agentId, check.value);
  await refresh(current.workspaceId, agentId);
  return { ok: true };
}

export async function removeAgent(agentId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const current = await getDefinition(db, agentId);
  if (!current) return { error: "That agent is gone." };
  await deleteDefinition(db, agentId);
  await refresh(current.workspaceId);
  return { ok: true };
}

export async function runAgent(agentId: string) {
  const db = await getDb();
  const current = await getDefinition(db, agentId);
  if (!current) return { error: "That agent is gone." };
  const result = await runDefinition(db, current.workspaceId, agentId);
  await refresh(current.workspaceId, agentId);
  return result;
}

/** How many objects a scope matches, so the form can say so before anything is saved. */
export async function scopeSize(workspaceId: string, scope: string): Promise<{ count: number; explanation: string }> {
  const db = await getDb();
  const text = scope.trim();
  if (!text) return { count: 0, explanation: "Nothing yet." };
  if (["*", "all", "everything"].includes(text.toLowerCase())) {
    const rows = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
    return { count: rows.length, explanation: "The whole model. Give it a narrower scope unless it really is the workspace's own reviewer." };
  }
  const found = await runQuery(db, workspaceId, text, 2000);
  return { count: found.total, explanation: found.explanation };
}

export type { Verb };
