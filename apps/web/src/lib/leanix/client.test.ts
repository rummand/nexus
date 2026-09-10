import { describe, expect, it } from "vitest";
import { dedupeRelations, inverseName, pageQuery, relationsQuery, unalias, type TypeShape } from "./client";
import type { FactSheetRelation } from "./types";

/**
 * Reading a real LeanIX workspace (§5.73).
 *
 * Every case here comes from an actual failure against Energinet's workspace, where the first
 * version of this importer had never run. It had only ever been exercised against a stub built
 * to match the query, which is the most comfortable and least useful kind of test: the query was
 * wrong in three separate ways and the stub agreed with all of them.
 */

const shape = (name: string, fields: string[], relations: string[] = []): TypeShape => ({ name, fields, relations });

describe("building the page query", () => {
  it("aliases every per-type field with its type", () => {
    /*
     * GraphQL refuses a query where two fragments select the same field name and the two return
     * different types — and LeanIX does this constantly: `technicalSuitability` is an
     * `ApplicationTechnicalSuitability` on one type and an `ITComponentTechnicalSuitability` on
     * another. Three such conflicts rejected the entire 455-fact-sheet export.
     */
    const q = pageQuery([shape("Application", ["technicalSuitability"]), shape("ITComponent", ["technicalSuitability"])]);
    expect(q).toContain("Application__technicalSuitability: technicalSuitability");
    expect(q).toContain("ITComponent__technicalSuitability: technicalSuitability");
  });

  it("asks for updatedAt on the interface, never on a type called FactSheet", () => {
    // There is no such type. `...on FactSheet` is what took the whole export down.
    const q = pageQuery([shape("Application", ["lifecycle"])]);
    expect(q).toContain("updatedAt");
    expect(q).not.toContain("on FactSheet");
  });

  it("leaves out a type that carries nothing of its own", () => {
    expect(pageQuery([shape("Provider", [])])).not.toContain("on Provider");
  });

  it("puts the plain field name back", () => {
    expect(unalias("Application__lifecycle")).toBe("lifecycle");
    expect(unalias("updatedAt")).toBe("updatedAt");
  });
});

describe("building the relations query", () => {
  it("only asks for a relation inside a fragment on the type that has it", () => {
    // Relation fields are named after the pair of types they join, so none of them exists on
    // the interface — asking for them at node level is why every relation was lost.
    const q = relationsQuery([shape("Application", [], ["relApplicationToITComponent"])]);
    expect(q).toContain("...on Application {");
    expect(q).toContain("relApplicationToITComponent");
    expect(q).toContain("edges { node { factSheet { id } } }");
  });

  it("aliases them too, for the same reason as the fields", () => {
    const q = relationsQuery([shape("Application", [], ["relToChild"]), shape("BusinessCapability", [], ["relToChild"])]);
    expect(q).toContain("Application__relToChild: relToChild");
    expect(q).toContain("BusinessCapability__relToChild: relToChild");
  });
});

describe("the same edge, described twice", () => {
  const rel = (fromId: string, type: string, toId: string): FactSheetRelation => ({ fromId, toId, type, fields: {} });

  it("knows the generic inverses", () => {
    expect(inverseName("relToChild")).toBe("relToParent");
    expect(inverseName("relToParent")).toBe("relToChild");
    expect(inverseName("relToPredecessor")).toBe("relToSuccessor");
    expect(inverseName("relToRequiredBy")).toBe("relToRequires");
  });

  it("derives the inverse of a named pair from the name", () => {
    expect(inverseName("relApplicationToBusinessCapability")).toBe("relBusinessCapabilityToApplication");
    expect(inverseName("relObjectiveToInitiative")).toBe("relInitiativeToObjective");
  });

  it("says nothing about a name with no inverse in it", () => {
    expect(inverseName("relSomething")).toBeNull();
  });

  it("keeps one row per edge", () => {
    /*
     * Energinet's workspace returned 1,242 relation rows describing 621 edges. Importing all of
     * them would put every connection in the graph twice — doubled degrees in the explorer and
     * doubled counts on every triple in the meta-model.
     */
    const both = [rel("cap", "relToChild", "sub"), rel("sub", "relToParent", "cap")];
    expect(dedupeRelations(both)).toHaveLength(1);
  });

  it("picks the same direction every time, so a re-import is not a reversal", () => {
    const forwards = dedupeRelations([rel("cap", "relToChild", "sub"), rel("sub", "relToParent", "cap")]);
    const backwards = dedupeRelations([rel("sub", "relToParent", "cap"), rel("cap", "relToChild", "sub")]);
    expect(forwards).toEqual(backwards);
  });

  it("collapses a named pair onto one direction", () => {
    const both = [
      rel("app", "relApplicationToBusinessCapability", "cap"),
      rel("cap", "relBusinessCapabilityToApplication", "app"),
    ];
    const out = dedupeRelations(both);
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe("relApplicationToBusinessCapability");
    expect(out[0]).toMatchObject({ fromId: "app", toId: "cap" });
  });

  it("keeps two different relations between the same pair", () => {
    // Collapsing on the pair of ids alone would silently lose one of these.
    const two = [rel("a", "relApplicationToITComponent", "b"), rel("a", "relToChild", "b")];
    expect(dedupeRelations(two)).toHaveLength(2);
  });

  it("keeps a relation whose inverse cannot be worked out", () => {
    // Losing a real edge is far worse than keeping a duplicate.
    expect(dedupeRelations([rel("a", "relMystery", "b")])).toHaveLength(1);
  });

  it("drops an exact duplicate of the same direction", () => {
    const twice = [rel("a", "relToChild", "b"), rel("a", "relToChild", "b")];
    expect(dedupeRelations(twice)).toHaveLength(1);
  });
});
