import { describe, expect, it } from "vitest";
import { CARD_H, CARD_W, cardCentredAt, cardLayout, cardsInGrid, dropGhosts, parseEntityDrag, type EntityLike } from "./entityCard";

/**
 * Dropping objects onto the board (§5.44).
 *
 * The property that matters is that the preview and the drop are the same arithmetic: a ghost you
 * drag around the canvas is a promise about where the card will be, and a preview computed a
 * second way is a preview that eventually breaks that promise. So the tests here mostly assert
 * that two functions agree, rather than asserting particular coordinates.
 */

const entity = (id: string, kind = "Application"): EntityLike => ({ id, kind, name: `System ${id}` });

describe("where dropped cards land", () => {
  it("puts a single card centred on the pointer", () => {
    const [only] = cardsInGrid([entity("a")], { x: 500, y: 300 });
    expect(only).toMatchObject({ x: 500 - CARD_W / 2, y: 300 - CARD_H / 2 });
  });

  it("agrees with cardCentredAt, so there is only one idea of centred", () => {
    // The drop used to special-case one entity; if these ever diverge that special case is back.
    const viaGrid = cardsInGrid([entity("a")], { x: 120, y: -40 })[0]!;
    const viaCentre = cardCentredAt(entity("a"), 120, -40);
    expect([viaGrid.x, viaGrid.y]).toEqual([viaCentre.x, viaCentre.y]);
  });

  it("centres the whole block on the pointer, not its first card", () => {
    const at = cardLayout(4);
    const xs = at.map((p) => p.x);
    const ys = at.map((p) => p.y);
    expect(Math.min(...xs) + Math.max(...xs) + CARD_W).toBe(0);
    expect(Math.min(...ys) + Math.max(...ys) + CARD_H).toBe(0);
  });

  it("keeps cards apart by the gap, in a roughly square grid", () => {
    const at = cardLayout(9, 24);
    expect(at).toHaveLength(9);
    expect(at[1]!.x - at[0]!.x).toBe(CARD_W + 24);
    expect(at[3]!.y - at[0]!.y).toBe(CARD_H + 24);
    expect(at[3]!.x).toBe(at[0]!.x); // three per row for nine
  });

  it("lays out an empty drop without dividing by zero", () => {
    expect(cardLayout(0)).toEqual([]);
    expect(dropGhosts([])).toEqual([]);
  });
});

describe("the preview promises what the drop delivers", () => {
  it("draws a ghost in exactly the place each card will be", () => {
    const list = [entity("a"), entity("b"), entity("c"), entity("d"), entity("e")];
    const drop = { x: 800, y: 250 };
    const cards = cardsInGrid(list, drop);
    const ghosts = dropGhosts(list);
    expect(ghosts).toHaveLength(cards.length);
    for (const [i, ghost] of ghosts.entries()) {
      expect(ghost.x + drop.x).toBe(cards[i]!.x);
      expect(ghost.y + drop.y).toBe(cards[i]!.y);
      expect([ghost.w, ghost.h]).toEqual([cards[i]!.w, cards[i]!.h]);
      expect(ghost.color).toBe(cards[i]!.color);
    }
  });

  it("names each ghost, so a group is readable rather than a row of empty boxes", () => {
    const [ghost] = dropGhosts([{ id: "e1", kind: "Capability", name: "Billing" }]);
    expect(ghost).toMatchObject({ key: "e1", kind: "Capability", title: "Billing" });
  });
});

describe("reading a drop payload", () => {
  it("takes a list or a single object, and refuses anything else", () => {
    expect(parseEntityDrag(JSON.stringify([{ id: "a", name: "A" }]))).toHaveLength(1);
    expect(parseEntityDrag(JSON.stringify({ id: "a", name: "A" }))).toHaveLength(1);
    expect(parseEntityDrag("not json")).toBeNull();
    expect(parseEntityDrag(JSON.stringify([{ name: "no id" }]))).toBeNull();
    expect(parseEntityDrag(JSON.stringify([]))).toBeNull();
  });
});
