"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { ensureTokenAgent } from "./agent";
import { createToken, deleteToken, listTokens, revokeToken, SCOPES, type Scope, type TokenSummary } from "./tokens";

/**
 * Issuing keys to the outside.
 *
 * The key is returned exactly once, by the action that mints it, and never again by anything. That
 * is the whole reason this is a separate module from the page: there must be no route, no action
 * and no prop anywhere else that could hand one back.
 */

async function refresh(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  if (!ws) return;
  revalidatePath(`/w/${ws.slug}/settings/connections`);
  revalidatePath(`/w/${ws.slug}/agents`);
}

export async function issueKey(workspaceId: string, name: string, scope: string): Promise<{ token: string; id: string } | { error: string }> {
  const db = await getDb();
  const label = name.trim().slice(0, 80);
  if (!label) return { error: "Give it a name — “Claude Code on my laptop”, “the platform team's assistant”. It is what the review queue will show." };
  const chosen: Scope = (SCOPES as readonly string[]).includes(scope) ? (scope as Scope) : "read";
  const { id, token } = await createToken(db, workspaceId, label, chosen, null);
  // A key that may propose speaks as an agent, so what it says can be measured like anything else.
  if (chosen === "propose") await ensureTokenAgent(db, workspaceId, id, label);
  await refresh(workspaceId);
  return { id, token };
}

export async function revokeKey(tokenId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpTokens.findFirst({ where: eq(s.mcpTokens.id, tokenId) });
  if (!row) return { error: "That key is gone." };
  await revokeToken(db, tokenId);
  await refresh(row.workspaceId);
  return { ok: true };
}

/** Forgetting a revoked key entirely. Its agent's record stays, because that is not the key's. */
export async function forgetKey(tokenId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpTokens.findFirst({ where: eq(s.mcpTokens.id, tokenId) });
  if (!row) return { error: "That key is gone." };
  await deleteToken(db, tokenId);
  await refresh(row.workspaceId);
  return { ok: true };
}

export async function connectionSettings(workspaceId: string): Promise<{ tokens: TokenSummary[] }> {
  const db = await getDb();
  return { tokens: await listTokens(db, workspaceId) };
}
