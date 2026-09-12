"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { currentUser } from "@/lib/session";
import { recordSince, snapshotEntities } from "@/lib/history/record";
import { currentActor } from "@/lib/history/current";
import { parseAttributes } from "@/lib/graph";
import { serializeDocument } from "@/canvas/document";
import { boardChangedElsewhere } from "@/lib/live/room";
import { proposeMapping } from "./map";
import { fetchAll, LeanIxError } from "@/lib/leanix/client";
import { toBatchFiles } from "@/lib/leanix/batch";
import { recordRead } from "@/lib/source/audit";
import { WriteRefused } from "@/lib/source/readonly";
import { readFile, readPasted } from "./read";
import { stage, type Decision } from "./stage";
import { claimsFrom, describeProse } from "./prose";
import { readDiagram } from "./diagram";
import { runPipeline } from "@/lib/intake/pipeline";
import { parsePassages } from "@/lib/intake/transcript";
import { extractWithModel } from "@/lib/intake/model";
import { vocabulary } from "@/lib/intake/vocabulary";
import { choose } from "@/lib/models/resolve";
import type { Db } from "@/db/client";
import type { MatchTarget } from "./match";
import { review } from "./review";
import { batchDocument } from "./board";
import { withOverrides } from "./reconcile";
import { applyBatch, PARENT_KEY, stageBatch as runStage, tabular, targetsFor as targetsForWorkspace, type BatchOrigin, type ImportApplied, type ImportOnto } from "./run";
import { applyDecisions, parseFiles, parseReview, parseWritten, type BatchFile, type StoredReview } from "./batch";

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
  return targetsForWorkspace(await getDb(), workspaceId);
}

/**
 * Stage whatever came through one of the doors.
 *
 * A thin wrapper now: the staging itself is `run.ts`, so the terminal and the button do the same
 * thing. What stays here is what only a request can answer — who is doing it, and which pages go
 * stale afterwards. Prose is read through the hook because it needs the model stack (§5.38).
 */
async function stageBatch(workspaceId: string, files: BatchFile[], origin: BatchOrigin, name?: string): Promise<{ id: string } | { error: string }> {
  const db = await getDb();
  const user = await currentUser();
  const staged = await runStage(db, {
    workspaceId, files, origin, name, createdById: user.id,
    readProse: (batchFiles) => readProse(db, workspaceId, batchFiles),
  });
  if ("id" in staged) await refresh(workspaceId, staged.id);
  return staged;
}

/** What a read file becomes in a batch: rows to map, or prose to read for claims (§5.15). */
function asBatchFile(read: ReturnType<typeof readFile>): BatchFile {
  if (read.shape === "table") {
    return { name: read.name, format: read.format, headers: read.headers, rows: read.rows, columns: proposeMapping(read.headers, read.rows), note: read.note };
  }
  if (read.shape === "image") {
    return {
      name: read.name, format: read.format, headers: [], rows: [], columns: [],
      image: { mediaType: read.mediaType, data: read.data, bytes: read.bytes }, note: read.note,
    };
  }
  return { name: read.name, format: read.format, headers: [], rows: [], columns: [], text: read.text, note: read.note };
}

/** Files somebody uploaded. */
export async function createBatch(form: FormData): Promise<{ id: string } | { error: string }> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const uploads = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!workspaceId) return { error: "No workspace." };
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
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
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
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
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
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

/**
 * Read a LeanIX workspace and stage it (§5.63).
 *
 * The whole point is how little is here. LeanIX arrives as batch files and then takes exactly the
 * road a spreadsheet takes — mapped, matched against what the graph already holds, reviewed row by
 * row, approved, drawn on a board, rolled back if it was wrong. An EA repository is a large import,
 * not a new kind of thing, and giving it its own private path would have meant a second review
 * screen to keep in step with the first.
 *
 * The token is used for this one call and never stored. It is a read credential to somebody's
 * whole estate; keeping it so the button can be pressed again is not worth what it costs to hold.
 */
