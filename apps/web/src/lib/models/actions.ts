"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { probe } from "./call";
import { configured, toProvider } from "./resolve";
import { open, seal, secretConfigured } from "./secret";
import { DEFAULT_BASE, TASKS, type Dialect, type Provider, type Task } from "./types";

/**
 * Managing where the thinking happens.
 *
 * An API key comes in and never goes out: no action here returns one, and the settings page shows
 * only whether there is one and whether it is encrypted. The one way to find out if a key works is
 * to use it, which is what `check` does.
 */

const now = () => new Date().toISOString();

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

async function refresh(workspaceId: string) {
  const slug = await slugOf(workspaceId);
  if (!slug) return;
  revalidatePath(`/w/${slug}/settings/models`);
  // Everything that can be answered by a model shows whether one is available.
  revalidatePath(`/w/${slug}/graph`);
  revalidatePath(`/w/${slug}/agents`);
}

export interface ProviderInput {
  name: string;
  dialect: Dialect;
  baseUrl: string;
  model: string;
  /** Omitted leaves the stored key alone; empty string clears it. */
  apiKey?: string;
  enabled?: boolean;
}

export async function addProvider(workspaceId: string, input: ProviderInput): Promise<{ id: string } | { error: string }> {
  const db = await getDb();
  const name = input.name.trim();
  if (!name) return { error: "Give it a name — “Anthropic”, “Our gateway”, “Ollama on the OT network”." };
  if (!input.model.trim()) return { error: "A model id is needed: claude-sonnet-4-5, gpt-4.1, llama3.3 — whatever the endpoint answers to." };
  const key = seal(input.apiKey?.trim() ?? "");
  const id = `mdl_${nanoid(10)}`;
  await db.insert(s.modelProviders).values({
    id,
    workspaceId,
    name,
    dialect: input.dialect,
    baseUrl: input.baseUrl.trim(),
    model: input.model.trim(),
    apiKey: key.stored,
    keyEncrypted: key.encrypted,
    enabled: input.enabled ?? true,
    createdAt: now(),
    updatedAt: now(),
  });
  await refresh(workspaceId);
  return { id };
}

export async function updateProvider(providerId: string, input: Partial<ProviderInput>): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const row = await db.query.modelProviders.findFirst({ where: eq(s.modelProviders.id, providerId) });
  if (!row) return { error: "That provider is gone." };
  const patch: Partial<typeof s.modelProviders.$inferInsert> = { updatedAt: now() };
  if (input.name !== undefined) patch.name = input.name.trim() || row.name;
  if (input.dialect !== undefined) patch.dialect = input.dialect;
  if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl.trim();
  if (input.model !== undefined) patch.model = input.model.trim();
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.apiKey !== undefined) {
    const key = seal(input.apiKey.trim());
    patch.apiKey = key.stored;
    patch.keyEncrypted = key.encrypted;
    // A new key makes the last check meaningless; saying "ok" beside a key nobody has tried is a
    // small lie that costs somebody an afternoon.
    patch.status = "unknown";
    patch.statusDetail = "";
    patch.checkedAt = null;
  }
  await db.update(s.modelProviders).set(patch).where(eq(s.modelProviders.id, providerId));
  await refresh(row.workspaceId);
  return { ok: true };
}

export async function removeProvider(providerId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const row = await db.query.modelProviders.findFirst({ where: eq(s.modelProviders.id, providerId) });
  if (!row) return { error: "That provider is gone." };
  await db.delete(s.modelProviders).where(eq(s.modelProviders.id, providerId));
  await refresh(row.workspaceId);
  return { ok: true };
}

/** Which provider does which job. A null provider means "whichever is first". */
export async function assignTask(workspaceId: string, task: Task, providerId: string | null, model = ""): Promise<{ ok: true } | { error: string }> {
  if (!TASKS.includes(task)) return { error: "That is not a job a model does here." };
  const db = await getDb();
  await db
    .insert(s.modelTasks)
    .values({ workspaceId, task, providerId, model: model.trim(), updatedAt: now() })
    .onConflictDoUpdate({ target: [s.modelTasks.workspaceId, s.modelTasks.task], set: { providerId, model: model.trim(), updatedAt: now() } });
  await refresh(workspaceId);
  return { ok: true };
}

/**
 * Try it.
 *
 * A real call with the real key, because everything short of that — a reachable host, a key of the
 * right shape — is a question nobody asked. The answer is stored so the settings page can show it
 * without asking again on every render.
 */
export async function checkProvider(providerId: string): Promise<{ status: string; detail: string } | { error: string }> {
  const db = await getDb();
  const row = await db.query.modelProviders.findFirst({ where: eq(s.modelProviders.id, providerId) });
  if (!row) return { error: "That provider is gone." };
  if (!row.model.trim()) return { error: "Set a model id first — there is nothing to ask for." };

  const result = await probe({
    dialect: row.dialect,
    baseUrl: row.baseUrl.trim() || DEFAULT_BASE[row.dialect],
    apiKey: open(row.apiKey),
    model: row.model,
    from: "provider",
    providerName: row.name,
  });
  await db.update(s.modelProviders)
    .set({ status: result.status, statusDetail: result.detail, checkedAt: now(), updatedAt: now() })
    .where(eq(s.modelProviders.id, providerId));
  await refresh(row.workspaceId);
  return { status: result.status, detail: result.detail };
}

/** Everything the settings page needs. No key ever leaves the server. */
export async function modelSettings(workspaceId: string): Promise<{
  providers: Provider[];
  tasks: Record<string, { providerId: string | null; model: string }>;
  secretConfigured: boolean;
  environment: { key: boolean; model: string; baseUrl: string };
}> {
  const db = await getDb();
  const rows = await db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspaceId));
  const config = await configured(db, workspaceId);
  return {
    providers: rows.map(toProvider),
    tasks: config.tasks,
    secretConfigured: secretConfigured(),
    environment: {
      key: Boolean(process.env.ANTHROPIC_API_KEY),
      model: process.env.NEXUS_MODEL ?? "",
      baseUrl: process.env.NEXUS_MODEL_BASE_URL ?? "",
    },
  };
}

/** Delete every task assignment pointing at a provider that no longer exists. */
export async function tidyTasks(workspaceId: string) {
  const db = await getDb();
  const rows = await db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspaceId));
  const ids = new Set(rows.map((r) => r.id));
  const tasks = await db.select().from(s.modelTasks).where(eq(s.modelTasks.workspaceId, workspaceId));
  for (const task of tasks) {
    if (task.providerId && !ids.has(task.providerId)) {
      await db.delete(s.modelTasks).where(and(eq(s.modelTasks.workspaceId, workspaceId), eq(s.modelTasks.task, task.task)));
    }
  }
}
