import { describe, expect, it } from "vitest";
import { fixedFindings, newFindings, runChecks, verdict, type CheckInput, type RelationRow } from "./suite";
import type { EntityLike } from "@/lib/metamodel-conformance";
import type { MetaField, MetaModel, MetaNodeType, MetaRelationType } from "@/lib/metamodel";

/**
 * The model's test suite (#136, §5.83).
 *
 * The property that matters: a check is a verdict with the rows behind it. A count is not
 * something a merge can refuse on, and "83% conformant" tells nobody what to do on Monday.
 */

const field = (over: Partial<MetaField> & { key: string }): MetaField => ({
  id: `f_${over.key}`, dataType: "text", description: "", required: false, options: [], section: "", usage: 0, presence: "declared", ...over,
});
const nodeType = (name: string, fields: MetaField[] = [], declared = true): MetaNodeType => ({
  id: declared ? `nt_${name}` : null, name, description: "", color: "", parentId: null, instances: 0, fields,
  presence: declared ? "declared" : "undeclared", framework: "", layerId: null,
});
const relType = (name: string, rules: Array<[string, string]> = [], declared = true): MetaRelationType => ({
  id: declared ? `rt_${name}` : null, name, description: "", instances: 0, framework: "", layerId: null,
  rules: rules.map(([fromType, toType], i) => ({ id: `r${i}`, fromType, toType, cardinality: "many-to-many" })),
  observedPairs: [], presence: declared ? "declared" : "undeclared",
});
const model = (nodeTypes: MetaNodeType[], relationTypes: MetaRelationType[] = []): MetaModel => ({
  nodeTypes, relationTypes, layers: [],
  totals: { entities: 0, relations: 0, undeclaredNodeTypes: 0, undeclaredRelationTypes: 0, violations: 0 },
});
const ent = (id: string, kind: string, name: string, attributes: Record<string, string> = {}): EntityLike => ({ id, kind, name, attributes });
const rel = (id: string, kind: string, from: EntityLike, to: EntityLike): RelationRow =>
  ({ id, kind, fromKind: from.kind, toKind: to.kind, fromName: from.name, toName: to.name, fromEntityId: from.id, toEntityId: to.id });

const APP = nodeType("Application", [field({ key: "owner", required: true }), field({ key: "lifecycle", dataType: "enum", options: ["active", "phase out"] })]);
const CAP = nodeType("Business Capability");
const REALISES = relType("realises", [["Application", "Business Capability"]]);

const run = (over: Partial<CheckInput> & { entities: EntityLike[] }) =>
  runChecks({ model: model([APP, CAP], [REALISES]), relations: [], ...over });

const check = (r: ReturnType<typeof runChecks>, id: string) => r.checks.find((c) => c.id === id)!;

describe("what the suite checks", () => {
  it("passes a model that obeys itself", () => {
    const a = ent("e1", "Application", "Maximo", { owner: "Asset Management", lifecycle: "active" });
    const c = ent("e2", "Business Capability", "Work orders");
    const r = run({ entities: [a, c], relations: [rel("r1", "realises", a, c)] });
    expect(r.passed).toBe(true);
    expect(r.blocking).toBe(0);
    expect(r.findings).toEqual([]);
  });

  it("fails on a required field nobody filled, and names the object", () => {
    const r = run({ entities: [ent("e1", "Application", "Maximo", { lifecycle: "active" })], relations: [] });
    const c = check(r, "required-fields");
    expect(c.passed).toBe(false);
    expect(c.severity).toBe("blocking");
    expect(c.findings[0]).toMatchObject({ subjectId: "e1", subjectName: "Maximo" });
    expect(r.passed).toBe(false);
  });

  it("fails on a value outside a declared enum", () => {
    const r = run({ entities: [ent("e1", "Application", "Maximo", { owner: "x", lifecycle: "retired-ish" })] });
    expect(check(r, "field-values").passed).toBe(false);
  });

  it("fails on a relation the model does not allow between those types", () => {
    const a = ent("e1", "Application", "Maximo", { owner: "x" });
    const b = ent("e2", "Application", "SAP", { owner: "y" });
    const r = run({ entities: [a, b], relations: [rel("r1", "realises", a, b)] });
    expect(check(r, "relations-allowed").passed).toBe(false);
  });

  it("reports an undeclared type as advisory, not as a blocker", () => {
    const r = run({ entities: [ent("e1", "Gizmo", "Thing")] });
    const c = check(r, "types-declared");
    expect(c.passed).toBe(false);
    expect(c.severity).toBe("advisory");
    // 52 undeclared types is the state of a real repository; it must not stop every merge.
    expect(r.passed).toBe(true);
  });
});

