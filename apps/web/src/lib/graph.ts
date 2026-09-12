import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { cardColorForKind, isBoxElement, type CanvasDocument, type CanvasElement, type CardElement } from "@/canvas/document";
import { card, connect, frame, textBlock } from "@/canvas/templates";
import { ENTITY_ID_PREFIX, isEntityId, isRelationId, RELATION_ID_PREFIX, type EntityDetail, type GraphSnapshot, type ImportPayload, type ImportResult } from "./graph-types";
import { parseAttributes } from "./attributes";
import { entityHistory, recordRelationEvent, remembering } from "./history/record";
import * as who from "./history/actor";
import type { Actor } from "./history/events";
import { ancestry, descendants } from "./hierarchy";
import { drawnNote, routeCard, routeRelation } from "./change/board-write";
import { openBoardSet } from "./change/board-set";
import { MAIN, type Ref } from "./change/ref";

// Re-exported so the many callers that reach for it through the graph module keep working.
export { parseAttributes };

/**
 * Knowledge graph ↔ board synchronisation.
 *
 * Boards are views: a card whose `meta.entityId` is set is the canvas face of an entity,
 * a connector with `meta.relationId` between two such cards is the face of a relation.
 * `syncBoardToGraph` runs on every save (board → graph, last write wins);
 * `hydrateDocument` runs on every load (graph → board) so edits made on other boards or
 * through imports show up everywhere.
 */

const now = () => new Date().toISOString();


function cleanAttributes(attrs: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) if (k.trim() && String(v).trim()) out[k.trim()] = String(v).trim();
  return out;
}

function sameAttributes(a: Record<string, string>, b: Record<string, string>) {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  return ak.length === bk.length && ak.every((k, i) => k === bk[i] && a[k] === b[k]);
}

type Elements = CanvasDocument["elements"];

/**
 * Cards that are the canvas face of a graph entity.
 *
 * A card marked `planned` is deliberately excluded (§5.21). Placing a system a change set intends
 * to introduce puts a picture of an intention on the board; if the sync treated it like any other
 * card it would create the entity on the next autosave, quietly delivering part of a plan nobody
 * approved. It becomes a real card the moment the change set is delivered and the entity exists —
 * `hydrateDocument` clears the mark then.
 */
function entityCards(elements: Elements): Array<CardElement & { entityId: string }> {
  const out: Array<CardElement & { entityId: string }> = [];
  for (const el of Object.values(elements)) {
    if (el.type === "card" && isEntityId(el.meta?.entityId) && !el.meta?.planned) out.push(Object.assign(el, { entityId: el.meta.entityId }));
  }
  return out;
}

/**
 * A frame that *is* an object, not just a box around some (§5.75).
 *
 * A capability with things inside it is drawn as a frame, and until rev 112 that made it a label:
 * the entity it stood for was not on the board, not in the board's index, and not clickable. So a
 * frame may carry an `entityId` too — but only ever to bind to an object that already exists.
 * Renaming the frame renames it, which is the one edit a frame can express; it cannot create an
 * object, because a frame carries no kind and an untyped object is a mess somebody else has to
 * clean up. Cards remain the full face of an entity.
 */
function entityFrames(elements: Elements): Array<{ id: string; entityId: string; title: string }> {
  const out: Array<{ id: string; entityId: string; title: string }> = [];
  for (const el of Object.values(elements)) {
    if (el.type === "frame" && isEntityId(el.meta?.entityId) && !el.meta?.planned) {
      out.push({ id: el.id, entityId: el.meta.entityId, title: el.title });
    }
  }
  return out;
}

/**
 * Board → graph, with the history the save makes (§5.43).
 *
 * `actor` is the person whose save this is, when the caller knows — a board save is the commonest
 * way the graph changes, and "the board changed it" is a much poorer answer than "Maria changed it
 * on the Application landscape". Callers that genuinely cannot say (a restore, a scheduled
 * persist) leave it out and the board itself is named as the actor.
 */
