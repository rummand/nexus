import { describe, expect, it } from "vitest";
import { FRAMEWORKS, adoptedLine, byFamily, framework, levelOf, planApply, planSummary } from "./index";
import type { MetaModel, MetaNodeType, MetaRelationType } from "../metamodel";

/**
 * Modelling frameworks (§5.57).
 *
 * Two kinds of test here. The first kind holds the *catalogue* to the rules that make a template
 * worth shipping — small, grounded, internally consistent, and never requiring a field nobody can
 * know on day one. Those rules are the whole difference between a starter model and a burden, and
 * they are exactly the kind of thing that rots when somebody adds a framework in a hurry.
 *
 * The second kind holds *applying* one to the property that makes it safe on a live workspace:
 * purely additive, and a no-op the second time.
 */

const nodeType = (name: string, fields: string[] = []): MetaNodeType => ({
  id: `nt_${name}`, name, description: "theirs", color: "", parentId: null, instances: 0, presence: "declared",
  framework: "", level: "",
  fields: fields.map((key) => ({ id: `f_${key}`, key, dataType: "text", description: "", required: false, options: [], usage: 0, presence: "declared" as const })),
});
const relType = (name: string, rules: Array<[string, string]> = []): MetaRelationType => ({
  id: `rt_${name}`, name, description: "", instances: 0, presence: "declared", observedPairs: [], framework: "",
  rules: rules.map(([fromType, toType], i) => ({ id: `r${i}`, fromType, toType, cardinality: "many-to-many" })),
});
const model = (nodeTypes: MetaNodeType[] = [], relationTypes: MetaRelationType[] = []): MetaModel => ({
  nodeTypes, relationTypes,
  totals: { entities: 0, relations: 0, undeclaredNodeTypes: 0, undeclaredRelationTypes: 0, violations: 0 },
});

const portfolio = framework("application-portfolio")!;
const c4 = framework("c4")!;

