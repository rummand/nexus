import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { recordRelationEvent, recordSince, snapshotEntities } from "@/lib/history/record";
import * as who from "@/lib/history/actor";
import { applyDecisions, emptyWritten, parseReview, type BatchFile, type StoredReview, type Written } from "./batch";
import { proposeFileKind, proposeMapping } from "./map";
import type { MatchTarget } from "./match";
import { planImport, planTotals, type ImportIntent } from "./plan";
import { splitByRoute, splitWords } from "@/lib/source/trust";
import { standingFor, trustFor } from "@/lib/source/read";
import { review } from "./review";
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


/**
 * Where an approved import lands (§5.89, §5.90).
 *
 * `auto` is the one to reach for: it applies the two rules (§5.90) claim by claim, so the
 * routine half lands and the rest waits on a branch. `main` and `branch` are the overrides, for
 * an operator who has a reason.
 */
export type ImportOnto = "main" | "branch" | "auto";

export interface ImportApplied {
  ok: true;
  created: number;
  updated: number;
  connected: number;
  nested: number;
  /** The branch it landed on, when it landed on one. Null when it was written through. */
  changeSetId: string | null;
  /** How the two rules split it, when the rules were the ones deciding (§5.90). */
  split?: { through: number; held: number; seals: number; words: string };
}

/**
 * Approve a batch: work out what it does, then write it where it was told to.
 *
 * The judgement is `planImport` and lives outside this file. What is left here is two executors
 * over the same list of intentions — one that moves the estate and keeps a rollback record, one
 * that writes a change set nobody has merged yet. Keeping them side by side in one function is
 * deliberate: the moment they live apart, "what an import does" has two answers.
 */
export async function applyBatch(
  db: Db,
  batchId: string,
  approvedById: string,
  options?: { onto?: ImportOnto; branchName?: string },
): Promise<ImportApplied | { error: string }> {
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status === "approved") return { error: "This batch has already been approved." };
  if (batch.status === "landed") return { error: "This batch is already on a branch. Merge it there." };

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

  const [wired, hierarchy] = await Promise.all([
    db.select({ fromEntityId: s.relations_.fromEntityId, toEntityId: s.relations_.toEntityId, kind: s.relations_.kind })
      .from(s.relations_).where(eq(s.relations_.workspaceId, batch.workspaceId)),
    db.select({ id: s.entities.id, parentId: s.entities.parentId })
      .from(s.entities).where(eq(s.entities.workspaceId, batch.workspaceId)),
  ]);

  const { intents } = planImport({
    taking,
    targets,
    wired,
    hierarchy: hierarchy.map((e) => ({ id: e.id, parentId: e.parentId ?? null })),
    drawn: stored.drawn,
    mintEntityId: () => `ent_${nanoid(12)}`,
    mintRelationId: () => `rel_${nanoid(10)}`,
  });
  const totals = planTotals(intents);

  if (options?.onto === "branch") {
    const changeSetId = await landOnBranch(db, batch, intents, approvedById, options.branchName);
    return { ok: true, ...totals, changeSetId };
  }

  /*
   * The rules decide (§5.90). One approval, two destinations: what this source owns on objects
   * somebody has already reconciled goes straight in, and everything else — every new object,
   * every connection, every field this source has no standing over — waits on a branch.
   */
  if (options?.onto === "auto") {
    const trust = await trustFor(db, batch.workspaceId, {
      origin: batch.origin,
      detail: batch.name,
      name: batch.name,
    });
    const standing = await standingFor(db, batch.workspaceId, intents.map((i) => i.entityId));
    const split = splitByRoute(intents, trust, standing);

    const history = { workspaceId: batch.workspaceId, actor: who.importer(batch.name, batchId), context: `import: ${batch.name}` };
    const before = await snapshotEntities(db, batch.workspaceId);
    const written = split.through.length ? await writeThrough(db, batch, split.through, history) : { created: [], relations: [], updated: [], at: now() };
    if (split.through.length) await recordSince(db, history, { workspace: true }, before);

    /*
     * A validated value a source has just overwritten is not validated any more. Saying so here
     * rather than waiting for somebody to notice is the whole difference between a seal that
     * means something and a badge (§5.85).
     */
    const broke = split.routed.filter((r) => r.breaksSeal).map((r) => r.intent.entityId);
    if (broke.length) {
      // "Untouched" is the absence of a row (§5.85), so this deletes rather than sets: the
      // object goes back into the queue exactly as if nobody had ever looked at it, which is
      // the truth once a source has rewritten the value somebody signed off.
      await db.delete(s.campaignObjects)
        .where(and(inArray(s.campaignObjects.entityId, [...new Set(broke)]), eq(s.campaignObjects.state, "validated")));
    }

    const changeSetId = split.branch.length
      ? await landOnBranch(db, batch, split.branch, approvedById, options.branchName)
      : null;

    // The batch is only "landed" when something is actually waiting; otherwise it is done.
    await db.update(s.importBatches).set({
      ...(changeSetId ? {} : { status: "approved" as const }),
      written: JSON.stringify(written),
      approvedById,
      approvedAt: now(),
      updatedAt: now(),
    }).where(eq(s.importBatches.id, batchId));

    return {
      ok: true,
      ...planTotals(intents),
      changeSetId,
      split: { through: split.through.length, held: split.branch.length, seals: split.seals, words: splitWords(split) },
    };
  }

  // Everything an approval writes is one act by one import, so the history is taken across the
  // whole workspace and attributed to the batch (§5.43).
  const history = { workspaceId: batch.workspaceId, actor: who.importer(batch.name, batchId), context: `import: ${batch.name}` };
  const before = await snapshotEntities(db, batch.workspaceId);
  const written = await writeThrough(db, batch, intents, history);

  await recordSince(db, history, { workspace: true }, before);
  await db.update(s.importBatches).set({
    status: "approved",
    written: JSON.stringify(written),
    approvedById,
    approvedAt: now(),
    updatedAt: now(),
  }).where(eq(s.importBatches.id, batchId));
  return { ok: true, ...totals, changeSetId: null };
}

