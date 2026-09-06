import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";

/**
 * Keys for the outside.
 *
 * The reasoning is the same as for a model provider's key (§5.31) but pointed the other way: this
 * is a key *we* issue, so we never need to read it back. It is hashed on arrival and compared by
 * hash, which means a leaked database gives an attacker nothing usable — and it means the product
 * has to be honest that a key shown once is shown once.
 *
 * Two scopes, and only two. **read** can ask this workspace anything about the model; **propose**
 * can also leave a suggestion in the review queue. There is deliberately no third scope that
 * writes, because the whole claim of the boundary is that nothing outside Nexus changes the model
 * without a person accepting it.
 */

export const SCOPES = ["read", "propose"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_NOTE: Record<Scope, string> = {
  read: "Can ask about the model: search it, describe an object, follow what depends on what, read the meta-model and the health score.",
  propose: "Everything read can do, and may leave suggestions in the review queue — where a person still has to accept them.",
};

const PREFIX = "nxs_";

/** A key, and the two things we keep about it. Shown once; never recoverable. */
export function mintToken(): { token: string; prefix: string; hash: string } {
  const token = `${PREFIX}${randomBytes(24).toString("hex")}`;
  return { token, prefix: token.slice(0, PREFIX.length + 6), hash: hashToken(token) };
}

export const hashToken = (token: string): string => createHash("sha256").update(token.trim()).digest("hex");

export interface TokenSummary {
  id: string;
  name: string;
  prefix: string;
  scope: Scope;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export const toSummary = (row: s.McpTokenRow): TokenSummary => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  scope: row.scope,
  lastUsedAt: row.lastUsedAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
});

export async function listTokens(db: Db, workspaceId: string): Promise<TokenSummary[]> {
  const rows = await db.select().from(s.mcpTokens).where(eq(s.mcpTokens.workspaceId, workspaceId));
  return rows.map(toSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createToken(db: Db, workspaceId: string, name: string, scope: Scope, agentId: string | null): Promise<{ id: string; token: string }> {
  const { token, prefix, hash } = mintToken();
  const id = `mcp_${nanoid(10)}`;
  await db.insert(s.mcpTokens).values({ id, workspaceId, name, prefix, hash, scope, agentId, createdAt: new Date().toISOString() });
  return { id, token };
}

export async function revokeToken(db: Db, tokenId: string) {
  await db.update(s.mcpTokens).set({ revokedAt: new Date().toISOString() }).where(eq(s.mcpTokens.id, tokenId));
}

export async function deleteToken(db: Db, tokenId: string) {
  await db.delete(s.mcpTokens).where(eq(s.mcpTokens.id, tokenId));
}

/**
 * Who is calling.
 *
 * A revoked key is treated as no key at all rather than as a different error: telling a caller
 * "that key existed once" is a fact they have no use for and an attacker does.
 */
export async function authenticate(db: Db, token: string): Promise<s.McpTokenRow | null> {
  const value = token.trim();
  if (!value.startsWith(PREFIX)) return null;
  const rows = await db
    .select()
    .from(s.mcpTokens)
    .where(and(eq(s.mcpTokens.hash, hashToken(value)), isNull(s.mcpTokens.revokedAt)));
  return rows[0] ?? null;
}

/** Last used is a fact somebody needs when deciding whether a key is still in use. */
export async function touch(db: Db, tokenId: string) {
  await db.update(s.mcpTokens).set({ lastUsedAt: new Date().toISOString() }).where(eq(s.mcpTokens.id, tokenId));
}

/** Read the bearer token out of a request's headers, whatever case they arrived in. */
export function bearer(headers: Headers): string {
  const raw = headers.get("authorization") ?? headers.get("x-api-key") ?? "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw.trim();
}
