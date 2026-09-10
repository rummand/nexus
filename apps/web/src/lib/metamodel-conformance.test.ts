import { describe, expect, it } from "vitest";
import { article, conformance, conformanceLabel, valueFits, type EntityLike, type RelationLike } from "./metamodel-conformance";
import type { MetaField, MetaModel, MetaNodeType, MetaRelationType } from "./metamodel";

/**
 * Does the estate obey the model this organisation declared? (§5.56)
 *
 * The property under all of it: a breach must name one object and say what is wrong with it. A
 * count is not actionable, and "83% conformant" tells nobody what to do on Monday.
 */

const field = (over: Partial<MetaField> & { key: string }): MetaField => ({
  id: `f_${over.key}`, dataType: "text", description: "", required: false, options: [], usage: 0, presence: "declared", ...over,
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
const rel = (id: string, kind: string, fromKind: string, toKind: string): RelationLike =>
  ({ id, kind, fromKind, toKind, fromName: `a ${fromKind}`, toName: `a ${toKind}` });

describe("what counts as the declared value of a field", () => {
  it("accepts a number however a person would write one", () => {
    for (const v of ["3", "3.5", "-2", "1,200", " 42 "]) expect(valueFits("number", v), v).toBe(true);
    for (const v of ["high", "3 apps", ""] ) expect(valueFits("number", v), v).toBe(v === "");
  });

  it("accepts a date at the precision people actually record", () => {
    for (const v of ["2026", "2026-09", "2026-09-09", "9 Sep 2026"]) expect(valueFits("date", v), v).toBe(true);
    expect(valueFits("date", "Q3")).toBe(false);
  });

  it("accepts the words people use for true and false", () => {
    for (const v of ["true", "No", "Y", "1"]) expect(valueFits("boolean", v), v).toBe(true);
    expect(valueFits("boolean", "maybe")).toBe(false);
  });

  it("checks an enum against its options, case-insensitively", () => {
    expect(valueFits("enum", "Active", ["active", "retired"])).toBe(true);
    expect(valueFits("enum", "sunset", ["active", "retired"])).toBe(false);
    // An enum with no vocabulary declared yet cannot be broken.
    expect(valueFits("enum", "anything", [])).toBe(true);
  });

  it("treats an empty value as nobody's business — that is the required check's job", () => {
    for (const t of ["number", "date", "boolean", "url", "enum"]) expect(valueFits(t, "   "), t).toBe(true);
  });

  it("lets an unknown data type through rather than inventing a rule for it", () => {
    expect(valueFits("text", "anything at all")).toBe(true);
    expect(valueFits("something-new", "anything at all")).toBe(true);
  });
});

describe("the article in front of a type name", () => {
  it("follows how the name is said rather than how it is spelt", () => {
    // The names are somebody else's, and they land mid-sentence.
    expect(article("System")).toBe("a");
    expect(article("Interface")).toBe("an");
    expect(article("Application")).toBe("an");
    expect(article("IT Component")).toBe("an");   // eye-tee
    expect(article("API")).toBe("an");            // ay-pee-eye
    expect(article("SLA")).toBe("an");            // ess-el-ay
    expect(article("CRM System")).toBe("a");      // see-arr-em
    expect(article("User")).toBe("a");            // yoozer
    expect(article("Utility")).toBe("a");
    expect(article("")).toBe("a");
  });
});

describe("conformance", () => {
  it("names the object and says what is wrong, rather than counting", () => {
    const m = model([nodeType("Application", [field({ key: "owner", required: true })])]);
    const c = conformance(m, [ent("e1", "Application", "Maximo")], []);
    expect(c.breaches).toHaveLength(1);
    expect(c.breaches[0]!.subjectId).toBe("e1");
    expect(c.breaches[0]!.detail).toBe("“Maximo” has no owner, and Application requires one.");
  });

  it("catches a value that is not the type it was declared as", () => {
    const m = model([nodeType("Application", [field({ key: "retires", dataType: "date" })])]);
    const c = conformance(m, [ent("e1", "Application", "Maximo", { retires: "sometime next year" })], []);
    expect(c.counts["field-type"]).toBe(1);
    expect(c.breaches[0]!.detail).toContain("is not a date");
  });

  it("catches a value outside the vocabulary its field declared", () => {
    const m = model([nodeType("Application", [field({ key: "lifecycle", dataType: "enum", options: ["active", "retired"] })])]);
    const c = conformance(m, [ent("e1", "Application", "Maximo", { lifecycle: "sunset" })], []);
    expect(c.counts["field-option"]).toBe(1);
    expect(c.breaches[0]!.detail).toContain("not one of active, retired");
  });

  it("counts an object of an undeclared kind as outside the model, not as a field problem", () => {
    const m = model([nodeType("Application")]);
    const c = conformance(m, [ent("e1", "Widget", "Thing")], []);
    expect(c.counts["kind-undeclared"]).toBe(1);
    // It is not then also checked against fields it could not have.
    expect(c.breaches).toHaveLength(1);
    expect(c.breaches[0]!.detail).toBe("“Thing” is a Widget, a kind nobody declared.");
  });

  it("bends the sentence around the type name, because the names are somebody else's words", () => {
    const c = conformance(model([nodeType("System")]), [ent("e1", "Interface", "Customer API")], []);
    expect(c.breaches[0]!.detail).toBe("“Customer API” is an Interface, a kind nobody declared.");
  });

  it("says something different about an object with no kind at all", () => {
    const c = conformance(model([nodeType("Application")]), [ent("e1", "", "Mystery")], []);
    expect(c.breaches[0]!.detail).toBe("“Mystery” has no kind at all, so nothing in the model applies to it.");
  });

  it("does not treat a type that only grew from the data as declared", () => {
    const m = model([nodeType("Application", [], false)]);
    const c = conformance(m, [ent("e1", "Application", "Maximo")], []);
    expect(c.counts["kind-undeclared"]).toBe(1);
  });

  it("flags a relation no rule allows, and leaves an unconstrained type alone", () => {
    const constrained = relType("depends on", [["Application", "Application"]]);
    const free = relType("mentions");
    const c = conformance(model([nodeType("Application"), nodeType("Person")], [constrained, free]), [], [
      rel("r1", "depends on", "Application", "Person"),
      rel("r2", "depends on", "Application", "Application"),
      rel("r3", "mentions", "Person", "Application"),
    ]);
    expect(c.counts["relation-rule"]).toBe(1);
    expect(c.breaches[0]!.subjectId).toBe("r1");
    expect(c.breaches[0]!.detail).toContain("no rule for “depends on” allows");
  });

  it("scores what it could check, and reports separately how much it could not", () => {
    const m = model([nodeType("Application", [field({ key: "owner", required: true })])]);
    const c = conformance(m, [
      ent("e1", "Application", "A", { owner: "IT" }),
      ent("e2", "Application", "B"),          // breaks it
      ent("e3", "Widget", "C"),               // not declared at all, so not scored
    ], []);
    expect(c.checked).toBe(2);
    expect(c.score).toBe(50);
    expect(c.typed).toBe(67);
  });

  it("counts an object once however many ways it breaks the model", () => {
    const m = model([nodeType("Application", [
      field({ key: "owner", required: true }),
      field({ key: "retires", dataType: "date" }),
    ])]);
    const c = conformance(m, [ent("e1", "Application", "A", { retires: "soon" })], []);
    expect(c.breaches).toHaveLength(2);
    // Two complaints about one application is still one application out of conformance.
    expect(c.score).toBe(0);
    expect(c.byType[0]!.offenders).toBe(1);
    expect(c.byType[0]!.breaches).toBe(2);
  });

  it("says so plainly when there is nothing to conform to", () => {
    const c = conformance(model([]), [], []);
    expect(c.score).toBe(100);
    expect(conformanceLabel(c)).toMatch(/nothing to conform to/);
  });

  it("does not call an estate conformant when the model describes almost none of it", () => {
    const m = model([nodeType("Application")]);
    const entities = [ent("e0", "Application", "A"), ...Array.from({ length: 9 }, (_, i) => ent(`x${i}`, "Widget", `W${i}`))];
    const c = conformance(m, entities, []);
    expect(c.score).toBe(100); // of the one thing it could check
    expect(c.typed).toBe(10);
    expect(conformanceLabel(c)).toMatch(/types nobody has declared/);
  });
});