/**
 * Write the import into a change set of its own, and merge nothing.
 *
 * This is the whole of #137's first half: 455 creations, 378 relations and 236 reparents become
 * commits on a branch, the checks run against it (§5.88), and somebody merges — or does not, and
 * the shared model never saw the work. Rollback stops being a mechanism and becomes *do not
 * merge*, which is the only kind of undo that cannot get it wrong.
 *
 * The set is left a draft rather than planned: a draft is a proposal, which is what an unreviewed
 * import is, and both are things you may stand on (§5.82) to see the estate as it would be.
 */
async function landOnBranch(
  db: Db,
  batch: s.ImportBatch,
  intents: ImportIntent[],
  createdById: string,
  branchName?: string,
): Promise<string> {
  const changeSetId = `chg_${nanoid(10)}`;
  await db.insert(s.changeSets).values({
    id: changeSetId,
    workspaceId: batch.workspaceId,
    name: (branchName?.trim() || batch.name).slice(0, 120),
    description: `Imported from ${batch.origin}. Nothing here is in the estate until this is merged.`,
    targetDate: "",
    status: "draft",
    createdById,
    createdAt: now(),
    updatedAt: now(),
  });

  const rows = intents.map((intent) => ({
    id: `chn_${nanoid(10)}`,
    changeSetId,
    op: intent.op,
    entityId: intent.entityId || null,
    relationId: intent.relationId || null,
    payload: JSON.stringify(intent.payload),
    // Why, on every single one: a branch of 1,069 commits nobody can explain is not reviewable.
    note: noteFor(intent, batch.name),
    createdAt: now(),
  }));
  // In chunks: SQLite has a variable limit per statement, and an EA repository is thousands of rows.
  for (let at = 0; at < rows.length; at += 200) await db.insert(s.changes).values(rows.slice(at, at + 200));

  await db.update(s.importBatches).set({
    status: "landed",
    changeSetId,
    written: JSON.stringify(emptyWritten()),
    approvedById: createdById,
    approvedAt: now(),
    updatedAt: now(),
  }).where(eq(s.importBatches.id, batch.id));
  return changeSetId;
}

