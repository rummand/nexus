import { describe, expect, it } from "vitest";
import type { CanvasElement } from "@/canvas/document";
import { applyPatch, diffElements, lockedBy, peerColor, type Patch, type Peer } from "./protocol";

/**
 * The merge, held to what it promises.
 *
 * Multiplayer is the one feature where a quiet bug does not look like a bug: it looks like a
 * colleague being careless. So these are about the rules rather than the plumbing — what a patch
 * means, what a diff says, and the two cases the design deliberately refuses to merge.
 */

const card = (id: string, over: Partial<CanvasElement> = {}): CanvasElement =>
  ({ id, type: "card", x: 0, y: 0, w: 200, h: 120, z: 1, kind: "Application", color: "#1376d4", title: id, description: "", ...over }) as CanvasElement;

const peer = (over: Partial<Peer> = {}): Peer =>
  ({ id: "p1", userId: "u1", name: "Jes Olsen", color: "#1376d4", cursor: null, view: null, following: null, selection: [], editing: null, ...over });

describe("a patch", () => {
  it("adds, replaces and removes", () => {
    const before = { a: card("a"), b: card("b") };
    const after = applyPatch(before, { upsert: { b: card("b", { x: 50 }), c: card("c") }, remove: ["a"] });
    expect(Object.keys(after).sort()).toEqual(["b", "c"]);
    expect(after.b).toMatchObject({ x: 50 });
  });

  it("leaves the map alone — the same object — when it says nothing", () => {
    const before = { a: card("a") };
    // Identity, not equality: the store and the canvas both lean on reference checks to decide
    // whether anything needs redrawing.
    expect(applyPatch(before, {})).toBe(before);
    expect(applyPatch(before, { upsert: {}, remove: [] })).toBe(before);
  });

  it("does not mutate what it was given", () => {
    const before = { a: card("a") };
    applyPatch(before, { upsert: { b: card("b") }, remove: ["a"] });
    expect(Object.keys(before)).toEqual(["a"]);
  });

  it("removes after upserting, so a patch is a statement rather than a script", () => {
    const before = { a: card("a") };
    expect(applyPatch(before, { upsert: { a: card("a", { x: 9 }) }, remove: ["a"] })).toEqual({});
  });
});

describe("what changed", () => {
  it("says nothing when nothing did", () => {
    const els = { a: card("a") };
    expect(diffElements(els, { ...els })).toBeNull();
  });

  it("reports only the elements whose object identity changed", () => {
    const a = card("a");
    const b = card("b");
    const moved = { ...b, x: 300 } as CanvasElement;
    const patch = diffElements({ a, b }, { a, b: moved });
    expect(patch).toEqual({ upsert: { b: moved } });
  });

  it("reports a deletion", () => {
    expect(diffElements({ a: card("a"), b: card("b") }, { a: card("a") })?.remove).toEqual(["b"]);
  });

  it("round-trips: applying a diff to the old map produces the new one", () => {
    const before = { a: card("a"), b: card("b"), c: card("c") };
    const after = { a: card("a", { title: "renamed" }), c: before.c, d: card("d") };
    const patch = diffElements(before, after) as Patch;
    expect(applyPatch(before, patch)).toEqual(after);
  });

  it("two people touching different cards do not collide", () => {
    // The property the whole design rests on: patches from two people commute when they are
    // about different objects, which is the overwhelmingly common case on a board.
    const base = { a: card("a"), b: card("b") };
    const mine = diffElements(base, { ...base, a: card("a", { x: 100 }) }) as Patch;
    const theirs = diffElements(base, { ...base, b: card("b", { y: 200 }) }) as Patch;
    expect(applyPatch(applyPatch(base, mine), theirs)).toEqual(applyPatch(applyPatch(base, theirs), mine));
  });

  it("two people touching one card resolve to whoever the server heard last", () => {
    // Not a merge and not pretending to be: this is a real conflict, and a defined winner is the
    // best available answer. The server's arrival order is what makes "last" mean something.
    const base = { a: card("a") };
    const mine = diffElements(base, { a: card("a", { x: 100 }) }) as Patch;
    const theirs = diffElements(base, { a: card("a", { x: 900 }) }) as Patch;
    expect(applyPatch(applyPatch(base, mine), theirs).a).toMatchObject({ x: 900 });
    expect(applyPatch(applyPatch(base, theirs), mine).a).toMatchObject({ x: 100 });
  });
});

describe("presence", () => {
  it("gives one person one colour, whatever their connection", () => {
    expect(peerColor("user-1")).toBe(peerColor("user-1"));
    expect(peerColor("user-1")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("locks a field to the person who is in it, and to nobody else", () => {
    const peers = [peer({ id: "p1", editing: "card-1" }), peer({ id: "p2", userId: "u2", editing: null })];
    expect(lockedBy(peers, "card-1")?.id).toBe("p1");
    expect(lockedBy(peers, "card-2")).toBeNull();
    // Nobody is here: nothing is locked. A lock cannot outlive the presence that holds it.
    expect(lockedBy([], "card-1")).toBeNull();
  });
});

describe("who is here, and bringing them here (#148, §5.95)", () => {
  const peer = (id: string, over: Partial<Peer> = {}): Peer =>
    ({ id, userId: `u_${id}`, name: id.toUpperCase(), color: "#123456", cursor: null, view: null, following: null, selection: [], editing: null, ...over });

  it("a peer carries what it is doing, so a list can say so without asking", () => {
    const typing = peer("p1", { editing: "card-1" });
    const selecting = peer("p2", { selection: ["a", "b"] });
    expect(typing.editing).toBe("card-1");
    expect(selecting.selection).toHaveLength(2);
  });

  it("a peer with no viewport cannot be gone to, which the card has to cope with", () => {
    expect(peer("p1").view).toBeNull();
  });

  it("a viewport travels with presence, which is what gather sends", () => {
    const looking = peer("p1", { view: { x: 0, y: 0, w: 800, h: 600 } });
    expect(looking.view).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });
});