describe("containment", () => {
  it("finds a ring, and reports it once rather than once per member", () => {
    const a = ent("a", "Business Capability", "A");
    const b = ent("b", "Business Capability", "B");
    const r = run({ entities: [a, b], parents: new Map([["a", "b"], ["b", "a"]]) });
    const c = check(r, "no-cycles");
    expect(c.passed).toBe(false);
    expect(c.findings).toHaveLength(1);
    expect(c.severity).toBe("blocking");
  });

  it("is happy with an ordinary tree", () => {
    const r = run({
      entities: [ent("a", "Business Capability", "A"), ent("b", "Business Capability", "B")],
      parents: new Map([["b", "a"], ["a", null]]),
    });
    expect(check(r, "no-cycles").passed).toBe(true);
  });
});

describe("orphans", () => {
  it("counts a place in the hierarchy as being attached", () => {
    // A capability with children and no edges is not adrift. Calling it an orphan is how a check
    // becomes something people learn to ignore.
    const parent = ent("p", "Business Capability", "Asset Management");
    const child = ent("c", "Business Capability", "Work orders");
    const r = run({ entities: [parent, child], parents: new Map([["c", "p"]]) });
    expect(check(r, "no-orphans").passed).toBe(true);
  });

  it("reports an object with no relations and nowhere to sit", () => {
    const r = run({ entities: [ent("e1", "Application", "Adrift", { owner: "x" })] });
    const c = check(r, "no-orphans");
    expect(c.findings.map((f) => f.subjectId)).toEqual(["e1"]);
    expect(c.severity).toBe("advisory");
  });
});

describe("duplicate names", () => {
  it("reports every member of the pair, because each one is a candidate for the merge", () => {
    const r = run({ entities: [ent("a", "Application", "Maximo", { owner: "x" }), ent("b", "Application", "maximo ", { owner: "y" })] });
    expect(check(r, "unique-names").findings.map((f) => f.subjectId).sort()).toEqual(["a", "b"]);
  });

  it("does not mind the same name under two different types", () => {
    const r = run({ entities: [ent("a", "Application", "Billing", { owner: "x" }), ent("b", "Business Capability", "Billing")] });
    expect(check(r, "unique-names").passed).toBe(true);
  });
});

describe("the verdict a merge asks for", () => {
  /* A pair that breaks nothing: an application with its required field, realising a capability. */
  const cap = (n: string) => ent(`cap_${n}`, "Business Capability", n);
  const app = (n: string, attributes: Record<string, string> = { owner: "x", lifecycle: "active" }) =>
    ent(`app_${n}`, "Application", n, attributes);
  const pair = (n: string, attributes?: Record<string, string>) => {
    const a = app(n, attributes); const c = cap(n);
    return { entities: [a, c], relations: [rel(`r_${n}`, "realises", a, c)] };
  };
  const both = (...parts: Array<ReturnType<typeof pair>>) => ({
    entities: parts.flatMap((p) => p.entities),
    relations: parts.flatMap((p) => p.relations),
  });

  it("is about what a change adds, not about whether the model is clean", () => {
    // A repository with an existing breach must not be un-mergeable forever.
    const broken = pair("Old", {});
    const base = run(broken);
    const head = run(both(broken, pair("Fine")));
    expect(base.passed).toBe(false);
    expect(newFindings(base, head)).toEqual([]);
    expect(verdict(newFindings(base, head))).toMatchObject({ ok: true, words: "Nothing new breaks." });
  });

  it("refuses a change that adds a blocking finding", () => {
    const base = run(pair("Fine"));
    const head = run(both(pair("Fine"), pair("Newcomer", {})));
    const added = newFindings(base, head);
    expect(added.some((f) => f.checkId === "required-fields")).toBe(true);
    expect(verdict(added).ok).toBe(false);
  });

  it("allows a change that only adds advisory findings, and says so", () => {
    const base = run(pair("Fine"));
    const good = pair("Fine");
    const head = run({ entities: [...good.entities, ent("g", "Gizmo", "Undeclared thing")], relations: good.relations });
    const added = newFindings(base, head);
    expect(added.some((f) => f.checkId === "types-declared")).toBe(true);
    const v = verdict(added);
    expect(v.ok).toBe(true);
    expect(v.words).toMatch(/nothing blocking/);
  });

  it("says what a change repairs as well as what it breaks", () => {
    const base = run(pair("Maximo", {}));
    const head = run(pair("Maximo", { owner: "Asset Management" }));
    expect(newFindings(base, head)).toEqual([]);
    expect(fixedFindings(base, head).some((f) => f.checkId === "required-fields")).toBe(true);
  });
});
