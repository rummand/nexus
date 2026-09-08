"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { currentUser } from "@/lib/session";
import { recordRelationEvent, recordSince, snapshotEntities } from "@/lib/history/record";
import { currentActor } from "@/lib/history/current";
import * as who from "@/lib/history/actor";
import { parseAttributes } from "@/lib/graph";
import { serializeDocument } from "@/canvas/document";
import { boardChangedElsewhere } from "@/lib/live/room";
import { proposeFileKind, proposeMapping } from "./map";
import { readFile, readPasted } from "./read";
import { stage, type Decision, type FileInput } from "./stage";
import { claimsFrom, describeProse } from "./prose";
import { runPipeline } from "@/lib/intake/pipeline";
import { parsePassages } from "@/lib/intake/transcript";
import { extractWithModel } from "@/lib/intake/model";
import { vocabulary } from "@/lib/intake/vocabulary";
import { choose } from "@/lib/models/resolve";
import type { Db } from "@/db/client";
import { KEY_ATTRIBUTE, type MatchTarget } from "./match";
import { review } from "./review";
import { batchDocument } from "./board";
import { withOverrides } from "./reconcile";
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
  revalidatePath(`/w/${slug}/import`);
  if (batchId) revalidatePath(`/w/${slug}/import/${batchId}`);
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
 * One way in, three doors.
 *
 * Files, a pasted block, or a tool on a system that speaks MCP: all three arrive here as the same
 * thing — named blobs of table or prose — and are staged identically. The doors differ only in how
 * the bytes were obtained, and keeping the staging in one function is what stops "paste" quietly
 * becoming a worse import than "upload".
 *
 * Whatever arrives is kept whole in the batch, so the mapping can be changed and everything
 * re-staged without asking somebody to fetch a 40MB export twice.
 */
export type BatchOrigin = "files" | "paste" | "connected system";

async function stageBatch(workspaceId: string, files: BatchFile[], origin: BatchOrigin, name?: string): Promise<{ id: string } | { error: string }> {
  if (!files.length) return { error: "There was nothing readable in that." };

  // The names this workspace already knows, so a column of names can be told from a column of
  // adjectives. The batch's own names are added by the first pass below.
  const { targets, kinds: vocabulary } = await targetsFor(workspaceId);
  const known = new Set(targets.map((t) => t.name));

  /*
   * A second pass at the mapping, now that everything has been read.
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
    /*
     * And what these rows *are*. Most exports never say — a server list is all servers and the
     * file name is the whole of the metadata — so it is proposed here and shown as a question a
     * person can answer in one click, rather than four hundred untyped objects to fix afterwards.
     */
    const proposed = proposeFileKind(file.name, file.headers, file.rows, file.columns, vocabulary);
    file.kind = proposed.kind;
    file.kindWhy = proposed.why;
    file.kindFromRows = proposed.fromRows;
  }

  /*
   * The prose in the batch, read for claims (§5.38).
   *
   * Done once, here, and stored on the file: re-mapping a column must not re-read a document,
   * because reading is the one step in this pipeline that can cost money. A model reads it when one
   * is configured and the rules read it when not — the same choice intake makes, and the same
   * validation either way.
   */
  const db = await getDb();
  await readProse(db, workspaceId, files);

  const user = await currentUser();
  const id = `bat_${nanoid(10)}`;
  const records = stage(tabular(files));
  const stored: StoredReview = { records, decisions: {}, includePersonal: false };

  await db.insert(s.importBatches).values({
    id,
    workspaceId,
    // Named for a list, not a title bar: the file names are on the batch's own page, and a heading
    // four filenames long is a heading nobody reads.
    name: (name ?? (files.length === 1 ? files[0]!.name : `${files[0]!.name} + ${files.length - 1} more`)).slice(0, 120),
    origin,
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

/** What a read file becomes in a batch: rows to map, or prose to read for claims (§5.15). */
function asBatchFile(read: ReturnType<typeof readFile>): BatchFile {
  return read.shape === "table"
    ? { name: read.name, format: read.format, headers: read.headers, rows: read.rows, columns: proposeMapping(read.headers, read.rows), note: read.note }
    : { name: read.name, format: read.format, headers: [], rows: [], columns: [], text: read.text, note: read.note };
}

/** Files somebody uploaded. */
export async function createBatch(form: FormData): Promise<{ id: string } | { error: string }> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const uploads = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!workspaceId) return { error: "No workspace." };
  if (!uploads.length) return { error: "Choose at least one file." };

  const files: BatchFile[] = [];
  const failed: string[] = [];
  for (const upload of uploads.slice(0, 12)) {
    if (upload.size > MAX_BYTES) { failed.push(`${upload.name} is larger than 12MB`); continue; }
    try {
      files.push(asBatchFile(readFile(upload.name, Buffer.from(await upload.arrayBuffer()))));
    } catch (error) {
      failed.push(`${upload.name}: ${error instanceof Error ? error.message : "could not be read"}`);
    }
  }
  if (!files.length) return { error: failed.join("; ") || "None of those files could be read." };
  return stageBatch(workspaceId, files, "files");
}

