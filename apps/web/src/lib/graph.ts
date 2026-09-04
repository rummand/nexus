import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { cardColorForKind, isBoxElement, type CanvasDocument, type CanvasElement, type CardElement } from "@/canvas/document";
import { card, connect, frame, textBlock } from "@/canvas/templates";
import { ENTITY_ID_PREFIX, isEntityId, isRelationId, RELATION_ID_PREFIX, type EntityDetail, type GraphSnapshot, type ImportPayload, type ImportResult } from "./graph-types";

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

export function parseAttributes(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (k.trim() && val !== null && val !== undefined && String(val).trim()) out[k.trim()] = String(val).trim();
    return out;
  } catch {
    return {};
  }
}

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

function entityCards(elements: Elements): Array<CardElement & { entityId: string }> {
  const out: Array<CardElement & { entityId: string }> = [];
  for (const el of Object.values(elements)) {
    if (el.type === "card" && isEntityId(el.meta?.entityId)) out.push(Object.assign(el, { entityId: el.meta.entityId }));
  }
  return out;
}

export async function syncBoardToGraph(db: Db, board: { id: string; workspaceId: string }, doc: CanvasDocument) {
  const cards = entityCards(doc.elements);
  const ids = cards.map((c) => c.entityId);
  const existing = ids.length ? await db.select().from(s.entities).where(inArray(s.entities.id, ids)) : [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  const ts = now();

  for (const c of cards) {
    const cur = byId.get(c.entityId);
    const attrs = cleanAttributes(c.attributes);
    if (!cur) {
      await db.insert(s.entities).values({ id: c.entityId, workspaceId: board.workspaceId, kind: c.kind.trim(), name: c.title.trim(), description: c.description.trim(), attributes: JSON.stringify(attrs), source: "canvas", createdAt: ts, updatedAt: ts });
    } else if (cur.workspaceId === board.workspaceId && (cur.kind !== c.kind.trim() || cur.name !== c.title.trim() || cur.description !== c.description.trim() || !sameAttributes(parseAttributes(cur.attributes), attrs))) {
      await db.update(s.entities).set({ kind: c.kind.trim(), name: c.title.trim(), description: c.description.trim(), attributes: JSON.stringify(attrs), updatedAt: ts }).where(eq(s.entities.id, c.entityId));
    }
  }

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
    for (const r of relRows) {
      const cur = relById.get(r.id);
      if (!cur) await db.insert(s.relations_).values({ id: r.id, workspaceId: board.workspaceId, fromEntityId: r.from, toEntityId: r.to, kind: r.kind, source: "canvas", createdAt: ts, updatedAt: ts });
      else if (cur.kind !== r.kind || cur.fromEntityId !== r.from || cur.toEntityId !== r.to) await db.update(s.relations_).set({ kind: r.kind, fromEntityId: r.from, toEntityId: r.to, updatedAt: ts }).where(eq(s.relations_.id, r.id));
    }
  }

  // board ↔ entity index
  await db.delete(s.boardEntities).where(eq(s.boardEntities.boardId, board.id));
  if (cards.length) {
    await db.insert(s.boardEntities).values(cards.map((c) => ({ boardId: board.id, entityId: c.entityId, elementId: c.id }))).onConflictDoNothing();
  }
}

/** Refresh entity-backed cards and relation connectors from the graph. */
export async function hydrateDocument(db: Db, doc: CanvasDocument): Promise<CanvasDocument> {
  const cards = entityCards(doc.elements);
  if (cards.length === 0) return doc;
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
  return {
    entity: { id: entity.id, kind: entity.kind, name: entity.name, description: entity.description, attributes: parseAttributes(entity.attributes), source: entity.source, updatedAt: entity.updatedAt },
    kindAttributeKeys: [...keyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
    duplicates: dupes.map((d) => ({ id: d.id, kind: d.kind, name: d.name, description: d.description })),
    boards: boards.filter((b) => (seenBoards.has(b.id) ? false : (seenBoards.add(b.id), true))),
    relations: rels.map((r) => {
      const out = r.fromEntityId === entityId;
      const other = otherById.get(out ? r.toEntityId : r.fromEntityId);
      return { id: r.id, kind: r.kind, direction: out ? "out" : "in", other: { id: other?.id ?? "", name: other?.name ?? "(missing)", kind: other?.kind ?? "" } };
    }),
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
      const row: s.Entity = { id: `${ENTITY_ID_PREFIX}${nanoid(12)}`, workspaceId, kind, name, description, attributes: JSON.stringify(incoming), source, createdAt: ts, updatedAt: ts };
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

/** Parse CSV text into an import payload. Entities: kind,name[,description]. Relations: from,relation,to. */
export function parseImportText(text: string): ImportPayload {
  const trimmed = text.trim();
  if (!trimmed) return { entities: [], relations: [] };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as Partial<ImportPayload> | ImportPayload["entities"];
    if (Array.isArray(parsed)) return { entities: parsed, relations: [] };
    return { entities: parsed.entities ?? [], relations: parsed.relations ?? [] };
  }
  const entities: ImportPayload["entities"] = [];
  const relations: ImportPayload["relations"] = [];
  let mode: "entities" | "relations" = "entities";
  let attributeColumns: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (/^#\s*relations/i.test(l)) { mode = "relations"; continue; }
    if (/^#\s*entities/i.test(l)) { mode = "entities"; continue; }
    if (l.startsWith("#")) continue;
    const cells = splitCsv(l);
    const header = cells.map(norm);
    if (header[0] === "kind" && header[1] === "name") { mode = "entities"; attributeColumns = cells.slice(3).map((c) => c.trim()); continue; }
    if (header[0] === "from" && (header[1] === "relation" || header[1] === "kind")) { mode = "relations"; continue; }
    if (mode === "entities") {
      const attributes: Record<string, string> = {};
      if (attributeColumns.length) {
        attributeColumns.forEach((col, i) => { const v = cells[3 + i]; if (col && v && v.trim()) attributes[col] = v.trim(); });
      }
      entities.push({ kind: cells[0] ?? "", name: cells[1] ?? "", description: cells[2] ?? "", ...(Object.keys(attributes).length ? { attributes } : {}) });
    } else relations.push({ from: cells[0] ?? "", kind: cells[1] ?? "", to: cells[2] ?? "" });
  }
  return { entities, relations };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if ((ch === "," || ch === ";") && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

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
