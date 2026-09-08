import { describe, expect, it } from "vitest";
import {
  coalesce,
  dayKey,
  describeActor,
  describeChange,
  diffEntities,
  diffEntity,
  foldMoments,
  whenWords,
  type Actor,
  type Change,
  type EntitySnapshot,
  type GraphEvent,
} from "./events";

/**
 * What the graph remembers, before any of it touches a database.
 *
 * The cases worth writing down are the ones a person would never click: an edit that came back to
 * where it started, an attribute set to the same value it already had, a burst of autosaves that
 * should read as one act, two people editing the same field a minute apart. Every one of them is a
 * way for a history to lie, and a lying history is worse than none.
 */

const entity = (over: Partial<EntitySnapshot> = {}): EntitySnapshot => ({
  id: "ent_1",
  kind: "Application",
  name: "Maximo",
  description: "Asset management.",
  attributes: { owner: "Grid Operations" },
  ...over,
});

describe("what one edit did", () => {
  it("sees a creation and a deletion as one event each", () => {
    expect(diffEntity(null, entity())).toEqual([{ kind: "created", field: "Application", from: "", to: "Maximo" }]);
    expect(diffEntity(entity(), null)).toEqual([{ kind: "deleted", field: "Application", from: "Maximo", to: "" }]);
    expect(diffEntity(null, null)).toEqual([]);
  });

  it("does not itemise the fields something was born with", () => {
    // Importing four hundred rows with five attributes each should read as four hundred things
    // happening, not two thousand. What an entity started as is on the entity.
    const born = entity({ attributes: { owner: "A", criticality: "high", tier: "1" } });
    expect(diffEntity(null, born)).toHaveLength(1);
  });

  it("names each field that moved, and nothing else", () => {
    const after = entity({ name: "Maximo EAM", attributes: { owner: "Grid Operations", criticality: "high" } });
    expect(diffEntity(entity(), after)).toEqual([
      { kind: "renamed", field: "", from: "Maximo", to: "Maximo EAM" },
      { kind: "attributeSet", field: "criticality", from: "", to: "high" },
    ]);
  });

  it("says nothing when nothing changed, whitespace included", () => {
    expect(diffEntity(entity(), entity())).toEqual([]);
    // A save that only re-serialised the row is not a fact about the estate.
    expect(diffEntity(entity(), entity({ name: "  Maximo  ", attributes: { owner: " Grid Operations " } }))).toEqual([]);
  });

  it("tells an emptied attribute from a changed one", () => {
    expect(diffEntity(entity(), entity({ attributes: {} }))).toEqual([
      { kind: "attributeRemoved", field: "owner", from: "Grid Operations", to: "" },
    ]);
  });

  it("orders attributes by key, so two runs over one edit agree", () => {
    const after = entity({ attributes: { owner: "Grid Operations", zeta: "1", alpha: "2" } });
    expect(diffEntity(entity(), after).map((c) => c.field)).toEqual(["alpha", "zeta"]);
  });

  it("keeps the name a deleted entity had, not the one it does not have", () => {
    const before = new Map([["ent_1", entity()]]);
    const [only] = diffEntities(before, new Map());
    expect(only?.entity.name).toBe("Maximo");
  });
});

describe("saying it in words", () => {
  const say = (c: Partial<Change>) => describeChange({ kind: "attributeSet", field: "owner", from: "", to: "", ...c } as Change);

  it("reads as a sentence somebody would say out loud", () => {
    expect(say({ kind: "created", field: "Application", to: "Maximo" })).toBe("created it as Application");
    expect(say({ kind: "renamed", field: "", from: "Maximo", to: "Maximo EAM" })).toBe("renamed it from “Maximo” to “Maximo EAM”");
    expect(say({ kind: "attributeSet", field: "owner", to: "Grid Operations" })).toBe("set owner to “Grid Operations”");
    expect(say({ kind: "attributeSet", field: "owner", from: "IT", to: "Grid Operations" })).toBe("changed owner from “IT” to “Grid Operations”");
    expect(say({ kind: "attributeRemoved", field: "owner", from: "IT" })).toBe("removed owner (was “IT”)");
    expect(say({ kind: "relationAdded", field: "supports", from: "CRM", to: "Billing" })).toBe("linked “CRM” — supports → “Billing”");
    expect(say({ kind: "deleted", field: "", from: "Maximo" })).toBe("deleted it");
  });

  it("clips a description rather than pasting a paragraph into a timeline", () => {
    const long = "x".repeat(200);
    const line = describeChange({ kind: "described", field: "", from: "", to: long });
    expect(line.length).toBeLessThan(110);
    expect(line).toContain("…");
  });

  it("has a name for an actor that has none", () => {
    expect(describeActor({ kind: "agent", id: null, name: "" })).toBe("An agent");
    expect(describeActor({ kind: "person", id: "u1", name: "Maria Lund" })).toBe("Maria Lund");
  });
});