export interface SyncOptions {
  /** The person whose save this is, for the history. */
  actor?: Actor;
  /** Where they are standing (§5.82). New objects become proposals on this ref. */
  ref?: Ref;
  /** Who to name as the author of a change set the board opens for itself. */
  userId?: string | null;
  /**
   * Write new objects straight into the estate, bypassing the proposal rule.
   *
   * For callers that are *constructing an estate* rather than standing at a canvas: the seed,
   * whose demo workspace would teach the wrong thing on the first screen if every object in it
   * were an unreviewed proposal, and the tests that need an estate to exist before they can
   * assert anything about it. Named rather than inferred, so that a caller who wants it has to
   * write it down and defend it in review. No request path passes it.
   */
  writeThrough?: boolean;
}

export async function syncBoardToGraph(db: Db, board: { id: string; workspaceId: string; name?: string }, doc: CanvasDocument, options: SyncOptions = {}) {
  const { actor, userId } = options;
  const ref = options.ref ?? MAIN;
  const writeThrough = options.writeThrough ?? false;
  const cards = entityCards(doc.elements);
  const framed = entityFrames(doc.elements);
  const ids = [...new Set([...cards.map((c) => c.entityId), ...framed.map((f) => f.entityId)])];
  const existing = ids.length ? await db.select().from(s.entities).where(inArray(s.entities.id, ids)) : [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  const ts = now();
  const history = { workspaceId: board.workspaceId, actor: actor ?? who.board(board.name ?? "A board", board.id), context: board.name ? `board: ${board.name}` : "a board" };

  /*
   * Where a new object goes (#149, §5.100).
   *
   * Not into the estate. `routeCard` says "propose" for anything with no row yet, on every ref,
   * because the import door has refused to let anything new land unseen since §5.90 and a model
   * is only as trustworthy as its least governed door. The branch is the one you are standing on,
   * or one the board opens for itself. Resolved lazily: a save that introduces nothing new must
   * not open a change set, or every board would grow an empty branch on its first autosave.
   */
  let target: string | null = ref.kind === "set" ? ref.id : null;
  const proposeTo = async (): Promise<string> => {
    target ??= await openBoardSet(db, board, userId);
    return target;
  };
  const proposed: string[] = [];

  await remembering(db, history, { ids }, async () => {
    for (const c of cards) {
      const cur = byId.get(c.entityId);
      const attrs = cleanAttributes(c.attributes);
      const differs = Boolean(cur) && (cur!.kind !== c.kind.trim() || cur!.name !== c.title.trim() || cur!.description !== c.description.trim() || !sameAttributes(parseAttributes(cur!.attributes), attrs));
      const route = writeThrough && !cur ? "through" : routeCard({ exists: Boolean(cur), differs });
      if (route === "skip") continue;
      if (!cur) {
        if (route === "propose") {
          await proposeEntity(db, await proposeTo(), c.entityId, { kind: c.kind.trim(), name: c.title.trim(), description: c.description.trim(), attributes: attrs }, drawnNote(board.name ?? ""));
          proposed.push(c.entityId);
          continue;
        }
        await db.insert(s.entities).values({ id: c.entityId, workspaceId: board.workspaceId, kind: c.kind.trim(), name: c.title.trim(), description: c.description.trim(), attributes: JSON.stringify(attrs), source: "canvas", createdAt: ts, updatedAt: ts });
      } else if (cur.workspaceId === board.workspaceId) {
        /*
         * An edit to something already in the estate still writes through, on main and on a
         * branch alike. Deliberate, and the honest limit of this slice: the change model has no
         * op that carries a name, so routing an edit would silently drop every rename. #149
         * carries the rest.
         */
        await db.update(s.entities).set({ kind: c.kind.trim(), name: c.title.trim(), description: c.description.trim(), attributes: JSON.stringify(attrs), updatedAt: ts }).where(eq(s.entities.id, c.entityId));
      }
    }
    // A framed object: the title is the only thing it can say, and it never creates.
    for (const f of framed) {
      const cur = byId.get(f.entityId);
      if (!cur || cur.workspaceId !== board.workspaceId) continue;
      if (cur.name === f.title.trim() || !f.title.trim()) continue;
      await db.update(s.entities).set({ name: f.title.trim(), updatedAt: ts }).where(eq(s.entities.id, f.entityId));
    }
  });

  // relations from connectors between entity-backed cards
  const cardEntity = new Map(cards.map((c) => [c.id, c.entityId]));
  const relRows: Array<{ id: string; from: string; to: string; kind: string }> = [];
  for (const el of Object.values(doc.elements)) {
    if (el.type !== "connector" || !isRelationId(el.meta?.relationId)) continue;
    if (!("elementId" in el.from) || !("elementId" in el.to)) continue;
    const from = cardEntity.get(el.from.elementId);
    const to = cardEntity.get(el.to.elementId);
    if (!from || !to) continue;
    relRows.push({ id: el.meta.relationId, from, to, kind: el.label.trim() });
  }
  if (relRows.length) {
    const existingRels = await db.select().from(s.relations_).where(inArray(s.relations_.id, relRows.map((r) => r.id)));
    const relById = new Map(existingRels.map((r) => [r.id, r]));
    const nameOf = (entityId: string) => cards.find((c) => c.entityId === entityId)?.title.trim() ?? byId.get(entityId)?.name ?? "";
    const proposedIds = new Set(proposed);
    for (const r of relRows) {
      const cur = relById.get(r.id);
      const differs = Boolean(cur) && (cur!.kind !== r.kind || cur!.fromEntityId !== r.from || cur!.toEntityId !== r.to);
      const route = writeThrough && !cur ? "through" : routeRelation({ exists: Boolean(cur), differs });
      if (route === "skip") continue;
      if (!cur) {
        /*
         * A connection is a modelling claim, not a field value — the same reason `routeOf` holds
         * `addRelation` back from a source. And a relation whose end is itself only proposed
         * *must* travel with it: writing it through would be a foreign key into an object that
         * does not exist.
         */
        if (route === "propose" || proposedIds.has(r.from) || proposedIds.has(r.to)) {
          await proposeRelation(db, await proposeTo(), r.id, { fromEntityId: r.from, toEntityId: r.to, kind: r.kind }, drawnNote(board.name ?? ""));
          continue;
        }
        await db.insert(s.relations_).values({ id: r.id, workspaceId: board.workspaceId, fromEntityId: r.from, toEntityId: r.to, kind: r.kind, source: "canvas", createdAt: ts, updatedAt: ts });
        await recordRelationEvent(db, history, { kind: "relationAdded", label: r.kind, from: { id: r.from, name: nameOf(r.from) }, to: { id: r.to, name: nameOf(r.to) } });
      } else {
        await db.update(s.relations_).set({ kind: r.kind, fromEntityId: r.from, toEntityId: r.to, updatedAt: ts }).where(eq(s.relations_.id, r.id));
      }
    }
  }

  // board ↔ entity index
  await db.delete(s.boardEntities).where(eq(s.boardEntities.boardId, board.id));
  const proposedIds = new Set(proposed);
  const placed = [
    // A proposed object has no row in `entities` yet, and a foreign key into one that does not
    // exist fails the insert. It joins the index when its change set is delivered and the next
    // save finds it real.
    ...cards.filter((c) => !proposedIds.has(c.entityId)).map((c) => ({ boardId: board.id, entityId: c.entityId, elementId: c.id })),
    // A framed object is on the board as much as a card is: it is where the thing sits.
    ...framed.filter((f) => byId.has(f.entityId)).map((f) => ({ boardId: board.id, entityId: f.entityId, elementId: f.id })),
  ];
  if (placed.length) {
    await db.insert(s.boardEntities).values(placed).onConflictDoNothing();
  }
}

/**
 * Record a drawn object as a proposal on a ref (#149, §5.100).
 *
 * Upserted by entity id rather than appended, because a board autosaves while somebody is still
 * typing into the card: appending would put one change per keystroke-flush in front of a reviewer
 * and call it a plan. The newest state of the card is the proposal.
 */
async function proposeEntity(
  db: Db,
  changeSetId: string,
  entityId: string,
  payload: { kind: string; name: string; description: string; attributes: Record<string, string> },
  note: string,
): Promise<void> {
  const existing = await db.query.changes.findFirst({
    where: and(eq(s.changes.changeSetId, changeSetId), eq(s.changes.entityId, entityId), eq(s.changes.op, "addEntity")),
  });
  const body = JSON.stringify(payload);
  if (existing) {
    if (existing.payload !== body) await db.update(s.changes).set({ payload: body }).where(eq(s.changes.id, existing.id));
    return;
  }
  await db.insert(s.changes).values({
    id: `chn_${nanoid(10)}`, changeSetId, op: "addEntity", entityId, relationId: null, payload: body, note, createdAt: now(),
  });
}

/** The same, for a connection drawn between two cards. */
async function proposeRelation(
  db: Db,
  changeSetId: string,
  relationId: string,
  payload: { fromEntityId: string; toEntityId: string; kind: string },
  note: string,
): Promise<void> {
  const existing = await db.query.changes.findFirst({
    where: and(eq(s.changes.changeSetId, changeSetId), eq(s.changes.relationId, relationId), eq(s.changes.op, "addRelation")),
  });
  const body = JSON.stringify(payload);
  if (existing) {
    if (existing.payload !== body) await db.update(s.changes).set({ payload: body }).where(eq(s.changes.id, existing.id));
    return;
  }
  await db.insert(s.changes).values({
    id: `chn_${nanoid(10)}`, changeSetId, op: "addRelation", entityId: null, relationId, payload: body, note, createdAt: now(),
  });
}

/** Cards placed from a change set: pictures of an intention, not yet backed by an entity (§5.21). */
function plannedCards(elements: Elements): Array<CardElement & { entityId: string }> {
  const out: Array<CardElement & { entityId: string }> = [];
  for (const el of Object.values(elements)) {
    if (el.type === "card" && el.meta?.planned && isEntityId(el.meta?.entityId)) out.push(Object.assign(el, { entityId: el.meta.entityId }));
  }
  return out;
}

/** Refresh entity-backed cards and relation connectors from the graph. */
export async function hydrateDocument(db: Db, doc: CanvasDocument): Promise<CanvasDocument> {
  const doc2 = await promotePlanned(db, doc);
  const cards = entityCards(doc2.elements);
  if (cards.length === 0) return doc2;
  doc = doc2;
  const rows = await db.select().from(s.entities).where(inArray(s.entities.id, cards.map((c) => c.entityId)));
  const byId = new Map(rows.map((e) => [e.id, e]));
  const elements: Elements = { ...doc.elements };

  for (const c of cards) {
    const e = byId.get(c.entityId);
    if (!e) continue;
    const attrs = parseAttributes(e.attributes);
    if (e.kind !== c.kind || e.name !== c.title || e.description !== c.description || !sameAttributes(attrs, cleanAttributes(c.attributes))) {
      const color = e.kind !== c.kind ? cardColorForKind(e.kind) : c.color;
      const { entityId: _drop, ...rest } = c;
      void _drop;
      elements[c.id] = { ...rest, kind: e.kind, title: e.name, description: e.description, color, attributes: attrs } as CanvasElement;
    }
  }
  const relIds = Object.values(doc.elements).filter((el) => el.type === "connector" && isRelationId(el.meta?.relationId)).map((el) => el.meta!.relationId as string);
  if (relIds.length) {
    const rels = await db.select().from(s.relations_).where(inArray(s.relations_.id, relIds));
    const relById = new Map(rels.map((r) => [r.id, r]));
    for (const el of Object.values(elements)) {
      if (el.type !== "connector" || !isRelationId(el.meta?.relationId)) continue;
      const r = relById.get(el.meta.relationId);
      if (r && r.kind !== el.label) elements[el.id] = { ...el, label: r.kind };
    }
  }

  /*
   * Which cards are still proposals (#149, §5.100).
   *
   * Last, and over `elements` rather than the document, so it wins over the field sync above
   * instead of being quietly overwritten by it. Derived on every open rather than trusted from
   * the document: the flag is a rendering hint and the change is the record, so a stale one
   * persisted by an older client is corrected here rather than telling somebody their object is
   * uncommitted long after it landed.
   *
   * Note this is *not* `planned` (§5.21). A planned card is excluded from the sync; a proposed
   * one must keep syncing, because the person is still editing it and the proposal is meant to
   * track what they typed.
   */
  const missing = cards.filter((c) => !byId.has(c.entityId)).map((c) => c.entityId);
  const proposals = missing.length
    ? await db
        .select({ entityId: s.changes.entityId, setId: s.changeSets.id, setName: s.changeSets.name })
        .from(s.changes)
        .innerJoin(s.changeSets, eq(s.changes.changeSetId, s.changeSets.id))
        .where(and(inArray(s.changes.entityId, missing), eq(s.changes.op, "addEntity")))
    : [];
  const proposalOf = new Map(proposals.filter((r) => r.entityId).map((r) => [r.entityId!, r]));
  for (const c of cards) {
    const at = elements[c.id];
    if (!at) continue;
    const proposal = proposalOf.get(c.entityId);
    if (proposal) {
      elements[c.id] = { ...at, meta: { ...at.meta, proposed: true, proposedIn: proposal.setId, proposedInName: proposal.setName } };
      continue;
    }
    if (at.meta?.proposed) {
      const { proposed: _p, proposedIn: _i, proposedInName: _n, ...meta } = at.meta;
      void _p; void _i; void _n;
      elements[c.id] = { ...at, meta };
    }
  }
  return { ...doc, elements };
}

/**
 * A planned card becomes a real one when its change set is delivered.
 *
 * The mark is cleared here rather than by the delivery, because a change set does not know which
 * boards drew it — and this is the moment the board is being read anyway. From then on the card
 * behaves like any other: it syncs, it hydrates, it is the entity's face.
 */
async function promotePlanned(db: Db, doc: CanvasDocument): Promise<CanvasDocument> {
  const planned = plannedCards(doc.elements);
  if (!planned.length) return doc;
  const rows = await db.select({ id: s.entities.id }).from(s.entities).where(inArray(s.entities.id, planned.map((c) => c.entityId)));
  const real = new Set(rows.map((r) => r.id));
  if (!real.size) return doc;
  const elements: Elements = { ...doc.elements };
  for (const c of planned) {
    if (!real.has(c.entityId)) continue;
    const { planned: _drop, ...meta } = c.meta ?? {};
    void _drop;
    const { entityId: _drop2, ...rest } = c;
    void _drop2;
    elements[c.id] = { ...rest, meta } as CanvasElement;
  }
  return { ...doc, elements };
}

export async function graphSnapshot(db: Db, workspaceId: string): Promise<GraphSnapshot> {
  const rows = await db
    .select({
      e: s.entities,
      // NB: qualify the outer column by hand — Drizzle renders `${s.entities.id}` as a bare "id"
      // inside a subquery, which SQLite resolves against the inner table.
      boardCount: sql<number>`(select count(distinct b.board_id) from board_entities b where b.entity_id = entities.id)`,
      relationCount: sql<number>`(select count(*) from relations r where r.from_entity_id = entities.id or r.to_entity_id = entities.id)`,
    })
    .from(s.entities)
    .where(eq(s.entities.workspaceId, workspaceId))
    .orderBy(s.entities.kind, s.entities.name);
  const boardRows = rows.length
    ? await db
        .select({ entityId: s.boardEntities.entityId, boardId: s.boards.id, name: s.boards.name })
        .from(s.boardEntities)
        .innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id))
        .where(inArray(s.boardEntities.entityId, rows.map((r) => r.e.id)))
    : [];
  const boardsByEntity = new Map<string, Array<{ id: string; name: string }>>();
  for (const b of boardRows) {
    const list = boardsByEntity.get(b.entityId) ?? [];
    if (!list.some((x) => x.id === b.boardId)) list.push({ id: b.boardId, name: b.name });
    boardsByEntity.set(b.entityId, list);
  }
  const kindCounts = new Map<string, number>();
  const kindAttrs = new Map<string, Map<string, { count: number; sample: string }>>();
  for (const r of rows) {
    kindCounts.set(r.e.kind, (kindCounts.get(r.e.kind) ?? 0) + 1);
    const attrs = parseAttributes(r.e.attributes);
    const m = kindAttrs.get(r.e.kind) ?? new Map();
    for (const [k, v] of Object.entries(attrs)) {
      const cur = m.get(k) ?? { count: 0, sample: v };
      m.set(k, { count: cur.count + 1, sample: cur.sample });
    }
    kindAttrs.set(r.e.kind, m);
  }
  const relKinds = await db
    .select({ kind: s.relations_.kind, count: sql<number>`count(*)` })
    .from(s.relations_)
    .where(eq(s.relations_.workspaceId, workspaceId))
    .groupBy(s.relations_.kind);
  return {
    entities: rows.map((r) => ({
      id: r.e.id,
      kind: r.e.kind,
      name: r.e.name,
      description: r.e.description,
      attributes: parseAttributes(r.e.attributes),
      parentId: r.e.parentId ?? null,
      source: r.e.source,
      updatedAt: r.e.updatedAt,
      boardCount: r.boardCount,
      relationCount: r.relationCount,
      boards: boardsByEntity.get(r.e.id) ?? [],
    })),
    kinds: [...kindCounts.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({
      kind,
      count,
      color: cardColorForKind(kind),
      attributeKeys: [...(kindAttrs.get(kind) ?? new Map<string, { count: number; sample: string }>()).entries()].sort((a, b) => b[1].count - a[1].count).map(([key, v]) => ({ key, count: v.count, sample: v.sample })),
    })),
    relationKinds: relKinds.map((r) => ({ kind: r.kind, count: r.count })).sort((a, b) => b.count - a.count),
  };
}

