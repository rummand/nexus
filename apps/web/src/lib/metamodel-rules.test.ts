import { describe, expect, it } from "vitest";
import { blockedFrom, filterTriples, ruleSummary, triples } from "./metamodel-rules";
import type { MetaModel, MetaRelationType } from "./metamodel";

const rel = (over: Partial<MetaRelationType> = {}): MetaRelationType => ({
  id: "rt_uses", name: "uses", description: "", instances: 0,
  rules: [], observedPairs: [], presence: "declared", framework: "", layerId: null,
  ...over,
});

const model = (relationTypes: MetaRelationType[]): MetaModel => ({
  nodeTypes: [], relationTypes, layers: [],
  totals: { entities: 0, relations: 0, undeclaredNodeTypes: 0, undeclaredRelationTypes: 0, violations: 0 },
});

describe("the triple is the unit", () => {
  it("calls a declared rule with instances behind it in use", () => {
    const m = model([rel({
      rules: [{ id: "r1", fromType: "Application", toType: "IT Component", cardinality: "many-to-many" }],
      observedPairs: [{ fromType: "Application", toType: "IT Component", count: 12, declared: true }],
    })]);
    const [t] = triples(m);
    expect(t).toMatchObject({ from: "Application", relation: "uses", to: "IT Component", status: "in-use", instances: 12 });
    expect(t!.cardinality).toBe("many-to-many");
  });

  it("calls a declared rule nothing does unused, rather than hiding it", () => {
    // A rule with no instances is either a future that never arrived or a real gap. Both are
    // worth seeing; neither is worth deleting on the model's own initiative.
    const m = model([rel({ rules: [{ id: "r1", fromType: "A", toType: "B", cardinality: "" }] })]);
    expect(triples(m)[0]).toMatchObject({ status: "unused", instances: 0 });
  });

  it("calls a pairing the data does and nobody declared observed — a proposal, not a violation", () => {
    const m = model([rel({ observedPairs: [{ fromType: "Server", toType: "Rack", count: 3, declared: false }] })]);
    expect(triples(m)[0]).toMatchObject({ status: "observed", instances: 3, ruleId: null });
  });

  it("does not list the same triple twice when a rule and the data agree", () => {
    const m = model([rel({
      rules: [{ id: "r1", fromType: "A", toType: "B", cardinality: "" }],
      observedPairs: [{ fromType: "A", toType: "B", count: 5, declared: true }],
    })]);
    expect(triples(m)).toHaveLength(1);
    expect(triples(m)[0]!.ruleId).toBe("r1");
  });

  it("keeps triples of the same pair under different relationships apart", () => {
    // "Application uses IT Component" and "Application replaces IT Component" are two statements
    // and an organisation can hold one and reject the other.
    const m = model([
      rel({ id: "rt_uses", name: "uses", observedPairs: [{ fromType: "A", toType: "B", count: 2, declared: false }] }),
      rel({ id: "rt_repl", name: "replaces", observedPairs: [{ fromType: "A", toType: "B", count: 1, declared: false }] }),
    ]);
    expect(triples(m).map((t) => t.relation)).toEqual(["uses", "replaces"]);
  });

  it("puts the heaviest triple first, whatever it is called", () => {
    const m = model([rel({
      observedPairs: [
        { fromType: "Zebra", toType: "X", count: 400, declared: false },
        { fromType: "Aardvark", toType: "Y", count: 1, declared: false },
      ],
    })]);
    expect(triples(m).map((t) => t.from)).toEqual(["Zebra", "Aardvark"]);
  });
});

describe("what the rules add up to", () => {
  it("measures coverage in connections, not in rows", () => {
    /*
     * One undeclared triple carrying four hundred connections matters more than nine carrying
     * one each. Counting rows would report the opposite and call the model nearly finished.
     */
    const m = model([rel({
      rules: [{ id: "r1", fromType: "A", toType: "B", cardinality: "" }],
      observedPairs: [
        { fromType: "A", toType: "B", count: 100, declared: true },
        { fromType: "C", toType: "D", count: 300, declared: false },
      ],
    })]);
    const s = ruleSummary(triples(m));
    expect(s.covered).toBe(100);
    expect(s.total).toBe(400);
    expect(s.share).toBe(25);
    expect(s.verdict).toMatch(/^25% of connections follow a declared rule/);
  });

  it("says so plainly when the model allows everything the estate does", () => {
    const m = model([rel({
      rules: [{ id: "r1", fromType: "A", toType: "B", cardinality: "" }],
      observedPairs: [{ fromType: "A", toType: "B", count: 4, declared: true }],
    })]);
    expect(ruleSummary(triples(m)).verdict).toBe("Every connection in the estate is one the model allows.");
  });

  it("mentions unused rules only once nothing is undeclared, because that is the smaller problem", () => {
    const m = model([rel({ rules: [{ id: "r1", fromType: "A", toType: "B", cardinality: "" }] })]);
    expect(ruleSummary(triples(m)).verdict).toMatch(/One rule has nothing doing it yet/);
  });

  it("reports no share at all rather than 0% when there are no connections", () => {
    expect(ruleSummary([]).share).toBeNull();
    expect(ruleSummary([]).verdict).toMatch(/No relationships yet/);
  });
});

describe("promoting an observation to a rule", () => {
  it("is blocked while the relationship type itself is undeclared, and says why", () => {
    // A rule constrains a type. You cannot constrain a word the model has not agreed is a word.
    const m = model([rel({ id: null, presence: "undeclared", observedPairs: [{ fromType: "A", toType: "B", count: 1, declared: false }] })]);
    const why = blockedFrom(triples(m)[0]!);
    expect(why).toMatch(/Declare the "uses" relationship type first/);
  });

  it("is allowed once the type exists", () => {
    const m = model([rel({ observedPairs: [{ fromType: "A", toType: "B", count: 1, declared: false }] })]);
    expect(blockedFrom(triples(m)[0]!)).toBeNull();
  });

  it("says nothing about a triple that is already a rule", () => {
    const m = model([rel({ rules: [{ id: "r1", fromType: "A", toType: "B", cardinality: "" }] })]);
    expect(blockedFrom(triples(m)[0]!)).toBeNull();
  });
});

describe("finding one", () => {
  const m = model([rel({
    rules: [{ id: "r1", fromType: "Application", toType: "IT Component", cardinality: "" }],
    observedPairs: [
      { fromType: "Application", toType: "IT Component", count: 9, declared: true },
      { fromType: "Server", toType: "Rack", count: 2, declared: false },
    ],
  })]);
  const all = triples(m);

  it("searches across all three parts, because that is how the sentence is remembered", () => {
    expect(filterTriples(all, "rack", "all")).toHaveLength(1);
    expect(filterTriples(all, "application uses", "all")).toHaveLength(1);
  });

  it("narrows to one status", () => {
    expect(filterTriples(all, "", "observed").map((t) => t.from)).toEqual(["Server"]);
    expect(filterTriples(all, "", "in-use").map((t) => t.from)).toEqual(["Application"]);
    expect(filterTriples(all, "", "unused")).toEqual([]);
  });
});