export async function stageFromLeanIx(
  workspaceId: string,
  input: { host: string; token: string },
): Promise<{ id: string } | { error: string }> {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;

  // People paste the graphiql URL, because that is the page they were looking at.
  const host = input.host.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!host) return { error: "Which LeanIX host? Something like acme.leanix.net." };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return { error: `“${host}” does not look like a host name.` };
  if (!input.token.trim()) return { error: "A LeanIX API token, from Administration → API tokens." };

  /*
   * An enterprise gateway can sit in front of the API, and the same override is what lets this be
   * exercised without a licence. Named like `NEXUS_MODEL_BASE_URL` (§5.31), and deliberately not
   * something the browser can set: a caller who could choose the endpoint could choose where the
   * token goes.
   */
  const baseUrl = process.env.NEXUS_LEANIX_BASE_URL?.trim() || undefined;

  let dump;
  const startedAt = Date.now();
  try {
    dump = await fetchAll({ host, baseUrl, token: input.token.trim() });
  } catch (error) {
    /*
     * The read-only guard firing here means Nexus tried to send something that is not a read
     * (#111, §5.99) — a bug on this side, caught before it left the process, and worth saying so
     * rather than reporting it as a LeanIX failure, which it is not.
     */
    if (error instanceof WriteRefused) {
      return {
        error: `${error.message} Nothing was sent to ${host}. This is a fault in Nexus, not in your `
          + `workspace, and the safety audit under Settings → Safety explains the rule that stopped it.`,
      };
    }
    if (error instanceof LeanIxError) {
      const detail = typeof error.detail === "string" ? error.detail.trim().slice(0, 300) : "";
      return { error: detail ? `${error.message} It said: “${detail}”.` : error.message };
    }
    /*
     * A network error here is the common case and the confusing one: the server this runs on has
     * to be able to reach LeanIX, which is not the same question as whether your laptop can.
     */
    return {
      error: `Could not reach ${host}: ${error instanceof Error ? error.message : "unknown error"}. `
        + `This runs on the server, so it is the server's network that has to reach LeanIX.`,
    };
  }

  if (!dump.factSheets.length) return { error: "That workspace answered, but with no fact sheets the token can see." };

  /*
   * Written before the batch is staged, and only on a read that came back with something. The
   * audit panel's evidence is what actually crossed the wire, so it is recorded at the moment it
   * did rather than at the end of an import somebody may yet abandon.
   */
  const reader = await currentUser();
  await recordRead(await getDb(), {
    workspaceId,
    connector: "leanix",
    host,
    objects: dump.factSheets.length,
    relations: dump.relations.length,
    ms: Date.now() - startedAt,
    byId: reader?.id ?? null,
  });

  return stageBatch(workspaceId, toBatchFiles(dump), "EA repository", `LeanIX · ${dump.workspace}`);
}

/**
 * Read everything in the batch that is not a table: prose for claims (§5.38), and pictures for
 * the architecture drawn in them (§5.91).
 *
 * Both are the same step at the same moment, done once and stored on the file, because reading
 * is the one part of this pipeline that can cost money and a re-map must never re-read.
 */