export async function entityDetail(db: Db, entityId: string): Promise<EntityDetail | null> {
  const entity = await db.query.entities.findFirst({ where: eq(s.entities.id, entityId) });
  if (!entity) return null;
  const boards = await db
    .select({ id: s.boards.id, name: s.boards.name, spaceName: s.spaces.name })
    .from(s.boardEntities)
    .innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id))
    .innerJoin(s.spaces, eq(s.boards.spaceId, s.spaces.id))
    .where(eq(s.boardEntities.entityId, entityId));
  const rels = await db.select().from(s.relations_).where(sql`${s.relations_.fromEntityId} = ${entityId} or ${s.relations_.toEntityId} = ${entityId}`);
  const otherIds = rels.map((r) => (r.fromEntityId === entityId ? r.toEntityId : r.fromEntityId));
  const others = otherIds.length ? await db.select().from(s.entities).where(inArray(s.entities.id, otherIds)) : [];
  const otherById = new Map(others.map((o) => [o.id, o]));
  const seenBoards = new Set<string>();
  const dupes = entity.name.trim()
    ? (await db.select().from(s.entities).where(and(eq(s.entities.workspaceId, entity.workspaceId), sql`lower(trim(${s.entities.name})) = ${entity.name.trim().toLowerCase()}`))).filter((d) => d.id !== entity.id)
    : [];
  const sameKind = await db.select({ attributes: s.entities.attributes }).from(s.entities).where(and(eq(s.entities.workspaceId, entity.workspaceId), eq(s.entities.kind, entity.kind)));
  const keyCounts = new Map<string, number>();
  for (const row of sameKind) for (const k of Object.keys(parseAttributes(row.attributes))) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);

  /*
   * Where it sits (§5.70). One read of the workspace's shape — id, parent, name, kind — which
   * is small enough to hold at the explorer's cap and is needed three times over: for the
   * breadcrumb up, the children below, and for working out which parents a move may offer
   * without making a loop.
   */
  const shape = await db
    .select({ id: s.entities.id, parentId: s.entities.parentId, name: s.entities.name, kind: s.entities.kind })
    .from(s.entities)
    .where(eq(s.entities.workspaceId, entity.workspaceId));
  const chain = ancestry(shape, entityId).map((e) => ({ id: e.id, name: e.name, kind: e.kind }));
  const below = new Set(descendants(shape, entityId));
  const kids = shape
    .filter((e) => e.parentId === entityId)
    .map((e) => ({ id: e.id, name: e.name, kind: e.kind, beneath: descendants(shape, e.id).length }))
    .sort((a, b) => b.beneath - a.beneath || a.name.localeCompare(b.name));
  const parentOptions = shape
    .filter((e) => e.id !== entityId && !below.has(e.id) && e.id !== entity.parentId)
    .map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      // Where it sits, so the three things called "Asset Register" can be told apart.
      path: ancestry(shape, e.id).slice(0, -1).map((a) => a.name).join(" › "),
    }))
    .sort((a, b) => `${a.path} ${a.name}`.localeCompare(`${b.path} ${b.name}`));

  return {
    ancestry: chain,
    children: kids,
    beneath: below.size,
    parentOptions,
    entity: { id: entity.id, kind: entity.kind, name: entity.name, description: entity.description, attributes: parseAttributes(entity.attributes), source: entity.source, updatedAt: entity.updatedAt },
    kindAttributeKeys: [...keyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
    duplicates: dupes.map((d) => ({ id: d.id, kind: d.kind, name: d.name, description: d.description })),
    boards: boards.filter((b) => (seenBoards.has(b.id) ? false : (seenBoards.add(b.id), true))),
    relations: rels.map((r) => {
      const out = r.fromEntityId === entityId;
      const other = otherById.get(out ? r.toEntityId : r.fromEntityId);
      return { id: r.id, kind: r.kind, direction: out ? "out" : "in", other: { id: other?.id ?? "", name: other?.name ?? "(missing)", kind: other?.kind ?? "" } };
    }),
    history: await entityHistory(db, entityId),
  };
}