/**
 * A block somebody pasted.
 *
 * The most common thing an architect has is not a file: it is forty rows in a mail, a query result
 * from somebody's console, a list in a chat message. Making them save it as a CSV first is a step
 * whose only purpose is to satisfy the import feature.
 */
export async function createPastedBatch(workspaceId: string, input: { name: string; text: string }): Promise<{ id: string } | { error: string }> {
  const text = input.text.slice(0, 4_000_000);
  if (!text.trim()) return { error: "There is nothing in that." };
  const name = input.name.trim().slice(0, 80) || "Pasted";
  let read;
  try {
    read = readPasted(name, text);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That could not be read." };
  }
  if (read.shape === "table" && !read.headers.length) return { error: "That has no header row, so there is nothing to map." };
  return stageBatch(workspaceId, [asBatchFile(read)], "paste", name);
}

/**
 * What a connected system answered.
 *
 * The tool has already been called and the answer shown (§5.35) — this is the second button, for
 * an answer that reads as a table. Prose from a server goes to intake, where it is read for
 * claims; rows go here, where they are mapped and matched. Same discipline either way: nothing a
 * remote system says reaches the model without a person accepting it.
 */
export async function stageFromServer(workspaceId: string, input: { server: string; tool: string; text: string }): Promise<{ id: string } | { error: string }> {
  const name = `${input.server} · ${input.tool}`.slice(0, 80);
  let read;
  try {
    read = readPasted(name, input.text.slice(0, 4_000_000));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That could not be read." };
  }
  if (read.shape !== "table" || !read.headers.length) {
    return { error: "That answer does not read as a table. Keep it as a source instead — intake reads prose for claims." };
  }
  return stageBatch(workspaceId, [asBatchFile(read)], "connected system", name);
}

/*
 * Everything the stager reads, in the batch's own trust order: a table contributes rows, a document
 * contributes claims, and both are folded into the same records (§5.38). Keeping them in one list
 * is what makes "put the governance review above the 2019 spreadsheet" an ordinary reorder.
 */
const tabular = (files: BatchFile[]): FileInput[] =>
  files
    .filter((f) => f.rows.length || f.claims?.length)
    .map((f) => ({ name: f.name, headers: f.headers, rows: f.rows, columns: f.columns, kind: f.kind, claims: f.claims }));

/** Read every prose file in the batch for claims about the objects the tables name. */
async function readProse(db: Db, workspaceId: string, files: BatchFile[]): Promise<void> {
  const prose = files.filter((f) => f.text?.trim() && !f.claims);
  if (!prose.length) return;

  const vocab = await vocabulary(workspaceId);
  const choice = await choose(db, workspaceId, "intake");
  for (const file of prose) {
    const text = file.text ?? "";
    let read;
    if (choice) {
      try {
        read = await extractWithModel(file.name, parsePassages(text), vocab, choice);
      } catch {
        read = undefined; // a model that is down is not a reason to read nothing
      }
    }
    try {
      const extraction = runPipeline({ name: file.name, text, vocabulary: vocab, read });
      file.claims = claimsFrom(extraction);
      file.claimsNote = describeProse(extraction, file.claims);
    } catch (error) {
      file.claims = [];
      file.claimsNote = `It could not be read: ${error instanceof Error ? error.message : "unknown error"}. It is kept with the batch.`;
    }
  }
}

