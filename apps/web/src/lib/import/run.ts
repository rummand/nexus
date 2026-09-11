import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { recordRelationEvent, recordSince, snapshotEntities } from "@/lib/history/record";
import * as who from "@/lib/history/actor";
import { applyDecisions, emptyWritten, parseReview, type BatchFile, type StoredReview, type Written } from "./batch";
import { proposeFileKind, proposeMapping } from "./map";
import { KEY_ATTRIBUTE, type MatchTarget } from "./match";
import { planParents } from "./parents";
import { review, type Reviewed } from "./review";
import { stage, type FileInput } from "./stage";
import { withOverrides } from "./reconcile";

/**
 * Staging a batch and writing an approved one — the work, without the request (§5.74).
 *
 * These two used to live in `actions.ts`, where every line of them was also a server action: they
 * read the signed-in user from the request, checked a capability against it, and asked Next to
 * revalidate a route when they were done. All three are things only a browser request has, which
 * meant a whole estate could be imported *only* by somebody clicking a button in a tab.
 *
 * That is the right door for almost everybody and the wrong one for an operator: a first import of
 * a real workspace is four hundred objects and several minutes, run once, often from a terminal on
 * the server itself. So the work takes a database and the id of whoever is answerable for it, and
 * the server actions stay what they should have been — a guard, a call, and a revalidation.
 *
 * Nothing about what gets written changed. There is exactly one implementation of "what an
 * approved import does to the graph", and both doors go through it, which is the only way the
 * terminal and the button can be trusted to agree.
 */

/*
 * Everything the stager reads, in the batch's own trust order: a table contributes rows, a document
 * contributes claims, and both are folded into the same records (§5.38). Keeping them in one list
 * is what makes "put the governance review above the 2019 spreadsheet" an ordinary reorder.
 */
export const tabular = (files: BatchFile[]): FileInput[] =>
  files
    .filter((f) => f.rows.length || f.claims?.length)
    .map((f) => ({ name: f.name, headers: f.headers, rows: f.rows, columns: f.columns, kind: f.kind, claims: f.claims }));

/**
 * How a change of parent is written down in the rollback record.
 *
 * The same shape as `__kind`: a pseudo-key beside the attributes, holding the id that was there
 * before. Containment is a column rather than an attribute, so it cannot be recorded as one, and
 * a rollback that could not undo it would be a rollback that lies.
 */
export const PARENT_KEY = "__parent";

const now = () => new Date().toISOString();
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** The kinds and names this workspace already knows, as something to match a batch against. */
export async function targetsFor(db: Db, workspaceId: string): Promise<{ targets: MatchTarget[]; kinds: string[] }> {
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
 *
 * `readProse` is a hook rather than a call, because reading documents for claims needs the model
 * stack and a LeanIX pull has no prose in it at all: the operator path should not have to carry a
 * model configuration to import a table.
 */
export type BatchOrigin = "files" | "paste" | "connected system" | "EA repository";

export async function stageBatch(
  db: Db,
  input: { workspaceId: string; files: BatchFile[]; origin: BatchOrigin; name?: string; createdById: string; readProse?: (files: BatchFile[]) => Promise<void> },
): Promise<{ id: string } | { error: string }> {
  const { workspaceId, files, origin, name, createdById } = input;
  if (!files.length) return { error: "There was nothing readable in that." };

  // The names this workspace already knows, so a column of names can be told from a column of
  // adjectives. The batch's own names are added by the first pass below.
  const { targets, kinds: vocabulary } = await targetsFor(db, workspaceId);
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
    // A source that knows its own schema keeps it. Everything else is guessed, as before.
    if (file.declared) continue;
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
  await input.readProse?.(files);

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
    createdById,
    createdAt: now(),
    updatedAt: now(),
  });
  return { id };
}


export async function applyBatch(
  db: Db,
  batchId: string,
  approvedById: string,
): Promise<{ ok: true; created: number; updated: number; connected: number; nested: number } | { error: string }> {
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status === "approved") return { error: "This batch has already been approved." };
  // Everything an approval writes is one act by one import, so the history is taken across the
  // whole workspace and attributed to the batch (§5.43).
  const history = { workspaceId: batch.workspaceId, actor: who.importer(batch.name, batchId), context: `import: ${batch.name}` };
  const before = await snapshotEntities(db, batch.workspaceId);

  const stored = parseReview(batch.review);
  const { targets, kinds } = await targetsFor(db, batch.workspaceId);
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

  /*
   * Containment last of all (§5.74). A parent is only a name until every row has an id, and it is
   * deliberately not written as an edge: the graph holds "inside" as a column, which is what
   * ancestry, roll-up and the capability map read. Writing both would be two facts to keep in step.
   */
  const nested = await applyParents(db, batch.workspaceId, taking, idOf, byName, written);

  await recordSince(db, history, { workspace: true }, before);
  await db.update(s.importBatches).set({
    status: "approved",
    written: JSON.stringify(written),
    approvedById,
    approvedAt: now(),
    updatedAt: now(),
  }).where(eq(s.importBatches.id, batchId));
  return {
    ok: true,
    created: written.created.length,
    updated: new Set(written.updated.filter((u) => u.key !== PARENT_KEY).map((u) => u.entityId)).size,
    connected: written.relations.length,
    nested,
  };
}

/**
 * Put each object inside the one its row named.
 *
 * Three things make this its own pass rather than a line in the loop above. A parent is a name
 * until every row has been written, so it cannot be resolved earlier. A cycle is a real
 * possibility — an export can say A is inside B and B inside A, and a ring in the hierarchy is
 * what makes every reader of the tree hang — so each move is checked against the tree as it
 * stands, including the moves this batch has already made. And a move that cannot be made is
 * skipped rather than failed: the object still arrives, at the top, which is exactly what an
 * unresolvable parent means.
 */
async function applyParents(
  db: Db,
  workspaceId: string,
  taking: Reviewed[],
  idOf: Map<string, string>,
  byName: Map<string, string>,
  written: Written,
): Promise<number> {
  const wanted = taking
    .map((row) => ({ id: idOf.get(row.record.id) ?? "", parent: (row.record.parent ?? "").trim() }))
    .filter((row) => row.id && row.parent);
  if (!wanted.length) return 0;

  // The whole workspace, not only this batch: a loop can run through objects nothing here mentions.
  const all = await db.select({ id: s.entities.id, parentId: s.entities.parentId })
    .from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const moves = planParents(wanted, (name) => byName.get(norm(name)), all.map((e) => ({ id: e.id, parentId: e.parentId ?? null })));

  for (const move of moves) {
    await db.update(s.entities).set({ parentId: move.parentId, updatedAt: now() }).where(eq(s.entities.id, move.id));
    written.updated.push({ entityId: move.id, key: PARENT_KEY, from: move.from, to: move.parentId });
  }
  return moves.length;
}