const norm = (v: string) => v.trim().toLowerCase();

/** Import entities and relations; existing entities are matched by kind + name (case-insensitive). */
export async function importGraph(db: Db, workspaceId: string, payload: ImportPayload, source = "import"): Promise<ImportResult> {
  const result: ImportResult = { entitiesCreated: 0, entitiesUpdated: 0, relationsCreated: 0, skipped: [] };
  const existing = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const byKey = new Map(existing.map((e) => [`${norm(e.kind)}|${norm(e.name)}`, e]));
  const byName = new Map<string, s.Entity[]>();
  for (const e of existing) byName.set(norm(e.name), [...(byName.get(norm(e.name)) ?? []), e]);
  const ts = now();

  for (const raw of payload.entities) {
    const kind = raw.kind?.trim() ?? "";
    const name = raw.name?.trim() ?? "";
    if (!name) {
      result.skipped.push(`entity without name (${kind || "no kind"})`);
      continue;
    }
    const key = `${norm(kind)}|${norm(name)}`;
    const cur = byKey.get(key);
    const description = raw.description?.trim() ?? "";
    const incoming = cleanAttributes(raw.attributes);
    if (cur) {
      const merged = { ...parseAttributes(cur.attributes), ...incoming };
      const descChanged = !!description && description !== cur.description;
      const attrsChanged = !sameAttributes(merged, parseAttributes(cur.attributes));
      if (descChanged || attrsChanged) {
        await db.update(s.entities).set({ ...(descChanged ? { description } : {}), attributes: JSON.stringify(merged), updatedAt: ts }).where(eq(s.entities.id, cur.id));
        if (descChanged) cur.description = description;
        cur.attributes = JSON.stringify(merged);
        result.entitiesUpdated++;
      }
    } else {
      const row: s.Entity = { id: `${ENTITY_ID_PREFIX}${nanoid(12)}`, workspaceId, kind, name, description, attributes: JSON.stringify(incoming), parentId: null, source, createdAt: ts, updatedAt: ts };
      await db.insert(s.entities).values(row);
      byKey.set(key, row);
      byName.set(norm(name), [...(byName.get(norm(name)) ?? []), row]);
      result.entitiesCreated++;
    }
  }

  const existingRels = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId));
  const relKeys = new Set(existingRels.map((r) => `${r.fromEntityId}|${norm(r.kind)}|${r.toEntityId}`));
  const resolve = (ref: string): s.Entity | undefined => {
    const r = ref.trim();
    if (r.includes(":")) {
      const [kind, ...rest] = r.split(":");
      const hit = byKey.get(`${norm(kind ?? "")}|${norm(rest.join(":"))}`);
      if (hit) return hit;
    }
    const list = byName.get(norm(r));
    return list?.[0];
  };
  for (const raw of payload.relations) {
    const from = resolve(raw.from ?? "");
    const to = resolve(raw.to ?? "");
    if (!from || !to) {
      result.skipped.push(`relation ${raw.from} → ${raw.to}: unknown entity`);
      continue;
    }
    const kind = raw.kind?.trim() ?? "";
    const key = `${from.id}|${norm(kind)}|${to.id}`;
    if (relKeys.has(key)) continue;
    await db.insert(s.relations_).values({ id: `${RELATION_ID_PREFIX}${nanoid(12)}`, workspaceId, fromEntityId: from.id, toEntityId: to.id, kind, source, createdAt: ts, updatedAt: ts });
    relKeys.add(key);
    result.relationsCreated++;
  }
  return result;
}

