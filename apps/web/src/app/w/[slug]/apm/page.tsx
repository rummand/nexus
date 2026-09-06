import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { parseFiles, parseReview, parseWritten } from "@/lib/apm/batch";
import { LandingZone, type BatchSummary } from "@/components/apm/LandingZone";

/**
 * The landing zone.
 *
 * Where data arrives and waits. A batch of files is read, folded and checked here and stays a
 * claim until somebody approves it — so this page is a list of things that have not happened yet,
 * plus the record of the ones that did.
 */
export default async function ApmPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const batches: BatchSummary[] = rows.map((row) => {
    const files = parseFiles(row.files);
    const review = parseReview(row.review);
    const written = parseWritten(row.written);
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: row.createdAt,
      approvedAt: row.approvedAt,
      files: files.map((f) => ({ name: f.name, format: f.format, rows: f.rows.length, prose: Boolean(f.text) })),
      records: review.records.length,
      created: written.created.length,
      updated: new Set(written.updated.map((u) => u.entityId)).size,
    };
  });

  return <LandingZone slug={slug} workspaceId={workspace.id} batches={batches} />;
}