describe("folding one act into one entry", () => {
  const actor: Actor = { kind: "person", id: "u1", name: "Maria Lund" };
  const at = (min: number) => new Date(Date.parse("2026-09-08T09:00:00.000Z") - min * 60_000).toISOString();
  const ev = (over: Partial<GraphEvent>): GraphEvent => ({
    id: `e${Math.random()}`,
    entityId: "ent_1",
    entityName: "Maximo",
    kind: "attributeSet",
    field: "owner",
    from: "",
    to: "x",
    actor,
    context: "the entity drawer",
    at: at(0),
    ...over,
  });

  it("groups one person's burst, and splits on the next hand", () => {
    const moments = foldMoments([
      ev({ at: at(0) }),
      ev({ at: at(1) }),
      ev({ at: at(2), actor: { kind: "agent", id: "a1", name: "Night watch" } }),
      ev({ at: at(3) }),
    ]);
    expect(moments.map((m) => m.events.length)).toEqual([2, 1, 1]);
  });

  it("splits when the same person comes back later", () => {
    expect(foldMoments([ev({ at: at(0) }), ev({ at: at(30) })])).toHaveLength(2);
  });

  it("splits when the same person is somewhere else", () => {
    // "Maria changed it in the drawer" and "Maria changed it on a board" are two facts.
    expect(foldMoments([ev({ at: at(0) }), ev({ at: at(1), context: "board: Landscape" })])).toHaveLength(2);
  });
});

describe("not recording somebody's typing", () => {
  const c = (over: Partial<Change>): Change => ({ kind: "renamed", field: "", from: "", to: "", ...over });

  it("extends the earlier change instead of writing a second line", () => {
    expect(coalesce(c({ from: "A", to: "B" }), c({ from: "B", to: "C" }))).toEqual({ action: "extend", kind: "renamed", from: "A", to: "C" });
  });

  it("drops both when the edit came back to where it started", () => {
    // Renaming a card and undoing it did not happen, and a history that says it did is noise
    // somebody has to read past on the day it matters.
    expect(coalesce(c({ from: "A", to: "B" }), c({ from: "B", to: "A" }))).toEqual({ action: "drop" });
  });

  it("chains an attribute set into its removal, and back again", () => {
    const set = c({ kind: "attributeSet", field: "owner", from: "IT", to: "Grid" });
    expect(coalesce(set, c({ kind: "attributeRemoved", field: "owner", from: "Grid", to: "" }))).toEqual({ action: "extend", kind: "attributeRemoved", from: "IT", to: "" });
    const removed = c({ kind: "attributeRemoved", field: "owner", from: "IT", to: "" });
    expect(coalesce(removed, c({ kind: "attributeSet", field: "owner", from: "", to: "IT" }))).toEqual({ action: "drop" });
  });

  it("never chains across fields, kinds it cannot compare, or a gap in the chain", () => {
    expect(coalesce(c({ kind: "attributeSet", field: "owner", to: "A" }), c({ kind: "attributeSet", field: "tier", to: "1" }))).toEqual({ action: "insert" });
    // A name and a kind both carry an empty field; chaining them would invent a change nobody made.
    expect(coalesce(c({ kind: "renamed", from: "A", to: "Application" }), c({ kind: "retyped", from: "Application", to: "Capability" }))).toEqual({ action: "insert" });
    expect(coalesce(c({ from: "A", to: "B" }), c({ from: "Z", to: "C" }))).toEqual({ action: "insert" });
    expect(coalesce(null, c({ from: "A", to: "B" }))).toEqual({ action: "insert" });
  });

  it("will not fold a creation or a deletion into anything", () => {
    expect(coalesce(c({ kind: "created", to: "A" }), c({ kind: "renamed", from: "A", to: "B" }))).toEqual({ action: "insert" });
    expect(coalesce(c({ kind: "renamed", from: "A", to: "B" }), c({ kind: "deleted", from: "B" }))).toEqual({ action: "insert" });
  });
});

describe("when it happened, in words", () => {
  const NOW = Date.parse("2026-09-08T09:00:00.000Z");

  it("says the useful thing at each distance", () => {
    expect(whenWords(new Date(NOW - 5_000).toISOString(), NOW)).toBe("just now");
    expect(whenWords(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5 minutes ago");
    expect(whenWords(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3 hours ago");
    expect(whenWords(new Date(NOW - 26 * 3_600_000).toISOString(), NOW)).toBe("yesterday");
    expect(whenWords(new Date(NOW - 5 * 86_400_000).toISOString(), NOW)).toBe("5 days ago");
  });

  it("does not fall over on a clock that went backwards, or on rubbish", () => {
    expect(whenWords(new Date(NOW + 60_000).toISOString(), NOW)).toBe("just now");
    expect(whenWords("not a date", NOW)).toBe("at some point");
    expect(dayKey("not a date")).toBe("unknown");
  });
});
