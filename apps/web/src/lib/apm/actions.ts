"use server";

import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUser } from "@/lib/session";
import { parseAttributes } from "@/lib/graph";
import { serializeDocument } from "@/canvas/document";
import { proposeMapping } from "./map";
import { readFile } from "./read";
import { stage, type Decision, type FileInput } from "./stage";
import { KEY_ATTRIBUTE, type MatchTarget } from "./match";
import { review } from "./review";
import { batchDocument } from "./board";
import { applyDecisions, emptyWritten, parseFiles, parseReview, parseWritten, type BatchFile, type StoredReview, type Written } from "./batch";

/**
 * Everything the landing zone does to the database.
 *
 * The rule the whole feature turns on: reading files, folding them, matching and checking are pure
 * and write nothing. Exactly one action here touches the graph, and exactly one undoes it.
 */

const now = () => new Date().toISOString();
const MAX_BYTES = 12 * 1024 * 1024;
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

async function refresh(workspaceId: string, batchId?: string) {
  const slug = await slugOf(workspaceId);
  if (!slug) return;
  revalidatePath(`/w/${slug}/apm`);
  if (batchId) revalidatePath(`/w/${slug}/apm/${batchId}`);
  revalidatePath(`/w/${slug}/graph`);
}

/** The graph as something to match against. */
export async function targetsFor(workspaceId: string): Promise<{ targets: MatchTarget[]; kinds: string[] }> {
  const db = await getDb();
  const rows = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  return {
    targets: rows.map((e) => ({ id: e.id, name: e.name, kind: e.kind, attributes: parseAttributes(e.attributes) })),
    kinds: [...new Set(rows.map((e) => e.kind).filter(Boolean))],
  };
}

/**
 * Read the uploaded files and stage them. Nothing is written to the graph.
 *
 * The files are kept whole in the batch, so the mapping can be changed and everything re-staged
 * without asking somebody to upload a 40MB export twice.
 */
export async function createBatch(form: FormData): Promise<{ id: string } | { error: string }> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const uploads = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!workspaceId) return { error: "No workspace." };
  if (!uploads.length) return { error: "Choose at least one file." };

  const files: BatchFile[] = [];
  const failed: string[] = [];
  // The names this workspace already knows, so a column of names can be told from a column of
  // adjectives. The batch's own names are added after the first pass below.
  const known = new Set((await targetsFor(workspaceId)).targets.map((t) => t.name));
  for (const upload of uploads.slice(0, 12)) {
    if (upload.size > MAX_BYTES) { failed.push(`${upload.name} is larger than 12MB`); continue; }
    try {
      const read = readFile(upload.name, Buffer.from(await upload.arrayBuffer()));
      if (read.shape === "table") {
        files.push({
          name: read.name,
          format: read.format,
          headers: read.headers,
          rows: read.rows,
          columns: proposeMapping(read.headers, read.rows),
          note: read.note,
        });
      } else {
        // Prose is kept for extraction rather than columns (§5.15). It is carried in the batch so
        // the two halves of an import — a table and the document that explains it — stay together.
        files.push({ name: read.name, format: read.format, headers: [], rows: [], columns: [], text: read.text, note: read.note });
      }
    } catch (error) {
      failed.push(`${upload.name}: ${error instanceof Error ? error.message : "could not be read"}`);
    }
  }
  if (!files.length) return { error: failed.join("; ") || "None of those files could be read." };

  /*
   * A second pass at the mapping, now that every file has been read.
   *
   * The first pass found each file's name column; the names in those columns are exactly what tells
   * "Depends on: Data Lake" from "Hosting: on premise". A ServiceNow export that points at systems
   * only named in a SharePoint list is the normal case, so this cannot be done a file at a time.
   */
  for (const file of files) {
    const at = file.columns.findIndex((c) => c.role.as === "name");
    if (at < 0) continue;
    for (const row of file.rows) { const value = (row[at] ?? "").trim(); if (value) known.add(value); }
  }
  for (const file of files) {
    if (!file.rows.length) continue;
    file.columns = proposeMapping(file.headers, file.rows, { knownNames: [...known] });
  }

  const db = await getDb();
  const user = await currentUser();
  const id = `bat_${nanoid(10)}`;
  const records = stage(tabular(files));
  const stored: StoredReview = { records, decisions: {}, includePersonal: false };

  await db.insert(s.importBatches).values({
    id,
    workspaceId,
    // Named for a list, not a title bar: the file names are on the batch's own page, and a heading
    // four filenames long is a heading nobody reads.
    name: files.length === 1 ? files[0]!.name : `${files[0]!.name} + ${files.length - 1} more`,
    status: "staged",
    files: JSON.stringify(files),
    review: JSON.stringify(stored),
    written: JSON.stringify(emptyWritten()),
    createdById: user.id,
    createdAt: now(),
    updatedAt: now(),
  });
  await refresh(workspaceId, id);
  return { id };
}

