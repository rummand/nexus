import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import type { CanvasElement } from "@/canvas/document";
import { roadmapDocument, touches } from "./board";
import type { Change, ChangeSet } from "./types";

/**
 * A roadmap laid out as an ordinary board.
 *
 * The thing worth guarding is that this stays *ordinary*: cards with attributes and a generic
 * timeline layout, not a bespoke drawing. So these tests check the attributes a reader could
 * re-sort by, and that a planned system is a drawing rather than a system.
 */

const entity = (id: string, name: string, kind = "Application"): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: "{}", source: "canvas", createdAt: "2026-01-01", updatedAt: "2026-01-01" }) as s.Entity;

const relation = (id: string, from: string, to: string, kind = "depends on"): s.Relation =>
  ({ id, workspaceId: "ws", fromEntityId: from, toEntityId: to, kind, attributes: "{}", source: "canvas", createdAt: "2026-01-01", updatedAt: "2026-01-01" }) as s.Relation;

const change = (id: string, op: Change["op"], fields: Partial<Change> = {}): Change =>
  ({ id, op, entityId: null, relationId: null, payload: {}, note: "", createdAt: "2026-01-01", ...fields });

const set = (id: string, name: string, targetDate: string, changes: Change[], status: ChangeSet["status"] = "planned"): ChangeSet =>
  ({ id, workspaceId: "ws", name, description: "", status, targetDate, deliveredAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", changes });

const ESTATE = [entity("a", "Maximo"), entity("b", "SCADA"), entity("c", "Billing"), entity("d", "Historian")];
const WIRES = [relation("r1", "c", "a")];

const SETS = [
  set("s1", "Retire Maximo", "2027-03-01", [
    change("c1", "retireEntity", { entityId: "a", note: "out of support" }),
    change("c2", "addEntity", { entityId: "new1", payload: { kind: "Application", name: "Asset Hub" } }),
  ]),
  set("s2", "Rewire billing", "2027-09-01", [
    change("c3", "setAttribute", { entityId: "c", payload: { key: "owner", value: "Grid" }, note: "new owner" }),
    change("c4", "addRelation", { relationId: "nr1", payload: { fromEntityId: "c", toEntityId: "b", kind: "depends on" } }),
  ]),
];

const cards = (document: { elements: Record<string, CanvasElement> }) =>
  Object.values(document.elements).filter((el) => el.type === "card");

describe("which systems a plan touches", () => {
  it("names one touch per object, with what happens to it and when", () => {
    const list = touches(ESTATE, WIRES, SETS, []);
    expect(list.map((t) => [t.name, t.effect, t.when])).toEqual([
      ["Maximo", "retired", "2027-03-01"],
      ["Asset Hub", "introduced", "2027-03-01"],
      ["Billing", "changed", "2027-09-01"],
      ["SCADA", "connected", "2027-09-01"],
    ]);
  });

  it("puts an object touched twice on the board once, at the first plan", () => {
    const later = set("s3", "Move Maximo", "2028-01-01", [change("c5", "setAttribute", { entityId: "a", payload: { key: "owner", value: "X" } })]);
    const list = touches(ESTATE, WIRES, [...SETS, later], []);
    const maximo = list.filter((t) => t.name === "Maximo");
    expect(maximo).toHaveLength(1);
    expect(maximo[0]!.when).toBe("2027-03-01");
    // the second plan is not lost, it is named on the card
    expect(maximo[0]!.note).toMatch(/also Move Maximo/);
  });

  it("follows delivery order, not date, when a plan waits for another", () => {
    // dated earlier, but it waits for s2 — so s2's touches are recorded first
    const early = set("s0", "After the rewire", "2026-01-01", [change("c6", "retireEntity", { entityId: "b" })]);
    const list = touches(ESTATE, WIRES, [...SETS, early], [{ changeSetId: "s0", dependsOnId: "s2" }]);
    const scada = list.find((t) => t.name === "SCADA");
    expect(scada?.effect).toBe("connected"); // from s2, which is delivered first
  });

  it("knows a system a plan introduces is not in the graph yet", () => {
    const list = touches(ESTATE, WIRES, SETS, []);
    expect(list.find((t) => t.name === "Asset Hub")?.planned).toBe(true);
    expect(list.find((t) => t.name === "Maximo")?.planned).toBe(false);
  });
});

describe("the roadmap as a document", () => {
  it("makes an ordinary card per object, carrying the plan as attributes", () => {
    const { document } = roadmapDocument(ESTATE, WIRES, SETS, []);
    const maximo = cards(document).find((el) => el.type === "card" && el.title === "Maximo");
    expect(maximo).toMatchObject({
      type: "card",
      attributes: { when: "2027-03-01", change: "Retire Maximo", effect: "Retired" },
    });
  });

  it("says which object each card is about without being that object", () => {
    const { document } = roadmapDocument(ESTATE, WIRES, SETS, []);
    // never `entityId`: that would make the board write the change note into Maximo's description
    expect(cards(document).every((el) => el.meta?.entityId === undefined)).toBe(true);
    expect(cards(document).find((el) => el.title === "Maximo")?.meta).toEqual({ about: "a", planned: false });
    expect(cards(document).find((el) => el.title === "Asset Hub")?.meta).toMatchObject({ planned: true });
  });

  it("draws lanes and a labelled axis, so it reads as a roadmap without being one", () => {
    const { document } = roadmapDocument(ESTATE, WIRES, SETS, []);
    const els = Object.values(document.elements);
    const lanes = els.flatMap((el) => (el.type === "frame" ? [el.title] : []));
    expect(lanes).toEqual(expect.arrayContaining(["Retired", "Introduced", "Changed", "Connected"]));
    const periods = els.flatMap((el) => (el.type === "text" && el.variant === "section" && el.title.endsWith("2027") ? [el.title] : []));
    // every month between the first plan and the last, so an empty stretch is visible
    expect(periods).toEqual(["March 2027", "April 2027", "May 2027", "June 2027", "July 2027", "August 2027", "September 2027"]);
    // nothing sits on top of anything else
    const xs = cards(document).map((el) => `${el.x},${el.y}`);
    expect(new Set(xs).size).toBe(xs.length);
  });

  it("can lane by the plan responsible instead of by what happens", () => {
    const { document } = roadmapDocument(ESTATE, WIRES, SETS, [], { lanesBy: "change set" });
    const lanes = Object.values(document.elements).flatMap((el) => (el.type === "frame" ? [el.title] : []));
    expect(lanes.sort()).toEqual(["Retire Maximo", "Rewire billing"]);
  });

  it("takes only the change sets asked for", () => {
    const { document, placed } = roadmapDocument(ESTATE, WIRES, SETS, [], { changeSetIds: ["s2"] });
    expect(cards(document).map((el) => el.title).sort()).toEqual(["Billing", "SCADA"]);
    expect(placed).toBe(2);
  });

  it("leaves delivered plans out — a roadmap is what is still ahead", () => {
    const done = [SETS[0]!, { ...SETS[1]!, status: "delivered" as const }];
    const { document } = roadmapDocument(ESTATE, WIRES, done, []);
    expect(cards(document).map((el) => el.title).sort()).toEqual(["Asset Hub", "Maximo"]);
  });

  it("parks the objects of an undated plan rather than dropping them", () => {
    const undatedSet = set("s4", "Someday", "", [change("c7", "retireEntity", { entityId: "d" })]);
    const { document, undated } = roadmapDocument(ESTATE, WIRES, [...SETS, undatedSet], []);
    expect(undated).toBe(1);
    expect(cards(document).map((el) => el.title)).toContain("Historian");
  });

  it("says what it is at the top, and is empty rather than wrong with no plans", () => {
    const { document, placed } = roadmapDocument(ESTATE, WIRES, [], [], { title: "FY27" });
    const heading = Object.values(document.elements).find((el) => el.type === "text" && el.title === "FY27");
    expect(heading).toBeTruthy();
    expect(placed).toBe(0);
    expect(cards(document)).toHaveLength(0);
  });
});
