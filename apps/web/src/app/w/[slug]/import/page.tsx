import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { parseFiles, parseReview, parseWritten } from "@/lib/import/batch";
import { ImportZone, type BatchSummary } from "@/components/import/ImportZone";
import type { RemoteTool } from "@/lib/mcp/client";

/** A server's last-reported tools, defensively — the column is JSON written by an earlier read. */
function parseServerTools(raw: string): RemoteTool[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as RemoteTool[]).filter((tool) => tool && typeof tool.name === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Import.
 *
 * Where data arrives and waits. Files, a pasted block or an answer from a connected system are
 * read, folded and checked here, and stay a claim until somebody approves them — so this page is a
 * list of things that have not happened yet, plus the record of the ones that did.
 */
export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.importBatches)
    .where(eq(s.importBatches.workspaceId, workspace.id))
    .orderBy(desc(s.importBatches.createdAt))
    .limit(50);

  /*
   * The servers this workspace can ask (§5.35), so the third door is on the page where data comes
   * in rather than only on the page where servers are configured.
   */
  const servers = (await db.select().from(s.mcpServers).where(eq(s.mcpServers.workspaceId, workspace.id)))
    .filter((row) => row.enabled)
    .map((row) => ({ id: row.id, name: row.name, tools: parseServerTools(row.tools) }))
    .filter((server) => server.tools.length > 0);

  const batches: BatchSummary[] = rows.map((row) => {
    const files = parseFiles(row.files);
    const review = parseReview(row.review);
    const written = parseWritten(row.written);
    return {
      id: row.id,
      name: row.name,
      origin: row.origin,
      status: row.status,
      createdAt: row.createdAt,
      approvedAt: row.approvedAt,
      files: files.map((f) => ({ name: f.name, format: f.format, rows: f.rows.length, prose: Boolean(f.text) })),
      records: review.records.length,
      created: written.created.length,
      updated: new Set(written.updated.map((u) => u.entityId)).size,
    };
  });

  return <ImportZone slug={slug} workspaceId={workspace.id} batches={batches} servers={servers} />;
}
