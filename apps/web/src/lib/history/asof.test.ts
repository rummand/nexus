import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { rewind, rewindWords, type PastEvent } from "./asof";

/**
 * The estate on a date, by undoing the log (#138, §5.97). Every case here is a way the question
 * "what did it look like in March" is answered wrongly if the replay is careless.
 */

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes), parentId: null, source: "canvas", createdAt: "", updatedAt: "" }) as s.Entity;

const event = (entityId: string, kind: string, at: string, over: Partial<PastEvent> = {}): PastEvent =>
  ({ entityId, entityName: entityId, kind, field: "", fromValue: "", toValue: "", at, ...over });

const MARCH = new Date("2026-03-01T00:00:00Z");
const attrs = (rewound: { entities: s.Entity[] }, id: string) => parseAttributes(rewound.entities.find((e) => e.id === id)!.attributes);

describe("undoing the log to a date", () => {
  it("leaves the estate alone when nothing has happened since", () => {
    const r = rewind([entity("a", "Maximo")], [event("a", "renamed", "2026-02-01T00:00:00Z", { fromValue: "Old" })], MARCH);
    expect(r.entities[0]!.name).toBe("Maximo");
    expect(r.undone).toBe(0);
    expect(rewindWords(r, MARCH)).toContain("Nothing has changed since 2026-03-01");
  });

  it("puts a renamed object back to the name it had then", () => {
    const r = rewind([entity("a", "Maximo EAM")], [event("a", "renamed", "2026-06-01T00:00:00Z", { fromValue: "Maximo", toValue: "Maximo EAM" })], MARCH);
    expect(r.entities[0]!.name).toBe("Maximo");
    expect(r.undone).toBe(1);
  });

  it("puts a retype and a description back too", () => {
    const r = rewind([entity("a", "Maximo", "Platform")], [
      event("a", "retyped", "2026-06-01T00:00:00Z", { fromValue: "Application", toValue: "Platform" }),
      event("a", "described", "2026-06-02T00:00:00Z", { fromValue: "Work orders", toValue: "" }),
    ], MARCH);
    expect(r.entities[0]!.kind).toBe("Application");
    expect(r.entities[0]!.description).toBe("Work orders");
  });

  it("undoes the newest change first, so a stale value never lands on a newer one", () => {
    // owner: "" → "IT" (April) → "Finance" (June). In March it was empty.
    const r = rewind([entity("a", "Maximo", "Application", { owner: "Finance" })], [
      event("a", "attributeSet", "2026-04-01T00:00:00Z", { field: "owner", fromValue: "", toValue: "IT" }),
      event("a", "attributeSet", "2026-06-01T00:00:00Z", { field: "owner", fromValue: "IT", toValue: "Finance" }),
    ], MARCH);
    expect(attrs(r, "a").owner).toBeUndefined();
  });

  it("stops at the date rather than undoing everything", () => {
    // The April change is after March and is undone; the February one is not.
    const r = rewind([entity("a", "Maximo", "Application", { owner: "IT" })], [
      event("a", "attributeSet", "2026-02-01T00:00:00Z", { field: "owner", fromValue: "Nobody", toValue: "Grid" }),
      event("a", "attributeSet", "2026-04-01T00:00:00Z", { field: "owner", fromValue: "Grid", toValue: "IT" }),
    ], MARCH);
    expect(attrs(r, "a").owner).toBe("Grid");
    expect(r.undone).toBe(1);
  });

  it("puts back an attribute somebody has since removed", () => {
    const r = rewind([entity("a", "Maximo")], [event("a", "attributeRemoved", "2026-06-01T00:00:00Z", { field: "owner", fromValue: "IT" })], MARCH);
    expect(attrs(r, "a").owner).toBe("IT");
  });
});

describe("objects that came and went", () => {
  it("takes out something that did not exist yet", () => {
    const r = rewind([entity("a", "Maximo"), entity("b", "New Thing")], [
      event("b", "created", "2026-06-01T00:00:00Z", { field: "Application", toValue: "New Thing" }),
    ], MARCH);
    expect(r.entities.map((e) => e.id)).toEqual(["a"]);
    expect(r.removed).toBe(1);
    expect(rewindWords(r, MARCH)).toContain("1 object had not been created yet");
  });

  it("brings back something that existed then and has since been deleted", () => {
    const r = rewind([entity("a", "Maximo")], [
      event("gone", "deleted", "2026-06-01T00:00:00Z", { field: "Application", fromValue: "Historian", entityName: "Historian" }),
    ], MARCH);
    expect(r.entities.find((e) => e.id === "gone")?.name).toBe("Historian");
    expect(r.restored).toBe(1);
  });

  it("does not resurrect something that was created and then deleted inside the window", () => {
    // Created in April, deleted in June: in March it did not exist, and neither event should
    // leave it behind.
    const r = rewind([entity("a", "Maximo")], [
      event("b", "created", "2026-04-01T00:00:00Z", { field: "Application", toValue: "Brief Thing" }),
      event("b", "deleted", "2026-06-01T00:00:00Z", { field: "Application", fromValue: "Brief Thing" }),
    ], MARCH);
    expect(r.entities.map((e) => e.id)).toEqual(["a"]);
  });

  it("leaves an event kind it cannot undo alone rather than guessing", () => {
    const r = rewind([entity("a", "Maximo")], [event("a", "moved", "2026-06-01T00:00:00Z", { fromValue: "Grid Services" })], MARCH);
    expect(r.entities[0]!.parentId ?? null).toBeNull();
    expect(r.undone).toBe(1);
  });

  it("ignores an event with a date nobody can read", () => {
    const r = rewind([entity("a", "Maximo EAM")], [event("a", "renamed", "not a date", { fromValue: "Maximo" })], MARCH);
    expect(r.entities[0]!.name).toBe("Maximo EAM");
  });
});
