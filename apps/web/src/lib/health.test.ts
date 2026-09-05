import { describe, expect, it } from "vitest";
import { healthLabel, healthReport } from "./health";
import type * as s from "@/db/schema";

const entity = (over: Partial<s.Entity> & { id: string }): s.Entity => ({
  workspaceId: "ws", kind: "Application", name: "X", description: "", attributes: "{}",
  source: "canvas", createdAt: "", updatedAt: "", ...over,
});
const relation = (id: string, from: string, to: string): s.Relation => ({
  id, workspaceId: "ws", fromEntityId: from, toEntityId: to, kind: "depends on",
  attributes: "{}", source: "canvas", createdAt: "", updatedAt: "",
});

const measure = (report: ReturnType<typeof healthReport>, id: string) => report.measures.find((m) => m.id === id)!;

describe("estate health", () => {
  it("scores a clean estate at the top", () => {
    const entities = [
      entity({ id: "a", name: "Maximo", source: "intake:src1", attributes: JSON.stringify({ owner: "Ops", lifecycle: "live" }) }),
      entity({ id: "b", name: "SCADA", source: "intake:src1", attributes: JSON.stringify({ owner: "Ops", lifecycle: "live" }) }),
    ];
    const report = healthReport(entities, [relation("r", "a", "b")]);
    expect(report.score).toBe(100);
    expect(healthLabel(report.score)).toBe("healthy");
    expect(report.measures.every((m) => m.offenders === 0)).toBe(true);
  });

  it("counts a system with nothing behind it as unsourced, and says so in words", () => {
    const report = healthReport([
      entity({ id: "a", name: "Drawn by hand" }),
      entity({ id: "b", name: "From a meeting", source: "intake:src1" }),
    ], []);
    const provenance = measure(report, "provenance");
    expect(provenance.offenders).toBe(1);
    expect(provenance.score).toBe(50);
    expect(provenance.entityIds).toEqual(["a"]);
    expect(provenance.detail).toContain("1 system was");
  });

  it("treats a node a source points at as explained", () => {
    const entities = [entity({ id: "m", kind: "Meeting", name: "Sync", source: "intake:s" }), entity({ id: "a", name: "Maximo" })];
    const report = healthReport(entities, [relation("r", "m", "a")]);
    expect(measure(report, "provenance").offenders).toBe(0);
  });

  it("finds the duplicate the graph keeps showing twice", () => {
    const report = healthReport([
      entity({ id: "a", name: "Asset Register" }),
      entity({ id: "b", name: "asset register" }),
      entity({ id: "c", name: "Maximo" }),
    ], []);
    const duplicates = measure(report, "duplicates");
    expect(duplicates.offenders).toBe(2);
    expect(duplicates.detail).toContain("Asset Register");
    expect(duplicates.entityIds.sort()).toEqual(["a", "b"]);
  });

  it("does not judge intake's own records as estate", () => {
    // a Decision has no owner and no lifecycle, and that is not a fault
    const report = healthReport([
      entity({ id: "d", kind: "Decision", name: "We decided to replace Maximo", source: "intake:s" }),
      entity({ id: "a", name: "Maximo", source: "intake:s", attributes: JSON.stringify({ owner: "Ops", lifecycle: "live" }) }),
    ], [relation("r", "d", "a")]);
    expect(measure(report, "ownership").population).toBe(1);
    expect(measure(report, "ownership").offenders).toBe(0);
    expect(measure(report, "lifecycle").offenders).toBe(0);
  });

  it("counts orphans, untyped nodes and missing attributes", () => {
    const report = healthReport([
      entity({ id: "a", name: "Alone" }),
      entity({ id: "b", kind: "", name: "No kind" }),
      entity({ id: "c", name: "Joined", attributes: JSON.stringify({ owner: "Ops" }) }),
      entity({ id: "d", name: "Also joined", attributes: JSON.stringify({ owner: "Ops", lifecycle: "live" }) }),
    ], [relation("r", "c", "d")]);
    expect(measure(report, "orphans").offenders).toBe(2); // a and b
    expect(measure(report, "untyped").offenders).toBe(1);
    // b has no kind, so it is not part of the estate: you cannot demand an owner for a thing
    // whose type nobody has decided. Typing is the measure that covers it.
    expect(measure(report, "ownership").population).toBe(3);
    expect(measure(report, "ownership").offenders).toBe(1); // only a, of the typed systems
    expect(measure(report, "lifecycle").offenders).toBe(2); // a and c
  });

  it("weights the headline by how much of the estate each measure covers", () => {
    // one untyped node out of many should not halve the score the way a tiny measure would
    const many = Array.from({ length: 50 }, (_, i) =>
      entity({ id: `x${i}`, name: `App ${i}`, source: "intake:s", attributes: JSON.stringify({ owner: "Ops", lifecycle: "live" }) }));
    const relations = many.slice(1).map((e, i) => relation(`r${i}`, many[0]!.id, e.id));
    const report = healthReport([...many, entity({ id: "u", kind: "", name: "Odd one", source: "intake:s" })], relations);
    expect(report.score).toBeGreaterThan(90);
    expect(measure(report, "untyped").offenders).toBe(1);
  });

  it("is unbothered by an empty workspace", () => {
    const report = healthReport([], []);
    expect(report.score).toBe(100);
    expect(report.entities).toBe(0);
  });
});
