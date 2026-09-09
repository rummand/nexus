import { describe, expect, it } from "vitest";
import { STANDARD_MODELS, planApply, planSummary, standardModel } from "./metamodel-standards";
import type { MetaModel, MetaNodeType, MetaRelationType } from "./metamodel";

/**
 * Standard metamodels to start from (§5.56).
 *
 * The property that makes these safe to offer to a workspace that has been running for a year:
 * applying one is purely additive, and applying it twice does nothing the second time.
 */

const nodeType = (name: string, fields: string[] = []): MetaNodeType => ({
  id: `nt_${name}`, name, description: "theirs", color: "", parentId: null, instances: 0, presence: "declared",
  fields: fields.map((key) => ({ id: `f_${key}`, key, dataType: "text", description: "", required: false, options: [], usage: 0, presence: "declared" as const })),
});
const relType = (name: string, rules: Array<[string, string]> = []): MetaRelationType => ({
  id: `rt_${name}`, name, description: "", instances: 0, presence: "declared", observedPairs: [],
  rules: rules.map(([fromType, toType], i) => ({ id: `r${i}`, fromType, toType, cardinality: "many-to-many" })),
});
const model = (nodeTypes: MetaNodeType[] = [], relationTypes: MetaRelationType[] = []): MetaModel => ({
  nodeTypes, relationTypes,
  totals: { entities: 0, relations: 0, undeclaredNodeTypes: 0, undeclaredRelationTypes: 0, violations: 0 },
});

const portfolio = standardModel("application-portfolio")!;

describe("the standards themselves", () => {
  it("are each small enough to be a starting point rather than somebody else's finished model", () => {
    for (const m of STANDARD_MODELS) {
      expect(m.nodeTypes.length, m.name).toBeLessThanOrEqual(6);
      expect(m.relationTypes.length, m.name).toBeLessThanOrEqual(6);
    }
  });

  it("say what question they answer and where the practice comes from", () => {
    for (const m of STANDARD_MODELS) {
      expect(m.answers, m.name).toMatch(/\?$/);
      expect(m.grounding.length, m.name).toBeGreaterThan(40);
    }
  });

  it("only ever constrain a relation between types the same model declares", () => {
    // A rule pointing at a type this standard does not create would be a dangling rule the moment
    // it was applied to an empty workspace.
    for (const m of STANDARD_MODELS) {
      const names = new Set(m.nodeTypes.map((t) => t.name));
      for (const rt of m.relationTypes) {
        for (const rule of rt.rules) {
          expect(names.has(rule.from), `${m.name}: ${rt.name} from ${rule.from}`).toBe(true);
          expect(names.has(rule.to), `${m.name}: ${rt.name} to ${rule.to}`).toBe(true);
        }
      }
    }
  });

  it("give every enum field a vocabulary, or it constrains nothing", () => {
    for (const m of STANDARD_MODELS) {
      for (const t of m.nodeTypes) {
        for (const f of t.fields) {
          if (f.dataType === "enum") expect(f.options?.length, `${m.name}: ${t.name}.${f.key}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it("do not require a field somebody cannot know on day one", () => {
    // A required field the first import cannot fill makes every object non-conformant on arrival,
    // which teaches people to ignore conformance.
    for (const m of STANDARD_MODELS) {
      for (const t of m.nodeTypes) {
        const required = t.fields.filter((f) => f.required).length;
        expect(required, `${m.name}: ${t.name}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("applying one", () => {
  it("adds the lot to an empty workspace", () => {
    const plan = planApply(portfolio, model());
    expect(plan.nodeTypes.add).toEqual(portfolio.nodeTypes.map((t) => t.name));
    expect(plan.nodeTypes.already).toEqual([]);
    expect(plan.noop).toBe(false);
    expect(planSummary(plan)).toMatch(/^Adds 5 object types/);
  });

  it("leaves what is already declared exactly as it is", () => {
    const plan = planApply(portfolio, model([nodeType("Application", ["owner"])]));
    expect(plan.nodeTypes.already).toContain("Application");
    expect(plan.nodeTypes.add).not.toContain("Application");
    // Its own `owner` field survives; the ones it does not have are offered.
    expect(plan.fields.already).toContainEqual({ type: "Application", key: "owner" });
    expect(plan.fields.add).toContainEqual({ type: "Application", key: "lifecycle" });
  });

  it("matches names case- and space-insensitively, because people type", () => {
    const plan = planApply(portfolio, model([nodeType("  application  ")]));
    expect(plan.nodeTypes.already).toContain("Application");
  });

  it("does not count a type that only grew from the data as declared", () => {
    const emergent: MetaNodeType = { ...nodeType("Application"), id: null, presence: "undeclared" };
    const plan = planApply(portfolio, model([emergent]));
    // The kind exists in the data but nobody declared it, so the standard still has something to say.
    expect(plan.nodeTypes.add).toContain("Application");
  });

  it("keeps rules it already has and adds the ones it does not", () => {
    const plan = planApply(portfolio, model([], [relType("depends on", [["Application", "Application"]])]));
    expect(plan.relationTypes.already).toContain("depends on");
    expect(plan.rules.already).toContainEqual({ type: "depends on", from: "Application", to: "Application" });
    expect(plan.rules.add.some((r) => r.type === "supports")).toBe(true);
  });

  it("does nothing the second time", () => {
    const full = model(
      portfolio.nodeTypes.map((t) => nodeType(t.name, t.fields.map((f) => f.key))),
      portfolio.relationTypes.map((t) => relType(t.name, t.rules.map((r) => [r.from, r.to] as [string, string]))),
    );
    const plan = planApply(portfolio, full);
    expect(plan.noop).toBe(true);
    expect(planSummary(plan)).toMatch(/already declared/);
  });

  it("is unknown by an unknown id rather than guessing", () => {
    expect(standardModel("nope")).toBeNull();
  });
});