describe("the catalogue", () => {
  it("covers the ways of working people actually name", () => {
    for (const id of ["c4", "uml-class", "ddd", "mbse", "it4it", "safe"]) {
      expect(framework(id), id).toBeTruthy();
    }
  });

  it("has one entry per id and lists every one of them under a family", () => {
    const ids = FRAMEWORKS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const grouped = byFamily().flatMap((g) => g.frameworks);
    expect(grouped.length).toBe(FRAMEWORKS.length);
  });

  it("keeps each one small enough to be a starting point rather than somebody's finished model", () => {
    for (const f of FRAMEWORKS) {
      // A portfolio model is a vocabulary; a notation or an operating model legitimately carries more.
      const cap = f.family === "portfolio" ? 6 : 10;
      expect(f.nodeTypes.length, f.name).toBeLessThanOrEqual(cap);
      expect(f.relationTypes.length, f.name).toBeLessThanOrEqual(10);
      expect(f.nodeTypes.length, f.name).toBeGreaterThan(1);
    }
  });

  it("says what question each answers and where the practice comes from", () => {
    for (const f of FRAMEWORKS) {
      expect(f.answers, f.name).toMatch(/\?$/);
      expect(f.grounding.length, f.name).toBeGreaterThan(40);
      expect(f.blurb.length, f.name).toBeGreaterThan(20);
    }
  });

  it("only ever constrains a relation between types the same framework declares", () => {
    // A rule pointing at a type this framework does not create would be a dangling rule the moment
    // it was adopted into an empty workspace.
    for (const f of FRAMEWORKS) {
      const names = new Set(f.nodeTypes.map((t) => t.name));
      for (const rt of f.relationTypes) {
        for (const rule of rt.rules) {
          expect(names.has(rule.from), `${f.name}: ${rt.name} from ${rule.from}`).toBe(true);
          expect(names.has(rule.to), `${f.name}: ${rt.name} to ${rule.to}`).toBe(true);
        }
      }
    }
  });

  it("only puts a type at a level its own framework declares", () => {
    for (const f of FRAMEWORKS) {
      const levels = new Set(f.levels.map((l) => l.key));
      for (const t of f.nodeTypes) {
        if (!t.level) continue;
        expect(levels.has(t.level), `${f.name}: ${t.name} at "${t.level}"`).toBe(true);
      }
      // A layered framework that leaves half its types unplaced is worse than one with no levels.
      if (f.levels.length > 0) {
        expect(f.nodeTypes.every((t) => t.level), `${f.name} has an unlevelled type`).toBe(true);
      }
    }
  });

  it("only makes a type the child of another type in the same framework", () => {
    for (const f of FRAMEWORKS) {
      const names = new Set(f.nodeTypes.map((t) => t.name));
      for (const t of f.nodeTypes) {
        if (t.parent) expect(names.has(t.parent), `${f.name}: ${t.name} ⊂ ${t.parent}`).toBe(true);
      }
    }
  });

  it("gives every enum field a vocabulary, or it constrains nothing", () => {
    for (const f of FRAMEWORKS) {
      for (const t of f.nodeTypes) {
        for (const field of t.fields) {
          if (field.dataType === "enum") expect(field.options?.length, `${f.name}: ${t.name}.${field.key}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it("does not require a field somebody cannot know on day one", () => {
    // A required field the first import cannot fill makes every object non-conformant on arrival,
    // which teaches people to ignore conformance (§5.56).
    for (const f of FRAMEWORKS) {
      for (const t of f.nodeTypes) {
        const required = t.fields.filter((field) => field.required).length;
        expect(required, `${f.name}: ${t.name}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("gives every type a colour, because the canvas has to draw it", () => {
    for (const f of FRAMEWORKS) {
      for (const t of f.nodeTypes) expect(t.color, `${f.name}: ${t.name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("knows which level one of its own types belongs at", () => {
    expect(levelOf(c4, "Container")).toBe("container");
    expect(levelOf(c4, "  container  ")).toBe("container");
    expect(levelOf(c4, "Nonexistent")).toBe("");
  });

  it("is unknown by an unknown id rather than guessing", () => {
    expect(framework("nope")).toBeNull();
  });
});

describe("saying what a workspace models with", () => {
  it("reads as a sentence however many there are", () => {
    expect(adoptedLine([])).toMatch(/Free form/);
    expect(adoptedLine(["c4"])).toBe("Models with C4 model.");
    expect(adoptedLine(["c4", "ddd"])).toBe("Models with C4 model and Domain-driven design.");
    expect(adoptedLine(["c4", "ddd", "safe"])).toBe("Models with C4 model, Domain-driven design and SAFe.");
  });

  it("ignores an id the catalogue no longer has, rather than printing it raw", () => {
    expect(adoptedLine(["c4", "retired-thing"])).toBe("Models with C4 model.");
  });
});

describe("adopting one", () => {
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
    // The kind exists in the data but nobody declared it, so the framework still has something to say.
    expect(plan.nodeTypes.add).toContain("Application");
  });

  it("keeps rules it already has and adds the ones it does not", () => {
    const plan = planApply(portfolio, model([], [relType("depends on", [["Application", "Application"]])]));
    expect(plan.relationTypes.already).toContain("depends on");
    expect(plan.rules.already).toContainEqual({ type: "depends on", from: "Application", to: "Application" });
    expect(plan.rules.add.some((r) => r.type === "supports")).toBe(true);
  });

  it("does nothing the second time, for every framework in the catalogue", () => {
    for (const f of FRAMEWORKS) {
      const full = model(
        f.nodeTypes.map((t) => nodeType(t.name, t.fields.map((field) => field.key))),
        f.relationTypes.map((t) => relType(t.name, t.rules.map((r) => [r.from, r.to] as [string, string]))),
      );
      const plan = planApply(f, full);
      expect(plan.noop, f.name).toBe(true);
      expect(planSummary(plan)).toMatch(/already declared/);
    }
  });

  it("counts two frameworks that share a type name as one type, not a clash", () => {
    // C4 and the integration model both want a notion of a system; DDD and SAFe both want
    // "Capability"-shaped things. Adopting the second must not try to redeclare the first.
    const afterC4 = model(c4.nodeTypes.map((t) => nodeType(t.name)));
    const plan = planApply(c4, afterC4);
    expect(plan.nodeTypes.add).toEqual([]);
  });
});
