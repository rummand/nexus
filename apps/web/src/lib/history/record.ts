import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "../attributes";
import { coalesce, diffEntities, isActorKind, isEventKind, MOMENT_MS, type Actor, type Change, type EntitySnapshot, type GraphEvent } from "./events";

/**
 * Writing the graph's memory down, and reading it back (§5.43).
 *
 * The design decision worth knowing: **history is observed, not declared.** Rather than asking
 * every one of the twenty-odd places that writes to the graph to also describe what it did — which
 * is twenty places to forget, and twenty descriptions that can be wrong — `remembering()` takes a
 * snapshot of the rows in scope, runs the write, snapshots again, and diffs. What gets recorded is
 * what actually happened to the database, so a code path that changes a description as a side
 * effect of a merge is in the history whether or not its author thought about it.
 *
 * The cost is one extra read per write, over a bounded set of rows. That is the right trade for a
 * system of record: the alternative is a log that agrees with the code's intentions rather than
 * with the data.
 */

export interface HistoryContext {
  workspaceId: string;
  actor: Actor;
  /** Where it happened, in words: "board: Application landscape", "import: cmdb.csv". */
  context?: string;
}

/**
 * Which rows to watch.
 *
 * `ids` for the common case, where the caller knows exactly what it is about to touch (a drawer
 * edit, a board save). `workspace` for the bulk operations — renaming a kind, importing a file,
 * merging — where the set is not knowable up front and the workspace is small enough to read.
 */
export type Scope = { ids: string[] } | { workspace: true };

function snapshot(row: { id: string; kind: string; name: string; description: string; attributes: string }): EntitySnapshot {
  return { id: row.id, kind: row.kind, name: row.name, description: row.description, attributes: parseAttributes(row.attributes) };
}

async function read(db: Db, workspaceId: string, scope: Scope): Promise<Map<string, EntitySnapshot>> {
  const rows =
    "workspace" in scope
      ? await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId))
      : scope.ids.length
        ? await db.select().from(s.entities).where(inArray(s.entities.id, scope.ids))
        : [];
  return new Map(rows.map((r) => [r.id, snapshot(r)]));
}

/**
 * Run a write and record what it did to the graph.
 *
 * Recording never fails the write. A history that can take down an edit is worse than one with a
 * gap in it — but the gap is logged, because a silent one is how you find out a year later that
 * the audit trail has been empty since March.
 */
export async function remembering<T>(db: Db, ctx: HistoryContext, scope: Scope, write: () => Promise<T>): Promise<T> {
  let before: Map<string, EntitySnapshot>;
  try {
    before = await snapshotEntities(db, ctx.workspaceId, scope);
  } catch (error) {
    console.error("[history] could not snapshot before the write", error);
    return write();
  }
  const result = await write();
  await recordSince(db, ctx, scope, before);
  return result;
}

/**
 * The two halves of `remembering`, for the long functions that cannot be wrapped in a callback.
 *
 * `approveBatch` and `rollbackBatch` are a hundred lines each with a dozen early returns; turning
 * them inside out to fit a closure would be a worse change than handing them the snapshot.
 */
export async function snapshotEntities(db: Db, workspaceId: string, scope: Scope = { workspace: true }) {
  return read(db, workspaceId, scope);
}

export async function recordSince(db: Db, ctx: HistoryContext, scope: Scope, before: Map<string, EntitySnapshot>) {
  try {
    const after = await read(db, ctx.workspaceId, scope);
    const events: Array<{ entity: EntitySnapshot; changes: Change[] }> = diffEntities(before, after);
    await writeEvents(db, ctx, events.flatMap(({ entity, changes }) => changes.map((c) => ({ entityId: entity.id, entityName: entity.name, ...c }))));
  } catch (error) {
    console.error("[history] the write happened but was not recorded", error);
  }
}

/**
 * Write events down, folding each into the one before it where it continues it.
 *
 * The folding is what makes an autosaved board bearable: eleven keystrokes and four saves become
 * one line saying what the name went from and to, and an edit that was undone within the window
 * leaves no line at all. See `coalesce`.
 */
