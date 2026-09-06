"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { open, seal } from "@/lib/models/secret";
import { createSource } from "@/lib/intake/actions";
import { callTool, listTools, type RemoteTool } from "./client";
import { coerce, simpleFields } from "./protocol";

/**
 * Servers Nexus may ask.
 *
 * The rule this module exists to keep: **nothing a remote server says reaches the graph.** What a
 * tool returns is written as an intake source (§5.15) — text, with its origin recorded — and then
 * goes through extraction, evidence-checking and a person's review like any transcript. A shortcut
 * from here to the graph would be quick, and would quietly make a remote system an author of the
 * model.
 */

const now = () => new Date().toISOString();

async function refresh(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  if (!ws) return;
  revalidatePath(`/w/${ws.slug}/settings/connections`);
  revalidatePath(`/w/${ws.slug}/intake`);
}

export interface ServerSummary {
  id: string;
  name: string;
  url: string;
  hasKey: boolean;
  enabled: boolean;
  status: string;
  statusDetail: string;
  checkedAt: string | null;
  tools: RemoteTool[];
}

const parseTools = (raw: string): RemoteTool[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as RemoteTool[]).filter((t) => t && typeof t.name === "string") : [];
  } catch {
    return [];
  }
};

export async function listServers(workspaceId: string): Promise<ServerSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(s.mcpServers).where(eq(s.mcpServers.workspaceId, workspaceId));
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      hasKey: Boolean(row.apiKey),
      enabled: row.enabled,
      status: row.status,
      statusDetail: row.statusDetail,
      checkedAt: row.checkedAt,
      tools: parseTools(row.tools),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function addServer(workspaceId: string, input: { name: string; url: string; apiKey?: string }): Promise<{ id: string } | { error: string }> {
  const name = input.name.trim().slice(0, 80);
  const url = input.url.trim();
  if (!name) return { error: "Give it a name — the system it is, not the URL." };
  if (!/^https?:\/\//.test(url)) return { error: "The address has to be an http or https URL, the one the server answers JSON-RPC on." };
  const db = await getDb();
  const key = seal(input.apiKey?.trim() ?? "");
  const id = `mcs_${nanoid(10)}`;
  await db.insert(s.mcpServers).values({
    id, workspaceId, name, url, apiKey: key.stored, keyEncrypted: key.encrypted, enabled: true, createdAt: now(), updatedAt: now(),
  });
  await refresh(workspaceId);
  return { id };
}

export async function updateServer(serverId: string, input: { name?: string; url?: string; apiKey?: string; enabled?: boolean }): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpServers.findFirst({ where: eq(s.mcpServers.id, serverId) });
  if (!row) return { error: "That server is gone." };
  const patch: Partial<typeof s.mcpServers.$inferInsert> = { updatedAt: now() };
  if (input.name !== undefined) patch.name = input.name.trim() || row.name;
  if (input.url !== undefined) patch.url = input.url.trim() || row.url;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.apiKey !== undefined) {
    const key = seal(input.apiKey.trim());
    patch.apiKey = key.stored;
    patch.keyEncrypted = key.encrypted;
    // A new key makes the last handshake meaningless.
    patch.status = "unknown";
    patch.statusDetail = "";
    patch.checkedAt = null;
  }
  await db.update(s.mcpServers).set(patch).where(eq(s.mcpServers.id, serverId));
  await refresh(row.workspaceId);
  return { ok: true };
}

export async function removeServer(serverId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpServers.findFirst({ where: eq(s.mcpServers.id, serverId) });
  if (!row) return { error: "That server is gone." };
  await db.delete(s.mcpServers).where(eq(s.mcpServers.id, serverId));
  await refresh(row.workspaceId);
  return { ok: true };
}

/** Shake hands and ask what it can do. The answer is stored, so the page need not ask again. */
export async function checkServer(serverId: string): Promise<{ status: string; detail: string; tools: number } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpServers.findFirst({ where: eq(s.mcpServers.id, serverId) });
  if (!row) return { error: "That server is gone." };

  const result = await listTools({ url: row.url, apiKey: open(row.apiKey) });
  if (!result.ok) {
    await db.update(s.mcpServers).set({ status: result.status, statusDetail: result.error, checkedAt: now(), updatedAt: now() }).where(eq(s.mcpServers.id, serverId));
    await refresh(row.workspaceId);
    return { status: result.status, detail: result.error, tools: 0 };
  }
  const detail = result.tools.length
    ? `${result.server ? `${result.server}: ` : ""}${result.tools.length} tool${result.tools.length === 1 ? "" : "s"}.`
    : "It answered, but offers no tools.";
  await db.update(s.mcpServers)
    .set({ status: "ok", statusDetail: detail, tools: JSON.stringify(result.tools), checkedAt: now(), updatedAt: now() })
    .where(eq(s.mcpServers.id, serverId));
  await refresh(row.workspaceId);
  return { status: "ok", detail, tools: result.tools.length };
}

/**
 * Call a tool and keep what it said as an intake source.
 *
 * Deliberately two steps rather than one: the text is shown first, and only becomes a source when
 * somebody presses the second button. A remote system's answer is evidence, and evidence somebody
 * has looked at is worth more than evidence that arrived.
 */
export async function askServer(serverId: string, tool: string, values: Record<string, string>): Promise<{ text: string } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpServers.findFirst({ where: eq(s.mcpServers.id, serverId) });
  if (!row) return { error: "That server is gone." };
  if (!row.enabled) return { error: "That server is switched off here." };

  const known = parseTools(row.tools).find((t) => t.name === tool);
  if (!known) return { error: "That tool is not one this server reported. Press “Ask what it can do” first." };

  const result = await callTool({ url: row.url, apiKey: open(row.apiKey) }, tool, coerce(simpleFields(known.inputSchema), values));
  if (!result.ok) return { error: result.error ?? "That call did not work." };
  if (!result.text.trim()) return { error: "It answered with nothing readable." };
  return { text: result.text.slice(0, 200_000) };
}

/** What a tool said becomes a source, and the intake pipeline takes it from there. */
export async function keepAsSource(workspaceId: string, serverId: string, tool: string, text: string): Promise<{ id: string } | { error: string }> {
  const db = await getDb();
  const row = await db.query.mcpServers.findFirst({ where: eq(s.mcpServers.id, serverId) });
  if (!row) return { error: "That server is gone." };
  const created = await createSource({
    workspaceId,
    // The name carries where it came from, because provenance is the point of keeping it at all.
    name: `${row.name} · ${tool} · ${new Date().toISOString().slice(0, 10)}`,
    text,
    connector: "mcp",
  });
  await refresh(workspaceId);
  return created;
}
