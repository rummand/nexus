import { describe, expect, it } from "vitest";
import type { MetaModel } from "./metamodel";
import { typeGraph, typeGraphSummary } from "./metamodel-graph";

const node = (name: string, instances = 1) => ({ id: name, name, description: "", color: "#000", parentId: null, instances, fields: [], presence: "declared" as const });

const model: MetaModel = {
  nodeTypes: [node("Application", 5), node("Server", 2), node("Capability", 0)],
  relationTypes: [
    {
      id: "rt1", name: "depends on", description: "", instances: 3,
      rules: [{ id: "r1", fromType: "Application", toType: "Application", cardinality: "many-to-many" }],
      observedPairs: [
        { fromType: "Application", toType: "Application", count: 2, declared: true },
        { fromType: "Application", toType: "Server", count: 1, declared: false }, // breaks the rule
      ],
      presence: "declared",
    },
    {
      id: null, name: "runs on", description: "", instances: 4,
      rules: [], // no rules → nothing can violate
      observedPairs: [{ fromType: "Application", toType: "Server", count: 4, declared: false }],
      presence: "undeclared",
    },
    {
      id: "rt3", name: "realises", description: "", instances: 0,
      rules: [{ id: "r3", fromType: "Application", toType: "Capability", cardinality: "many-to-many" }],
      observedPairs: [], // declared but unused
      presence: "unused",
    },
  ],
  totals: { entities: 7, relations: 7, undeclaredNodeTypes: 0, undeclaredRelationTypes: 1, violations: 1 },
};

describe("typeGraph", () => {
  it("classifies edges as rule, observed or violation", () => {
    const g = typeGraph(model);
    const find = (rel: string, to: string) => g.edges.find((e) => e.relation === rel && e.to === to)!;
    expect(find("depends on", "Application").origin).toBe("rule");
    expect(find("depends on", "Application").count).toBe(2); // rule, with data behind it
    expect(find("depends on", "Server").origin).toBe("violation"); // rules exist, this pair is not one
    expect(find("runs on", "Server").origin).toBe("observed");     // no rules → nothing to violate
    expect(find("realises", "Capability")).toMatchObject({ origin: "rule", count: 0 }); // declared, unused
  });

  it("marks self-loops, which need a different shape", () => {
    const g = typeGraph(model);
    expect(g.edges.find((e) => e.relation === "depends on" && e.to === "Application")!.selfLoop).toBe(true);
    expect(g.edges.find((e) => e.relation === "runs on")!.selfLoop).toBe(false);
  });

  it("does not duplicate an edge that is both a rule and observed", () => {
    const g = typeGraph(model);
    expect(g.edges.filter((e) => e.relation === "depends on" && e.from === "Application" && e.to === "Application")).toHaveLength(1);
  });

  it("adds a node for a type named only by a rule, so no edge dangles", () => {
    const withGhost: MetaModel = {
      ...model,
      nodeTypes: [node("Application")],
      relationTypes: [{ id: "x", name: "hosts", description: "", instances: 0, rules: [{ id: "rx", fromType: "Application", toType: "Ghost", cardinality: "many-to-many" }], observedPairs: [], presence: "unused" }],
    };
    const g = typeGraph(withGhost);
    expect(g.nodes.map((n) => n.name).sort()).toEqual(["Application", "Ghost"]);
    expect(g.nodes.find((n) => n.name === "Ghost")!.instances).toBe(0);
  });

  it("summarises the graph for the legend", () => {
    expect(typeGraphSummary(typeGraph(model))).toEqual({ nodes: 3, edges: 4, rules: 2, observed: 1, violations: 1 });
  });
});