async function readProse(db: Db, workspaceId: string, files: BatchFile[]): Promise<void> {
  const prose = files.filter((f) => f.text?.trim() && !f.claims);
  const pictures = files.filter((f) => f.image?.data && !f.claims);
  if (!prose.length && !pictures.length) return;

  const vocab = await vocabulary(workspaceId);
  const choice = await choose(db, workspaceId, "intake");

  /*
   * A picture needs a model, with no rules fallback — there is no reading a PNG with a regular
   * expression, and pretending otherwise would be an empty batch with no explanation. Saying so
   * on the file is the honest failure: the diagram stays with the batch and can be read the
   * moment a model is configured.
   */
  for (const file of pictures) {
    if (!choice) {
      file.claims = [];
      file.claimsNote = "A diagram can only be read by a model, and none is configured for intake. Set one up in Settings → Models and re-read this batch.";
      continue;
    }
    try {
      const read = await readDiagram({ name: file.name, mediaType: file.image!.mediaType, data: file.image!.data }, vocab.kinds ?? [], choice);
      file.claims = read.claims;
      file.claimsNote = read.note;
    } catch (error) {
      file.claims = [];
      file.claimsNote = `The picture could not be read: ${error instanceof Error ? error.message : "unknown error"}. It is kept with the batch.`;
    }
  }
  if (!prose.length) return;
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
  const notAllowed = await denyBatch(batchId, "graph.edit");
  if (notAllowed) return notAllowed;
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

const ROLES = new Set(["name", "kind", "description", "key", "attribute", "date", "person", "parent", "relation", "ignore"]);
function isRole(v: unknown): v is import("./map").Role {
  return Boolean(v) && typeof v === "object" && typeof (v as { as?: unknown }).as === "string" && ROLES.has((v as { as: string }).as);
}

/** Accept, hold or reject some rows. */
export async function decideRows(batchId: string, decisions: Array<{ id: string; decision: Decision }>): Promise<{ ok: true } | { error: string }> {
  const no = await denyBatch(batchId, "graph.edit");
  if (no) return no;
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
/**
 * The guard for the batch actions (§5.49).
 *
 * Staging, mapping columns and deciding lanes are a member's work — nothing has touched the model
 * yet, which is the whole point of a landing zone. Approving, rolling back and deleting a batch
 * are an administrator's: the first two rewrite the estate and the third destroys the record of
 * what happened.
 */
async function denyBatch(batchId: string, capability: "graph.edit" | "import.approve") {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  return deny(batch.workspaceId, capability);
}

export async function approveBatch(batchId: string, options?: { onto?: ImportOnto }): Promise<ImportApplied | { error: string }> {
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  /*
   * Approving is where a staged batch stops being a proposal (§5.46). Onto `main` that means it
   * becomes the estate everybody else reads; onto a branch it becomes a change set somebody has
   * still to merge, which moves nothing — but it is the same decision either way, so it asks for
   * the same power. Which of the two the branch merge itself needs is decided at the merge,
   * where `plan.deliver` is asked for.
   */
  const notAllowed = await deny(batch.workspaceId, "import.approve");
  if (notAllowed) return notAllowed;

  const user = await currentUser();
  const written = await applyBatch(db, batchId, user.id, { onto: options?.onto ?? "main" });
  if ("ok" in written) {
    await refresh(batch.workspaceId, batchId);
    // The branch is on the rail, the roadmap and the tree the moment it exists.
    if (written.changeSetId) revalidatePath("/", "layout");
  }
  return written;
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
  if (batch.status === "landed") return { error: "This batch is on a branch and never touched the estate. Abandon the branch instead." };
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
      let parentId = row.parentId ?? null;
      let changed = false;
      for (const update of written.updated.filter((u) => u.entityId === row.id)) {
        if (update.key === PARENT_KEY) {
          // Somebody has moved it since; where they put it is a later decision than this import's.
          if ((parentId ?? "") !== update.to) { kept++; notes.push(`“${row.name}” was left where it is: it is no longer inside what the import put it in.`); continue; }
          parentId = update.from || null;
          changed = true;
          restored++;
          continue;
        }
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
        await db.update(s.entities)
          .set({ kind, parentId, attributes: JSON.stringify(attributes), updatedAt: now() })
          .where(eq(s.entities.id, row.id));
      }
    }
  }

  await recordSince(db, history, { workspace: true }, before);
  await db.update(s.importBatches).set({ status: "rolled back", updatedAt: now() }).where(eq(s.importBatches.id, batchId));
  await refresh(batch.workspaceId, batchId);
  return { ok: true, deleted, restored, kept, notes: notes.slice(0, 20) };
}

export async function deleteBatch(batchId: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyBatch(batchId, "import.approve");
  if (no) return no;
  const db = await getDb();
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch) return { error: "That batch is gone." };
  if (batch.status === "approved") return { error: "An approved batch is the record of what happened to the graph; roll it back instead." };
  if (batch.status === "landed") return { error: "This batch is on a branch; the branch is the record. Abandon it on the roadmap." };
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
  const no = await denyBatch(batchId, "graph.edit");
  if (no) return no;
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
  const no = await denyBatch(batchId, "graph.edit");
  if (no) return no;
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
