import { cardColorForKind, type CanvasElement } from "./document";
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
export function cardForEntity(entity: EntityLike, x: number, y: number): CanvasElement {
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
export function cardCentredAt(entity: EntityLike, x: number, y: number): CanvasElement {
  return cardForEntity(entity, x - CARD_W / 2, y - CARD_H / 2);
}

/** Lay a list out in a centred grid — the "place all of this kind" behaviour. */
export function cardsInGrid(entities: EntityLike[], centre: { x: number; y: number }, gap = 24): CanvasElement[] {
  const perRow = Math.max(1, Math.ceil(Math.sqrt(entities.length)));
  const rows = Math.ceil(entities.length / perRow);
  const totalW = perRow * CARD_W + (perRow - 1) * gap;
  const totalH = rows * CARD_H + (rows - 1) * gap;
  return entities.map((e, i) =>
    cardForEntity(
      e,
      centre.x - totalW / 2 + (i % perRow) * (CARD_W + gap),
      centre.y - totalH / 2 + Math.floor(i / perRow) * (CARD_H + gap),
    ),
  );
}

/** MIME type for dragging entities from the inventory onto the canvas. */
export const ENTITY_DRAG_TYPE = "application/x-nexus-entity";

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