export { parseImportText } from "./import-parse";

/** Deterministic layout: one frame per kind, cards in a grid, connectors for relations. */
export function buildBoardFromGraph(entities: s.Entity[], relations: s.Relation[], title: string): CanvasDocument {
  const els: CanvasElement[] = [];
  const byKind = new Map<string, s.Entity[]>();
  for (const e of entities) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  const kinds = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length);
  els.push(textBlock(0, -150, 900, 96, title, `${entities.length} entities in ${kinds.length} kinds · ${relations.length} relations. Laid out from the graph — rearrange freely, the graph stays the source of truth.`, "section"));
  const cardW = 236, cardH = 124, gapX = 24, gapY = 22, pad = 24, frameGap = 60, titleRoom = 50;
  const cols = 3;
  let x = 0, y = 0, rowH = 0, col = 0;
  const cardIds = new Map<string, string>();
  for (const [kind, list] of kinds) {
    const perRow = Math.min(cols, Math.max(1, Math.ceil(Math.sqrt(list.length))));
    const rows = Math.ceil(list.length / perRow);
    const fw = pad * 2 + perRow * cardW + (perRow - 1) * gapX;
    const fh = titleRoom + pad + rows * cardH + (rows - 1) * gapY;
    if (col >= 2) { col = 0; x = 0; y += rowH + frameGap; rowH = 0; }
    els.push(frame(x, y, fw, fh, kind || "Untyped", cardColorForKind(kind)));
    list.forEach((e, i) => {
      const cx = x + pad + (i % perRow) * (cardW + gapX);
      const cy = y + titleRoom + Math.floor(i / perRow) * (cardH + gapY);
      const c = card(cx, cy, e.kind, e.name, e.description, undefined, parseAttributes(e.attributes)) as CardElement;
      c.meta = { entityId: e.id };
      cardIds.set(e.id, c.id);
      els.push(c);
    });
    x += fw + frameGap;
    rowH = Math.max(rowH, fh);
    col++;
  }
  for (const r of relations) {
    const from = cardIds.get(r.fromEntityId);
    const to = cardIds.get(r.toEntityId);
    if (!from || !to) continue;
    const c = connect(from, to, r.kind);
    c.meta = { relationId: r.id };
    els.push(c);
  }
  return { version: 2, elements: Object.fromEntries(els.map((e) => [e.id, e])) };
}

