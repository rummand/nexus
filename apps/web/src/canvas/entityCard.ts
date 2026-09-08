import { cardColorForKind, type CardElement } from "./document";
import { nanoid } from "nanoid";

/**
 * Turning a graph entity into a card on the board. Shared by the inventory panel's "+" button and
 * by dropping an entity onto the canvas, so both routes produce an identical, correctly linked
 * card (`meta.entityId` is what makes the card a *view* of the entity rather than a copy).
 */

export const CARD_W = 236;
export const CARD_H = 124;

/** The fields a card needs from an entity; deliberately narrower than EntitySummary. */
export interface EntityLike {
  id: string;
  kind: string;
  name: string;
  description?: string;
  attributes?: Record<string, string>;
}

/** A card whose top-left is at (x, y). */
export function cardForEntity(entity: EntityLike, x: number, y: number): CardElement {
  return {
    id: nanoid(10),
    type: "card",
    x,
    y,
    w: CARD_W,
    h: CARD_H,
    kind: entity.kind,
    color: cardColorForKind(entity.kind),
    title: entity.name,
    description: entity.description ?? "",
    attributes: entity.attributes,
    z: 0,
    meta: { entityId: entity.id },
  };
}

/** A card centred on (x, y) — what you want when dropping at the pointer. */
export function cardCentredAt(entity: EntityLike, x: number, y: number): CardElement {
  return cardForEntity(entity, x - CARD_W / 2, y - CARD_H / 2);
}

/**
 * Where a group of cards sits relative to the point it is dropped on — top-left of each, with the
 * whole block centred on the origin.
 *
 * Pulled out of `cardsInGrid` so the drag preview and the drop itself cannot disagree: the ghost
 * you drag around the board is laid out by this function, and so are the cards you get when you
 * let go. A preview that is computed a second way is a preview that eventually lies.
 *
 * One entity is the same case as many — a 1×1 grid is a card centred on the pointer — so there is
 * no special path for it.
 */
export function cardLayout(count: number, gap = 24): Array<{ x: number; y: number }> {
  const perRow = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / perRow);
  const totalW = perRow * CARD_W + (perRow - 1) * gap;
  const totalH = rows * CARD_H + (rows - 1) * gap;
  return Array.from({ length: count }, (_, i) => ({
    x: -totalW / 2 + (i % perRow) * (CARD_W + gap),
    y: -totalH / 2 + Math.floor(i / perRow) * (CARD_H + gap),
  }));
}

/** Lay a list out in a centred grid — the "place all of this kind" behaviour, and every drop. */
export function cardsInGrid(entities: EntityLike[], centre: { x: number; y: number }, gap = 24): CardElement[] {
  const at = cardLayout(entities.length, gap);
  return entities.map((e, i) => cardForEntity(e, centre.x + at[i]!.x, centre.y + at[i]!.y));
}

/** What the drag preview draws: the same boxes the drop will create, relative to the pointer. */
export interface DropGhost {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  title: string;
  color: string;
}

export function dropGhosts(entities: EntityLike[], gap = 24): DropGhost[] {
  const at = cardLayout(entities.length, gap);
  return entities.map((e, i) => ({
    key: e.id,
    x: at[i]!.x,
    y: at[i]!.y,
    w: CARD_W,
    h: CARD_H,
    kind: e.kind,
    title: e.name,
    color: cardColorForKind(e.kind),
  }));
}

/** MIME type for dragging entities from the inventory onto the canvas. */
export const ENTITY_DRAG_TYPE = "application/x-nexus-entity";

/**
 * What is currently being dragged, for the preview to read.
 *
 * `dataTransfer.getData()` is deliberately unreadable during `dragover` — the browser will not let
 * a page inspect a payload it has not been given yet — so a preview that wants to draw the actual
 * cards has to be told separately. This is that channel: set when a drag starts, cleared when it
 * ends, and only ever a hint. The drop itself still reads `dataTransfer`, which is authoritative.
 */
let inFlight: EntityLike[] | null = null;

export function beginEntityDrag(entities: EntityLike[]) {
  inFlight = entities.slice();
}

export function entityDragInFlight(): EntityLike[] | null {
  return inFlight;
}

export function endEntityDrag() {
  inFlight = null;
}

/** Parse a drop payload; returns null for anything that is not an entity drag. */
export function parseEntityDrag(raw: string): EntityLike[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const out = list.filter((e): e is EntityLike => !!e && typeof e === "object" && typeof (e as EntityLike).id === "string" && typeof (e as EntityLike).name === "string");
    return out.length ? out : null;
  } catch {
    return null;
  }
}
