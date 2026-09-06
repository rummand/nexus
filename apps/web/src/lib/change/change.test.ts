import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { impactOf } from "./impact";
import { project, projectAll, settled } from "./project";
import { summarise, type Change } from "./types";

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes), source: "canvas", createdAt: "2026-01-01", updatedAt: "2026-01-01" }) as s.Entity;

const relation = (id: string, from: string, to: string, kind = ""): s.Relation =>
  ({ id, workspaceId: "ws", fromEntityId: from, toEntityId: to, kind, attributes: "{}", source: "canvas", createdAt: "2026-01-01", updatedAt: "2026-01-01" }) as s.Relation;

const change = (id: string, op: Change["op"], fields: Partial<Change> = {}): Change =>
  ({ id, op, entityId: null, relationId: null, payload: {}, note: "", createdAt: "2026-01-01", ...fields });

const ESTATE = [entity("a", "Maximo"), entity("b", "SCADA"), entity("c", "Billing", "Application", { owner: "Finance" }), entity("d", "Data lake", "Data Object")];
const WIRES = [
  relation("r1", "c", "a", "depends on"),
  relation("r2", "a", "d", "feeds"),
  relation("r3", "b", "d", "telemetry"),
];

describe("projecting a change set", () => {
  it("introduces a system that does not exist yet", () => {
    const p = project(ESTATE, WIRES, [change("c1", "addEntity", { entityId: "new1", payload: { kind: "Application", name: "Asset Hub" } })]);
    expect(p.entities.find((e) => e.id === "new1")?.name).toBe("Asset Hub");
    expect(p.added.has("new1")).toBe(true);
    // it is a plan, not a drawing: the source says where it came from
    expect(p.entities.find((e) => e.id === "new1")?.source).toBe("plan");
  });

  it("keeps a retired system in the view, marked, and severs everything attached to it", () => {
    const p = project(ESTATE, WIRES, [change("c1", "retireEntity", { entityId: "a" })]);
    expect(p.retired.has("a")).toBe(true);
    expect(p.entities.some((e) => e.id === "a")).toBe(true); // still shown, so you can see it going
    expect([...p.removedRelations].sort()).toEqual(["r1", "r2"]);
  });

  it("settles into the estate as it would actually be", () => {
    const p = project(ESTATE, WIRES, [change("c1", "retireEntity", { entityId: "a" })]);
    const after = settled(p);
    expect(after.entities.map((e) => e.id)).toEqual(["b", "c", "d"]);
    expect(after.relations.map((r) => r.id)).toEqual(["r3"]);
  });

  it("changes an attribute without touching the graph row", () => {
    const p = project(ESTATE, WIRES, [change("c1", "setAttribute", { entityId: "c", payload: { key: "owner", value: "Grid Operations" } })]);
    expect(parseAttributes(p.entities.find((e) => e.id === "c")!.attributes).owner).toBe("Grid Operations");
    expect(p.changed.has("c")).toBe(true);
    expect(parseAttributes(ESTATE[2]!.attributes).owner).toBe("Finance"); // the original is untouched
  });

  it("lets a new relation point at a system introduced in the same change set", () => {
    const p = project(ESTATE, WIRES, [
      change("c1", "addEntity", { entityId: "new1", payload: { kind: "Application", name: "Asset Hub" } }),
      change("c2", "addRelation", { relationId: "nr1", payload: { fromEntityId: "c", toEntityId: "new1", kind: "depends on" } }),
    ]);
    expect(p.addedRelations.has("nr1")).toBe(true);
    expect(p.relations.find((r) => r.id === "nr1")?.toEntityId).toBe("new1");
  });

  it("says when a plan has gone stale instead of skipping the line", () => {
    const p = project(ESTATE, WIRES, [
      change("c1", "retireEntity", { entityId: "ghost" }),
      change("c2", "setAttribute", { entityId: "ghost", payload: { key: "owner", value: "x" } }),
      change("c3", "removeRelation", { relationId: "r99" }),
    ]);
    expect(p.problems).toHaveLength(3);
    expect(p.problems[0]!.message).toMatch(/no longer in the graph/);
  });

  it("treats a plan that already happened as done, not broken", () => {
    const p = project(ESTATE, WIRES, [change("c1", "addEntity", { entityId: "a", payload: { kind: "Application", name: "Maximo" } })]);
    expect(p.problems).toHaveLength(0);
    expect(p.added.has("a")).toBe(true);
    expect(p.entities.filter((e) => e.id === "a")).toHaveLength(1);
  });

  it("counts what a change set does", () => {
    const p = project(ESTATE, WIRES, [
      change("c1", "addEntity", { entityId: "new1", payload: { kind: "Application", name: "Asset Hub" } }),
      change("c2", "retireEntity", { entityId: "a" }),
    ]);
    expect(summarise(p)).toMatchObject({ additions: 1, retirements: 1, severedRelations: 2, problems: 0 });
  });

  it("projects several change sets in date order", () => {
    const p = projectAll(ESTATE, WIRES, [
      { id: "s2", targetDate: "2027-01-01", changes: [change("c2", "setAttribute", { entityId: "c", payload: { key: "owner", value: "Second" } })] },
      { id: "s1", targetDate: "2026-06-01", changes: [change("c1", "setAttribute", { entityId: "c", payload: { key: "owner", value: "First" } })] },
    ]);
    // the later plan wins, because it happens later
    expect(parseAttributes(p.entities.find((e) => e.id === "c")!.attributes).owner).toBe("Second");
  });
});