export async function graphForWorkspace(db: Db, workspaceId: string, kinds?: string[]) {
  const entities = await db.select().from(s.entities).where(kinds && kinds.length ? and(eq(s.entities.workspaceId, workspaceId), inArray(s.entities.kind, kinds)) : eq(s.entities.workspaceId, workspaceId));
  const relations = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId));
  return { entities, relations };
}

export { isBoxElement };

export type Direction = "both" | "out" | "in";

/**
 * Graph neighbourhood: starting from `ids`, follow relations up to `depth` hops in the given
 * direction. Returns the discovered entities (excluding the seeds) plus every relation among
 * seeds ∪ discovered — so callers can draw the complete local picture. depth 0 = relations
 * among the seeds only.
 */
export async function neighborhood(db: Db, workspaceId: string, ids: string[], depth: number, direction: Direction = "both", relationKinds?: string[]) {
  const seeds = new Set(ids);
  const all = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId));
  const rels = relationKinds && relationKinds.length ? all.filter((r) => relationKinds.includes(r.kind)) : all;
  const visited = new Set(ids);
  let frontier = new Set(ids);
  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const r of rels) {
      if ((direction === "both" || direction === "out") && frontier.has(r.fromEntityId) && !visited.has(r.toEntityId)) next.add(r.toEntityId);
      if ((direction === "both" || direction === "in") && frontier.has(r.toEntityId) && !visited.has(r.fromEntityId)) next.add(r.fromEntityId);
    }
    for (const id of next) visited.add(id);
    frontier = next;
    if (next.size === 0) break;
  }
  const discoveredIds = [...visited].filter((id) => !seeds.has(id));
  const entities = discoveredIds.length ? await db.select().from(s.entities).where(inArray(s.entities.id, discoveredIds)) : [];
  const relations = rels.filter((r) => visited.has(r.fromEntityId) && visited.has(r.toEntityId));
  return { entities, relations };
}
