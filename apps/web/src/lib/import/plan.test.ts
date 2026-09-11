import { describe, expect, it } from "vitest";
import { proposeMapping } from "./map";
import { stage, type FileInput } from "./stage";
import { review } from "./review";
import { planImport, planTotals } from "./plan";
import type { MatchTarget } from "./match";

/**
 * What an approved import *would* do, before either destination writes anything (§5.89).
 *
 * The same list feeds the graph and the branch, so these are the tests that matter most in the
 * pipeline: get this wrong and the two destinations disagree about what an import is.
 */

const file = (name: string, headers: string[], rows: string[][]): FileInput =>
  ({ name, headers, rows, columns: proposeMapping(headers, rows) });

const target = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): MatchTarget =>
  ({ id, name, kind, attributes });

/** Stage a file, accept everything, and plan it — the whole pipeline, minus the database. */
function plan(input: {
  files: FileInput[];
  targets?: MatchTarget[];
  wired?: Array<{ fromEntityId: string; toEntityId: string; kind: string }>;
  hierarchy?: Array<{ id: string; parentId: string | null }>;
}) {
  const targets = input.targets ?? [];
  const records = stage(input.files);
  const rows = review(records, targets, { kinds: targets.map((t) => t.kind) }).rows;
  let entities = 0;
  let relations = 0;
  return planImport({
    taking: rows.filter((r) => r.decision === "accept"),
    targets,
    wired: input.wired ?? [],
    hierarchy: input.hierarchy ?? targets.map((t) => ({ id: t.id, parentId: null })),
    mintEntityId: () => `ent_new${++entities}`,
    mintRelationId: () => `rel_new${++relations}`,
  });
}

describe("planning an import", () => {
  it("introduces what the workspace does not have", () => {
    const { intents } = plan({ files: [file("apps.csv", ["Name", "Class"], [["Asset Hub", "Application"]])] });
    expect(intents.map((i) => i.op)).toEqual(["addEntity"]);
    expect(intents[0]!.payload.name).toBe("Asset Hub");
    expect(intents[0]!.fresh).toBe(true);
  });

  it("changes only the fields that actually differ on something it matched", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class", "Business owner", "Criticality"], [["Maximo", "Application", "Grid Operations", "High"]])],
      targets: [target("ent_maximo", "Maximo", "Application", { "business owner": "Grid Operations" })],
    });
    // The owner already says what the file says, so it is not a change; the criticality is.
    expect(intents.map((i) => i.op)).toEqual(["setAttribute"]);
    expect(intents[0]).toMatchObject({ entityId: "ent_maximo", from: "", payload: { key: "criticality", value: "High" } });
  });

  it("keeps the value that was there, which is what makes a rollback honest", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class", "Business owner"], [["Maximo", "Application", "Finance"]])],
      targets: [target("ent_maximo", "Maximo", "Application", { "business owner": "Grid Operations" })],
    });
    expect(intents[0]).toMatchObject({ op: "setAttribute", from: "Grid Operations", payload: { value: "Finance" } });
  });

  it("retypes rather than writing the type as an attribute", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class"], [["Maximo", "Platform"]])],
      targets: [target("ent_maximo", "Maximo", "Application")],
    });
    expect(intents.map((i) => i.op)).toEqual(["retypeEntity"]);
    expect(intents[0]).toMatchObject({ payload: { kind: "Platform" }, from: "Application" });
  });

  it("connects both ends even when the other end is introduced by the same import", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class", "Depends on"], [["Asset Hub", "Application", "Maximo"], ["Maximo", "Application", ""]])],
    });
    const relation = intents.find((i) => i.op === "addRelation");
    expect(relation).toBeDefined();
    expect(relation!.payload.fromEntityId).toBe("ent_new1");
    expect(relation!.payload.toEntityId).toBe("ent_new2");
  });

  it("writes nothing for a relation that is already wired, so a second read is a no-op", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class", "Depends on"], [["Maximo", "Application", "SAP PM"]])],
      targets: [target("ent_maximo", "Maximo"), target("ent_sap", "SAP PM")],
      wired: [{ fromEntityId: "ent_maximo", toEntityId: "ent_sap", kind: "depends on" }],
    });
    expect(intents.filter((i) => i.op === "addRelation")).toHaveLength(0);
  });

  it("puts things inside what their row named", () => {
    const { intents } = plan({
      files: [file("caps.csv", ["Name", "Class", "Parent"], [["Meter reading", "Capability", "Metering"]])],
      targets: [target("ent_metering", "Metering", "Capability")],
    });
    const move = intents.find((i) => i.op === "setParent");
    expect(move).toBeDefined();
    expect(move!.payload.parentId).toBe("ent_metering");
  });

  it("drops a move that would close a ring rather than making one", () => {
    const { intents } = plan({
      files: [file("caps.csv", ["Name", "Class", "Parent"], [["Metering", "Capability", "Meter reading"]])],
      targets: [target("ent_metering", "Metering", "Capability"), target("ent_reading", "Meter reading", "Capability")],
      hierarchy: [{ id: "ent_metering", parentId: null }, { id: "ent_reading", parentId: "ent_metering" }],
    });
    expect(intents.filter((i) => i.op === "setParent")).toHaveLength(0);
  });

  it("counts what it would do in the words the screens use", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class", "Depends on"], [["Asset Hub", "Application", "Maximo"], ["Maximo", "Application", ""]])],
    });
    expect(planTotals(intents)).toEqual({ created: 2, updated: 0, connected: 1, nested: 0 });
  });

  it("counts an object with three changed fields once", () => {
    const { intents } = plan({
      files: [file("apps.csv", ["Name", "Class", "Business owner", "Short description"], [["Maximo", "Platform", "Finance", "Work orders"]])],
      targets: [target("ent_maximo", "Maximo", "Application")],
    });
    expect(planTotals(intents).updated).toBe(1);
  });
});
