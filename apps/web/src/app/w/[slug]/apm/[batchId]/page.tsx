import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { applyDecisions, parseFiles, parseReview, parseWritten } from "@/lib/apm/batch";
import { describeRole } from "@/lib/apm/map";
import { recount, review } from "@/lib/apm/review";
import { targetsFor } from "@/lib/apm/actions";
import { BatchReview, type RowView } from "@/components/apm/BatchReview";

/**
 * One batch, under review.
 *
 * Matching and checking are recomputed here on every load rather than stored, because the graph
 * moves: an object somebody created this morning should be matched against, and a batch reviewed
 * against yesterday's estate is a batch that quietly creates duplicates. The decisions a person has
 * taken are stored, and applied over the fresh answer.
 */
export default async function BatchPage({ params }: { params: Promise<{ slug: string; batchId: string }> }) {
  const { slug, batchId } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch || batch.workspaceId !== workspace.id) notFound();

  const files = parseFiles(batch.files);
  const stored = parseReview(batch.review);
  const written = parseWritten(batch.written);
  const { targets, kinds } = await targetsFor(workspace.id);

  /**
   * What this source claimed last time.
   *
   * Only objects a previous approved batch of the *same* files wrote, so "this has disappeared from
   * the export" is asked of a re-import and never of the first one.
   */
  const previousFrom = await previous(db, workspace.id, batch.id, files.map((f) => f.name));
  const fresh = review(stored.records, targets, { kinds, previouslyFrom: previousFrom });
  const rows = applyDecisions(fresh.rows, stored.decisions);

  const views: RowView[] = rows.map((row) => ({
    id: row.record.id,
    name: row.record.name,
    kind: row.record.kind,
    description: row.record.description,
    key: row.record.key,
    sources: row.record.sources,
    rows: row.record.rows,
    attributes: Object.entries(row.record.attributes).map(([key, field]) => ({
      key,
      value: field.chosen.value,
      from: field.chosen.source,
      others: field.others.map((o) => ({ value: o.value, from: o.source })),
    })),
    personal: Object.entries(row.record.personal).map(([key, field]) => ({ key, value: field.chosen.value, from: field.chosen.source })),
    relations: row.record.relations.map((r) => ({ kind: r.kind, target: r.target })),
    match: { how: row.match.how, name: row.match.name, kind: row.match.kind, alternatives: row.match.alternatives.map((a) => a.name) },
    changes: row.changes,
    issues: row.issues,
    decision: row.decision,
    decidedBy: row.decidedBy,
  }));

  return (
    <BatchReview
      slug={slug}
      batch={{
        id: batch.id,
        name: batch.name,
        status: batch.status,
        createdAt: batch.createdAt,
        approvedAt: batch.approvedAt,
        includePersonal: stored.includePersonal,
      }}
      files={files.map((file) => ({
        name: file.name,
        format: file.format,
        note: file.note ?? null,
        rows: file.rows.length,
        text: file.text ? file.text.slice(0, 600) : null,
        columns: file.columns.map((c) => ({ header: c.header, role: c.role, label: describeRole(c.role), why: c.why, sample: c.sample })),
      }))}
      rows={views}
      counts={recount(rows)}
      missing={fresh.missing.map((m) => ({ name: m.target.name, message: m.issue.message }))}
      written={{ created: written.created.length, updated: new Set(written.updated.map((u) => u.entityId)).size, relations: written.relations.length }}
    />
  );
}

/** Objects written by an earlier approved batch whose files overlap this one's. */
async function previous(db: Awaited<ReturnType<typeof getDb>>, workspaceId: string, batchId: string, fileNames: string[]) {
  const rows = await db.select().from(s.importBatches).where(eq(s.importBatches.workspaceId, workspaceId));
  const earlier = rows.filter((row) =>
    row.id !== batchId &&
    row.status === "approved" &&
    parseFiles(row.files).some((f) => fileNames.includes(f.name)));
  if (!earlier.length) return undefined;
  const ids = new Set(earlier.flatMap((row) => parseWritten(row.written).created));
  if (!ids.size) return undefined;
  const entities = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  return entities.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, name: e.name, kind: e.kind, attributes: {} }));
}