describe("impact of a retirement", () => {
  it("finds what depends on the thing going, and in which direction", () => {
    const impact = impactOf(ESTATE, WIRES, ["a"]);
    const billing = impact.dependants.find((d) => d.entity.id === "c");
    const lake = impact.dependants.find((d) => d.entity.id === "d");
    expect(billing?.nature).toBe("depends-on"); // Billing → Maximo, "depends on"
    expect(lake?.nature).toBe("served-by"); // Maximo → Data lake, "feeds"
  });

  it("names the systems that would be left connected to nothing", () => {
    const impact = impactOf(ESTATE, WIRES, ["a"]);
    expect(impact.orphaned.map((e) => e.id)).toEqual(["c"]); // Billing's only relation was to Maximo
    expect(impact.dependants.find((d) => d.entity.id === "d")?.orphaned).toBe(false); // the lake still has SCADA
  });

  it("reaches the second ring", () => {
    const impact = impactOf(ESTATE, WIRES, ["a"]);
    expect(impact.indirect.map((e) => e.id)).toEqual(["b"]); // SCADA is attached to the data lake
  });

  it("does not count a relation between two things that are both going", () => {
    const impact = impactOf(ESTATE, WIRES, ["a", "d"]);
    expect(impact.dependants.map((d) => d.entity.id)).toEqual(["c", "b"]);
    expect(impact.severed.map((r) => r.id).sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("says so plainly when nothing is attached", () => {
    const impact = impactOf(ESTATE, WIRES, ["c"]);
    expect(impact.summary).toMatch(/1 system is attached/);
    expect(impactOf([entity("z", "Lonely")], [], ["z"]).summary).toMatch(/touches nothing else/);
  });

  it("separates a system that feeds the retiring one from one that needs it", () => {
    // Asset Register → Maximo, "master data": the register does not stop working, but its feed
    // has nowhere to go — a decommissioning job people routinely forget.
    const impact = impactOf(ESTATE, [relation("r1", "c", "a", "master data")], ["a"]);
    expect(impact.dependants[0]!.nature).toBe("supplies");
  });

  it("reads the same verb differently depending on which end is going", () => {
    const wires = [relation("r1", "a", "d", "feeds")];
    expect(impactOf(ESTATE, wires, ["a"]).dependants[0]!.nature).toBe("served-by"); // the lake loses an input
    expect(impactOf(ESTATE, wires, ["d"]).dependants[0]!.nature).toBe("supplies"); // Maximo's output has nowhere to land
  });

  it("is honest about a relation whose kind says nothing", () => {
    const impact = impactOf(ESTATE, [relation("r9", "c", "a")], ["a"]);
    expect(impact.dependants[0]!.nature).toBe("connected");
  });
});