const tabular = (files: BatchFile[]): FileInput[] =>
  files.filter((f) => f.rows.length).map((f) => ({ name: f.name, headers: f.headers, rows: f.rows, columns: f.columns }));

/** Change what a column means, or the trust order, and re-stage from the files we still hold. */
export async function remapBatch(batchId: string, input: {
  fileOrder?: string[];
  columns?: Array<{ file: string; header: string; role: unknown }>;
  includePersonal?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status !== "staged") return { error: "This batch has already been approved; make a new one." };

  let files = parseFiles(batch.files);
  if (input.columns) {
    for (const change of input.columns) {
      const file = files.find((f) => f.name === change.file);
      const column = file?.columns.find((c) => c.header === change.header);
      // The role is chosen from a fixed list in the UI, so anything unrecognised is dropped rather
      // than trusted — the same boundary as everywhere else.
      if (column && isRole(change.role)) { column.role = change.role; column.why = "You said so."; }
    }
  }
  if (input.fileOrder) {
    const order = input.fileOrder;
    files = [...files].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }

  const previous = parseReview(batch.review);
  const includePersonal = input.includePersonal ?? previous.includePersonal;
  const records = stage(tabular(files), { includePersonal });
  // Decisions survive a re-map where the record still exists: re-mapping a column should not throw
  // away an afternoon of judgement about the other three hundred rows.
  const decisions: StoredReview["decisions"] = {};
  for (const record of records) if (previous.decisions[record.id]) decisions[record.id] = previous.decisions[record.id]!;

  await db.update(s.importBatches).set({
    files: JSON.stringify(files),
    review: JSON.stringify({ records, decisions, includePersonal } satisfies StoredReview),
    updatedAt: now(),
  }).where(eq(s.importBatches.id, batchId));
  await refresh(batch.workspaceId, batchId);
  return { ok: true };
}

const ROLES = new Set(["name", "kind", "description", "key", "attribute", "date", "person", "relation", "ignore"]);
function isRole(v: unknown): v is import("./map").Role {
  return Boolean(v) && typeof v === "object" && typeof (v as { as?: unknown }).as === "string" && ROLES.has((v as { as: string }).as);
}

/** Accept, hold or reject some rows. */
export async function decideRows(batchId: string, decisions: Array<{ id: string; decision: Decision }>): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status !== "staged") return { error: "This batch has already been approved." };
  const stored = parseReview(batch.review);
  for (const { id, decision } of decisions.slice(0, 5000)) {
    if (decision === "accept" || decision === "hold" || decision === "reject") stored.decisions[id] = { decision, by: "person" };
  }
  await db.update(s.importBatches).set({ review: JSON.stringify(stored), updatedAt: now() }).where(eq(s.importBatches.id, batchId));
  await refresh(batch.workspaceId, batchId);
  return { ok: true };
}

/**
 * Write the accepted rows into the graph.
 *
 * The one action in this file that changes anything. It records what it did as it goes — every
 * entity created, every field overwritten and the value that was there before — because a rollback
 * you cannot trust is worse than no rollback at all.
 */
