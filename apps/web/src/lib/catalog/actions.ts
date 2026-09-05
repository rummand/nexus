"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { providerById } from "./providers";
import { flattenScopes } from "./types";

/**
 * Granting, declining and revoking access to a source system.
 *
 * The grant is the product's most consequential write, so it is deliberately blunt: a scope is
 * either in the granted set or it is not, revoking removes rows rather than adding a flag, and
 * a path that is not in the provider's own scope tree is rejected rather than stored.
 */

const now = () => new Date().toISOString();

async function touched(workspaceId: string) {
  const db = await getDb();
  const [ws] = await db.select({ slug: s.workspaces.slug }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (ws) revalidatePath(`/w/${ws.slug}`, "layout");
}

async function upsertConnection(workspaceId: string, providerId: string, patch: Partial<typeof s.connections.$inferInsert>) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(s.connections)
    .where(and(eq(s.connections.workspaceId, workspaceId), eq(s.connections.providerId, providerId)));
  if (existing) {
    await db.update(s.connections).set({ ...patch, updatedAt: now() }).where(eq(s.connections.id, existing.id));
    return existing.id;
  }
  const id = `con_${nanoid(10)}`;
  await db.insert(s.connections).values({
    id,
    workspaceId,
    providerId,
    status: "proposed",
    origin: "human",
    evidence: "[]",
    reason: "",
    note: "",
    createdAt: now(),
    updatedAt: now(),
    ...patch,
  });
  return id;
}

/**
 * Grant exactly these scopes. The list replaces whatever was granted before, so unticking and
 * saving is a revocation — there is no separate "remove one scope" path to forget to call.
 */
export async function grantScopes(input: { workspaceId: string; providerId: string; paths: string[]; note?: string; reason?: string; evidence?: unknown }) {
  const provider = providerById(input.providerId);
  if (!provider) return { error: "That is not a source in the catalogue" };
  const valid = new Set(flattenScopes(provider.scopes).map((n) => n.path));
  const paths = [...new Set(input.paths)].filter((p) => valid.has(p));
  if (paths.length === 0) return { error: "Choose at least one thing the agent may read" };

  const db = await getDb();
  const id = await upsertConnection(input.workspaceId, input.providerId, {
    status: "granted",
    note: input.note?.trim() ?? "",
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.evidence ? { evidence: JSON.stringify(input.evidence), origin: "agent" as const } : {}),
  });
  await db.delete(s.connectionScopes).where(eq(s.connectionScopes.connectionId, id));
  await db.insert(s.connectionScopes).values(paths.map((path) => ({ connectionId: id, path, createdAt: now() })));
  await touched(input.workspaceId);
  return { id, granted: paths.length };
}

/** Say no, and remember it: a declined proposal is not raised again. */
export async function declineProvider(input: { workspaceId: string; providerId: string; note?: string; reason?: string; evidence?: unknown }) {
  if (!providerById(input.providerId)) return { error: "That is not a source in the catalogue" };
  const db = await getDb();
  const id = await upsertConnection(input.workspaceId, input.providerId, {
    status: "declined",
    note: input.note?.trim() ?? "",
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.evidence ? { evidence: JSON.stringify(input.evidence), origin: "agent" as const } : {}),
  });
  await db.delete(s.connectionScopes).where(eq(s.connectionScopes.connectionId, id));
  await touched(input.workspaceId);
  return { id };
}

/** Withdraw everything. The connection stays, as the record that it was once granted. */
export async function revokeProvider(workspaceId: string, providerId: string) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(s.connections)
    .where(and(eq(s.connections.workspaceId, workspaceId), eq(s.connections.providerId, providerId)));
  if (!existing) return { ok: true };
  await db.delete(s.connectionScopes).where(eq(s.connectionScopes.connectionId, existing.id));
  await db.update(s.connections).set({ status: "revoked", updatedAt: now() }).where(eq(s.connections.id, existing.id));
  await touched(workspaceId);
  return { ok: true };
}

/** Put a declined or revoked source back in front of the agent. */
export async function reopenProvider(workspaceId: string, providerId: string) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(s.connections)
    .where(and(eq(s.connections.workspaceId, workspaceId), eq(s.connections.providerId, providerId)));
  if (!existing) return { ok: true };
  await db.delete(s.connectionScopes).where(eq(s.connectionScopes.connectionId, existing.id));
  await db.delete(s.connections).where(eq(s.connections.id, existing.id));
  await touched(workspaceId);
  return { ok: true };
}