/** Change what a column means, or the trust order, and re-stage from the files we still hold. */
export async function remapBatch(batchId: string, input: {
  fileOrder?: string[];
  columns?: Array<{ file: string; header: string; role: unknown }>;
  /** What the rows in a file are, when they do not say for themselves (§5.36). */
  kinds?: Array<{ file: string; kind: string }>;
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
  if (input.kinds) {
    for (const change of input.kinds) {
      const file = files.find((f) => f.name === change.file);
      if (file) file.kind = change.kind.trim().slice(0, 60);
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
  const overrides: StoredReview["overrides"] = {};
  for (const record of records) if (previous.overrides?.[record.id]) overrides[record.id] = previous.overrides[record.id]!;
  const alive = new Set(records.map((r) => r.id));

  await db.update(s.importBatches).set({
    files: JSON.stringify(files),
    review: JSON.stringify({
      records,
      decisions,
      overrides,
      drawn: (previous.drawn ?? []).filter((d) => alive.has(d.from) && alive.has(d.to)),
      removed: (previous.removed ?? []).filter((id) => alive.has(id)),
      includePersonal,
    } satisfies StoredReview),
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
  /*
   * Approving is where a staged batch stops being a proposal and becomes the estate everybody
   * else reads (§5.46). Staging, mapping and deciding lanes are ordinary work; this is not.
   */
  const notAllowed = await deny(batch.workspaceId, "import.approve");
  if (notAllowed) return notAllowed;

  // Everything an approval writes is one act by one import, so the history is taken across the
  // whole workspace and attributed to the batch (§5.43).
  const history = { workspaceId: batch.workspaceId, actor: who.importer(batch.name, batchId), context: `import: ${batch.name}` };
  const before = await snapshotEntities(db, batch.workspaceId);

  const stored = parseReview(batch.review);
  const { targets, kinds } = await targetsFor(batch.workspaceId);
  /*
   * What the board says, not only what the table said. A name corrected on a card, a kind set by
   * dragging, a row somebody deleted from the board — all of it is a person's judgement about the
   * import, and approving has to honour it or the canvas is decorative.
   */
  const staged = withOverrides(stored.records, stored.overrides ?? {}).filter((r) => !(stored.removed ?? []).includes(r.id));
  const rows = applyDecisions(review(staged, targets, { kinds }).rows, stored.decisions);
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
  // For the history: an entity id back to the name a person would recognise.
  const nameFor = (entityId: string) =>
    taking.find((r) => idOf.get(r.record.id) === entityId)?.record.name ?? targets.find((t) => t.id === entityId)?.name ?? "";

  /*
   * Relations somebody drew between two cards on the board. They are named by record rather than
   * by name — a connector points at a card, and the card knows which claim it is, so a renamed
   * object cannot silently point somewhere else.
   */
  for (const drawn of stored.drawn ?? []) {
    const from = idOf.get(drawn.from);
    const to = idOf.get(drawn.to);
    if (!from || !to || from === to) continue;
    const kind = drawn.kind.trim() || "relates to";
    const signature = `${from}|${norm(kind)}|${to}`;
    if (wired.has(signature)) continue;
    const id = `rel_${nanoid(10)}`;
    await db.insert(s.relations_).values({
      id, workspaceId: batch.workspaceId, fromEntityId: from, toEntityId: to,
      kind, attributes: "{}", source: `import:${batchId}`, createdAt: now(), updatedAt: now(),
    });
    wired.add(signature);
    written.relations.push(id);
  }

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
      await recordRelationEvent(db, history, {
        kind: "relationAdded",
        label: relation.kind,
        from: { id: from, name: nameFor(from) },
        to: { id: to, name: nameFor(to) },
      });
    }
  }

  await recordSince(db, history, { workspace: true }, before);
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
  const notAllowed = await deny(batch.workspaceId, "import.approve");
  if (notAllowed) return notAllowed;

  const history = { workspaceId: batch.workspaceId, actor: await currentActor(), context: `rolled back the import “${batch.name}”` };
  const before = await snapshotEntities(db, batch.workspaceId);

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

  await recordSince(db, history, { workspace: true }, before);
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
  // One board per batch: a second one would be a second set of lanes writing to the same
  // decisions, and whichever was saved last would win an argument nobody knew they were having.
  if (batch.boardId) {
    const existing = await db.query.boards.findFirst({ where: eq(s.boards.id, batch.boardId) });
    if (existing) redirect(`/b/${existing.id}`);
  }
  const stored = parseReview(batch.review);
  const { targets, kinds } = await targetsFor(batch.workspaceId);
  const staged = withOverrides(stored.records, stored.overrides ?? {}).filter((r) => !(stored.removed ?? []).includes(r.id));
  const rows = applyDecisions(review(staged, targets, { kinds }).rows, stored.decisions);
  if (!rows.length) return { error: "There is nothing staged to draw." };

  const space = await db.query.spaces.findFirst({ where: eq(s.spaces.workspaceId, batch.workspaceId), orderBy: s.spaces.name });
  if (!space) return { error: "This workspace has no space to put a board in." };

  const title = `Staged · ${batch.name}`.slice(0, 120);
  const { document, drawn, summarised } = batchDocument(rows, { title, batchId });
  const user = await currentUser();
  const id = `brd_${nanoid(10)}`;
  await db.insert(s.boards).values({
    id,
    workspaceId: batch.workspaceId,
    spaceId: space.id,
    name: title,
    description: `${drawn} staged object${drawn === 1 ? "" : "s"}${summarised ? `, ${summarised} summarised` : ""}. Drag between lanes to decide; nothing is in the graph until the batch is approved.`,
    createdById: user.id,
    document: serializeDocument(document),
    createdAt: now(),
    updatedAt: now(),
    lastOpenedAt: now(),
  });
  await db.update(s.importBatches).set({ boardId: id, updatedAt: now() }).where(eq(s.importBatches.id, batchId));
  const slug = await slugOf(batch.workspaceId);
  if (slug) revalidatePath(`/w/${slug}`, "layout");
  redirect(`/b/${id}`);
}

/**
 * Draw the board again from what the batch now says.
 *
 * Needed when the mapping changes underneath it: re-reading a column re-stages every record, and
 * the cards on the board are then about claims that no longer exist. It replaces the document
 * rather than patching it, and says so — an arrangement somebody made by hand is worth keeping,
 * but not at the price of a board that quietly describes the wrong import.
 */
export async function redrawBatchBoard(batchId: string): Promise<{ ok: true; drawn: number } | { error: string }> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (!batch.boardId) return { error: "This batch has no board yet." };
  const board = await db.query.boards.findFirst({ where: eq(s.boards.id, batch.boardId) });
  if (!board) return { error: "That board has been deleted. Draw a new one." };

  const stored = parseReview(batch.review);
  const { targets, kinds } = await targetsFor(batch.workspaceId);
  const staged = withOverrides(stored.records, stored.overrides ?? {}).filter((r) => !(stored.removed ?? []).includes(r.id));
  const rows = applyDecisions(review(staged, targets, { kinds }).rows, stored.decisions);
  const { document, drawn } = batchDocument(rows, { title: board.name, batchId });
  await db.update(s.boards)
    .set({ document: serializeDocument(document), updatedAt: now(), revision: sql`${s.boards.revision} + 1` })
    .where(eq(s.boards.id, board.id));
  // Somebody may be standing on the board while it is redrawn under them (§5.40).
  await boardChangedElsewhere(board.id, document);
  await refresh(batch.workspaceId, batchId);
  return { ok: true, drawn };
}