export async function approveBatch(batchId: string): Promise<{ ok: true; created: number; updated: number; connected: number } | { error: string }> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status === "approved") return { error: "This batch has already been approved." };

  const stored = parseReview(batch.review);
  const { targets, kinds } = await targetsFor(batch.workspaceId);
  const rows = applyDecisions(review(stored.records, targets, { kinds }).rows, stored.decisions);
  const taking = rows.filter((r) => r.decision === "accept" && r.record.name.trim());
  if (!taking.length) return { error: "Nothing in this batch is accepted." };

  const written: Written = { created: [], relations: [], updated: [], at: now() };
  const idOf = new Map<string, string>();

  for (const row of taking) {
    const attributes: Record<string, string> = {};
    for (const [key, field] of Object.entries(row.record.attributes)) attributes[key] = field.chosen.value;
    if (row.record.key) attributes[KEY_ATTRIBUTE] = row.record.key;

    if (row.match.entityId) {
      const before = targets.find((t) => t.id === row.match.entityId);
      if (!before) continue;
      const merged = { ...before.attributes };
      for (const [key, value] of Object.entries(attributes)) {
        if (norm(merged[key] ?? "") === norm(value)) continue;
        written.updated.push({ entityId: before.id, key, from: merged[key] ?? "", to: value });
        merged[key] = value;
      }
      const kind = row.record.kind || before.kind;
      if (norm(kind) !== norm(before.kind)) written.updated.push({ entityId: before.id, key: "__kind", from: before.kind, to: kind });
      await db.update(s.entities)
        .set({ kind, attributes: JSON.stringify(merged), updatedAt: now() })
        .where(eq(s.entities.id, before.id));
      idOf.set(row.record.id, before.id);
    } else {
      const id = `ent_${nanoid(12)}`;
      await db.insert(s.entities).values({
        id,
        workspaceId: batch.workspaceId,
        kind: row.record.kind || "",
        name: row.record.name,
        description: row.record.description,
        attributes: JSON.stringify(attributes),
        // Where it came from, as a fact on the row: "where did this object come from" becomes a
        // query rather than somebody's memory.
        source: `import:${batchId}`,
        createdAt: now(),
        updatedAt: now(),
      });
      written.created.push(id);
      idOf.set(row.record.id, id);
    }
  }

  // Relations last, so both ends exist whichever order the rows were in.
  const byName = new Map<string, string>();
  for (const target of targets) byName.set(norm(target.name), target.id);
  for (const row of taking) byName.set(norm(row.record.name), idOf.get(row.record.id) ?? byName.get(norm(row.record.name)) ?? "");
  const existing = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, batch.workspaceId));
  const wired = new Set(existing.map((r) => `${r.fromEntityId}|${norm(r.kind)}|${r.toEntityId}`));

  for (const row of taking) {
    const from = idOf.get(row.record.id);
    if (!from) continue;
    for (const relation of row.record.relations) {
      const to = byName.get(norm(relation.target));
      if (!to || to === from) continue;
      const signature = `${from}|${norm(relation.kind)}|${to}`;
      if (wired.has(signature)) continue;
      const id = `rel_${nanoid(10)}`;
      await db.insert(s.relations_).values({
        id, workspaceId: batch.workspaceId, fromEntityId: from, toEntityId: to,
        kind: relation.kind, attributes: "{}", source: `import:${batchId}`, createdAt: now(), updatedAt: now(),
      });
      wired.add(signature);
      written.relations.push(id);
    }
  }

  const user = await currentUser();
  await db.update(s.importBatches).set({
    status: "approved",
    written: JSON.stringify(written),
    approvedById: user.id,
    approvedAt: now(),
    updatedAt: now(),
  }).where(eq(s.importBatches.id, batchId));
  await refresh(batch.workspaceId, batchId);
  return { ok: true, created: written.created.length, updated: new Set(written.updated.map((u) => u.entityId)).size, connected: written.relations.length };
}

/**
 * Undo an approved batch, honestly.
 *
 * It reverts what it wrote and only what it wrote: an object created by the batch is deleted only
 * if nobody has hung anything on it since, and a field is put back only if it still holds the value
 * the batch put there. Everything it declines to touch is counted and reported, because a rollback
 * that quietly leaves half the estate changed is the worst possible outcome.
 */
export async function rollbackBatch(batchId: string): Promise<
  { ok: true; deleted: number; restored: number; kept: number; notes: string[] } | { error: string }
> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status !== "approved") return { error: "That batch was never approved, so there is nothing to undo." };

  const written = parseWritten(batch.written);
  const notes: string[] = [];
  let deleted = 0;
  let restored = 0;
  let kept = 0;

  // Relations the batch drew go first: they are what would otherwise hold a created object down.
  if (written.relations.length) {
    await db.delete(s.relations_).where(inArray(s.relations_.id, written.relations));
  }

  if (written.created.length) {
    const rows = await db.select().from(s.entities).where(inArray(s.entities.id, written.created));
    const relations = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, batch.workspaceId));
    const onBoards = await db.select().from(s.boardEntities).where(inArray(s.boardEntities.entityId, written.created));
    const attached = new Set(relations.flatMap((r) => [r.fromEntityId, r.toEntityId]));
    const drawn = new Set(onBoards.map((b) => b.entityId));

    for (const row of rows) {
      if (attached.has(row.id) || drawn.has(row.id)) {
        kept++;
        notes.push(`“${row.name}” was kept: ${drawn.has(row.id) ? "it is on a board" : "something has been connected to it"} since the import.`);
        continue;
      }
      await db.delete(s.entities).where(eq(s.entities.id, row.id));
      deleted++;
    }
  }

  const touchedIds = [...new Set(written.updated.map((u) => u.entityId))];
  if (touchedIds.length) {
    const rows = await db.select().from(s.entities).where(inArray(s.entities.id, touchedIds));
    for (const row of rows) {
      const attributes = parseAttributes(row.attributes);
      let kind = row.kind;
      let changed = false;
      for (const update of written.updated.filter((u) => u.entityId === row.id)) {
        if (update.key === "__kind") {
          if (norm(kind) !== norm(update.to)) { kept++; notes.push(`“${row.name}” kind was left alone: it is no longer what the import set.`); continue; }
          kind = update.from;
          changed = true;
          continue;
        }
        const current = attributes[update.key] ?? "";
        if (norm(current) !== norm(update.to)) {
          kept++;
          notes.push(`“${row.name}” ${update.key} was left alone: it now says “${current}”, not what the import wrote.`);
          continue;
        }
        if (update.from) attributes[update.key] = update.from;
        else delete attributes[update.key];
        changed = true;
        restored++;
      }
      if (changed) {
        await db.update(s.entities).set({ kind, attributes: JSON.stringify(attributes), updatedAt: now() }).where(eq(s.entities.id, row.id));
      }
    }
  }

  await db.update(s.importBatches).set({ status: "rolled back", updatedAt: now() }).where(eq(s.importBatches.id, batchId));
  await refresh(batch.workspaceId, batchId);
  return { ok: true, deleted, restored, kept, notes: notes.slice(0, 20) };
}

export async function deleteBatch(batchId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status === "approved") return { error: "An approved batch is the record of what happened to the graph; roll it back instead." };
  await db.delete(s.importBatches).where(and(eq(s.importBatches.id, batchId), eq(s.importBatches.workspaceId, batch.workspaceId)));
  await refresh(batch.workspaceId);
  return { ok: true };
}

/**
 * Draw the staged batch on a new board.
 *
 * Reviewing four hundred rows in a list is a thing nobody finishes; seeing them laid out by what
 * would happen to each is a thing you can take in at a glance and walk around with a colleague.
 * The board is ordinary — drag it, annotate it, put an agent beside it — and every card on it is
 * marked planned, so none of it enters the graph by being drawn.
 */
export async function createBatchBoard(batchId: string): Promise<{ error: string } | never> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  const stored = parseReview(batch.review);
  const { targets, kinds } = await targetsFor(batch.workspaceId);
  const rows = applyDecisions(review(stored.records, targets, { kinds }).rows, stored.decisions);
  if (!rows.length) return { error: "There is nothing staged to draw." };

  const space = await db.query.spaces.findFirst({ where: eq(s.spaces.workspaceId, batch.workspaceId), orderBy: s.spaces.name });
  if (!space) return { error: "This workspace has no space to put a board in." };

  const title = `Staged · ${batch.name}`.slice(0, 120);
  const { document, drawn, summarised } = batchDocument(rows, { title });
  const user = await currentUser();
  const id = `brd_${nanoid(10)}`;
  await db.insert(s.boards).values({
    id,
    workspaceId: batch.workspaceId,
    spaceId: space.id,
    name: title,
    description: `${drawn} staged object${drawn === 1 ? "" : "s"} drawn${summarised ? `, ${summarised} summarised` : ""}. Nothing here is in the graph.`,
    createdById: user.id,
    document: serializeDocument(document),
    createdAt: now(),
    updatedAt: now(),
    lastOpenedAt: now(),
  });
  const slug = await slugOf(batch.workspaceId);
  if (slug) revalidatePath(`/w/${slug}`, "layout");
  redirect(`/b/${id}`);
}