export async function writeEvents(db: Db, ctx: HistoryContext, events: Array<Change & { entityId: string; entityName: string }>) {
  if (!events.length) return;
  const at = new Date().toISOString();
  const cutoff = new Date(Date.now() - MOMENT_MS).toISOString();
  const fresh: Array<Change & { entityId: string; entityName: string }> = [];

  for (const e of events) {
    const [prev] = await db
      .select()
      .from(s.entityEvents)
      .where(and(eq(s.entityEvents.entityId, e.entityId), eq(s.entityEvents.field, e.field), gte(s.entityEvents.at, cutoff)))
      .orderBy(desc(s.entityEvents.at), desc(s.entityEvents.id))
      .limit(1);

    // Somebody else's edit, or the same person somewhere else, ends the run: two hands on one
    // field is two facts.
    const sameHand = prev && prev.actorKind === ctx.actor.kind && (prev.actorId ?? null) === ctx.actor.id && prev.context === (ctx.context ?? "");
    const folded = coalesce(sameHand && isEventKind(prev.kind) ? { kind: prev.kind, field: prev.field, from: prev.fromValue, to: prev.toValue } : null, e);

    if (folded.action === "insert" || !prev) {
      fresh.push(e);
    } else if (folded.action === "drop") {
      await db.delete(s.entityEvents).where(eq(s.entityEvents.id, prev.id));
    } else {
      await db.update(s.entityEvents).set({ kind: folded.kind, fromValue: folded.from, toValue: folded.to, entityName: e.entityName, at }).where(eq(s.entityEvents.id, prev.id));
    }
  }

  if (!fresh.length) return;
  await db.insert(s.entityEvents).values(
    fresh.map((e) => ({
      id: `evt_${nanoid(12)}`,
      workspaceId: ctx.workspaceId,
      entityId: e.entityId,
      entityName: e.entityName,
      kind: e.kind,
      field: e.field,
      fromValue: e.from,
      toValue: e.to,
      actorKind: ctx.actor.kind,
      actorId: ctx.actor.id,
      actorName: ctx.actor.name,
      context: ctx.context ?? "",
      at,
    })),
  );
}

/**
 * A relation, appearing or disappearing — recorded on both ends.
 *
 * "What happened to Billing" has to include being connected to something, and a person reading
 * Billing's timeline should not have to know that the edge was drawn from the other direction.
 */
export async function recordRelationEvent(
  db: Db,
  ctx: HistoryContext,
  rel: { kind: "relationAdded" | "relationRemoved"; label: string; from: { id: string; name: string }; to: { id: string; name: string } },
) {
  const change: Change = { kind: rel.kind, field: rel.label.trim(), from: rel.from.name, to: rel.to.name };
  const ends = rel.from.id === rel.to.id ? [rel.from] : [rel.from, rel.to];
  try {
    await writeEvents(db, ctx, ends.map((end) => ({ ...change, entityId: end.id, entityName: end.name })));
  } catch (error) {
    console.error("[history] a relation change was not recorded", error);
  }
}

function toEvent(row: s.EntityEventRow): GraphEvent {
  return {
    id: row.id,
    entityId: row.entityId,
    entityName: row.entityName,
    // A row written by a future version, read by this one: show it rather than crash the page.
    kind: isEventKind(row.kind) ? row.kind : "attributeSet",
    field: row.field,
    from: row.fromValue,
    to: row.toValue,
    actor: { kind: isActorKind(row.actorKind) ? row.actorKind : "system", id: row.actorId, name: row.actorName },
    context: row.context,
    at: row.at,
  };
}

/** One entity's life, newest first. */
export async function entityHistory(db: Db, entityId: string, limit = 60): Promise<GraphEvent[]> {
  const rows = await db.select().from(s.entityEvents).where(eq(s.entityEvents.entityId, entityId)).orderBy(desc(s.entityEvents.at), desc(s.entityEvents.id)).limit(limit);
  return rows.map(toEvent);
}

/** Everything that happened in a workspace, newest first. `before` pages backwards through time. */
export async function workspaceHistory(db: Db, workspaceId: string, opts: { limit?: number; before?: string } = {}): Promise<GraphEvent[]> {
  const where = opts.before
    ? and(eq(s.entityEvents.workspaceId, workspaceId), lt(s.entityEvents.at, opts.before))
    : eq(s.entityEvents.workspaceId, workspaceId);
  const rows = await db
    .select()
    .from(s.entityEvents)
    .where(where)
    .orderBy(desc(s.entityEvents.at), desc(s.entityEvents.id))
    .limit(Math.min(opts.limit ?? 200, 500));

  /*
   * A relation is recorded on both of the things it joins, so that either one's own timeline is
   * complete. Read across the whole workspace that is one fact told twice, so the second copy is
   * dropped here rather than on the page — the count under the heading has to mean something.
   */
  const seen = new Set<string>();
  return rows.map(toEvent).filter((e) => {
    if (e.kind !== "relationAdded" && e.kind !== "relationRemoved") return true;
    const key = `${e.kind}|${e.field}|${e.from}|${e.to}|${e.at}|${e.actor.id ?? e.actor.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