function noteFor(intent: ImportIntent, batchName: string): string {
  switch (intent.op) {
    case "addEntity": return `${batchName} has an object called “${intent.name}” that we do not.`;
    case "setAttribute": return intent.from
      ? `${batchName} says ${String(intent.payload.key)} is “${String(intent.payload.value)}”; we say “${intent.from}”.`
      : `${batchName} fills in ${String(intent.payload.key)}.`;
    case "retypeEntity": return `${batchName} calls this a ${String(intent.payload.kind)}; we call it a ${intent.from || "nothing"}.`;
    case "setParent": return `${batchName} puts this inside something else.`;
    default: return `${batchName} says these two are connected.`;
  }
}

/**
 * Write the import into the graph, keeping the record that makes a rollback honest.
 *
 * Attribute and type changes are grouped per object so a matched row is one UPDATE rather than
 * one per field — 455 objects with a dozen fields each is the normal case, and the difference is
 * minutes.
 */
async function writeThrough(
  db: Db,
  batch: s.ImportBatch,
  intents: ImportIntent[],
  history: { workspaceId: string; actor: ReturnType<typeof who.importer>; context: string },
): Promise<Written> {
  const written: Written = { created: [], relations: [], updated: [], at: now() };

  for (const intent of intents.filter((i) => i.op === "addEntity")) {
    await db.insert(s.entities).values({
      id: intent.entityId,
      workspaceId: batch.workspaceId,
      kind: String(intent.payload.kind ?? ""),
      name: String(intent.payload.name ?? ""),
      description: String(intent.payload.description ?? ""),
      attributes: JSON.stringify(intent.payload.attributes ?? {}),
      // Where it came from, as a fact on the row: "where did this object come from" becomes a
      // query rather than somebody's memory.
      source: `import:${batch.id}`,
      createdAt: now(),
      updatedAt: now(),
    });
    written.created.push(intent.entityId);
  }

  const edits = new Map<string, { attributes: Record<string, string>; kind: string | null }>();
  for (const intent of intents) {
    if (intent.op !== "setAttribute" && intent.op !== "retypeEntity") continue;
    const edit = edits.get(intent.entityId) ?? { attributes: {}, kind: null };
    if (intent.op === "setAttribute") {
      edit.attributes[String(intent.payload.key)] = String(intent.payload.value);
      written.updated.push({ entityId: intent.entityId, key: String(intent.payload.key), from: intent.from, to: String(intent.payload.value) });
    } else {
      edit.kind = String(intent.payload.kind);
      written.updated.push({ entityId: intent.entityId, key: "__kind", from: intent.from, to: String(intent.payload.kind) });
    }
    edits.set(intent.entityId, edit);
  }
  if (edits.size) {
    const rows = await db.select().from(s.entities).where(inArray(s.entities.id, [...edits.keys()]));
    for (const row of rows) {
      const edit = edits.get(row.id)!;
      await db.update(s.entities)
        .set({ kind: edit.kind ?? row.kind, attributes: JSON.stringify({ ...parseAttributes(row.attributes), ...edit.attributes }), updatedAt: now() })
        .where(eq(s.entities.id, row.id));
    }
  }

  for (const intent of intents.filter((i) => i.op === "addRelation")) {
    await db.insert(s.relations_).values({
      id: intent.relationId,
      workspaceId: batch.workspaceId,
      fromEntityId: String(intent.payload.fromEntityId),
      toEntityId: String(intent.payload.toEntityId),
      kind: String(intent.payload.kind),
      attributes: "{}",
      source: `import:${batch.id}`,
      createdAt: now(),
      updatedAt: now(),
    });
    written.relations.push(intent.relationId);
    const [from, to] = intent.name.split(" → ");
    await recordRelationEvent(db, history, {
      kind: "relationAdded",
      label: String(intent.payload.kind),
      from: { id: String(intent.payload.fromEntityId), name: from ?? "" },
      to: { id: String(intent.payload.toEntityId), name: to ?? "" },
    });
  }

  for (const intent of intents.filter((i) => i.op === "setParent")) {
    await db.update(s.entities).set({ parentId: String(intent.payload.parentId), updatedAt: now() }).where(eq(s.entities.id, intent.entityId));
    written.updated.push({ entityId: intent.entityId, key: PARENT_KEY, from: intent.from, to: String(intent.payload.parentId) });
  }

  return written;
}
