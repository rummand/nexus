import { describe, expect, it } from "vitest";
import {
  activeCount, canonical, columns, facets, filterItems, plural, toggleFacet, valueProblem,
  type InventoryItem, type Selection,
} from "./inventory";
import type { MetaField } from "./metamodel";

const field = (key: string, over: Partial<MetaField> = {}): MetaField => ({
  id: `f_${key}`, key, dataType: "text", description: "", required: false, options: [],
  usage: 0, presence: "declared", ...over,
});

const app = (name: string, attributes: Record<string, string>): InventoryItem => ({
  id: name, name, kind: "Application", description: "", attributes, relationCount: 0, boardCount: 0,
});

const estate = (): InventoryItem[] => [
  app("SCADA", { lifecycle: "active", criticality: "high", owner: "Grid" }),
  app("Maximo", { lifecycle: "active", criticality: "medium", owner: "Assets" }),
  app("Historian", { lifecycle: "end of life", criticality: "medium", owner: "Grid" }),
  app("M365", { lifecycle: "active" }),
];

const FIELDS = [
  field("lifecycle", { dataType: "enum", options: ["active", "end of life"], required: true }),
  field("owner"),
  field("annual cost", { dataType: "number" }),
];

describe("the facet rail", () => {
  it("leads with the fields the model declares, in the order it declares them", () => {
    // That order is somebody's considered opinion about what matters; usage is not.
    expect(facets(estate(), FIELDS).map((f) => f.key).slice(0, 3)).toEqual(["lifecycle", "owner", "annual cost"]);
  });

  it("keeps a declared field with no data at all, because an empty one is a finding", () => {
    const cost = facets(estate(), FIELDS).find((f) => f.key === "annual cost")!;
    expect(cost.declared).toBe(true);
    expect(cost.values).toEqual([]);
    expect(cost.missing).toBe(4);
  });

  it("lists discovered keys after the declared ones, commonest first", () => {
    const keys = facets(estate(), [field("owner")]).map((f) => f.key);
    expect(keys[0]).toBe("owner");
    expect(keys.slice(1)).toEqual(["lifecycle", "criticality"]);
  });

  it("counts the items with no value, because “which have no owner” is the useful question", () => {
    const owner = facets(estate(), FIELDS).find((f) => f.key === "owner")!;
    expect(owner.missing).toBe(1);
    expect(owner.present).toBe(3);
  });

  it("orders values by how many carry them", () => {
    const lifecycle = facets(estate(), FIELDS).find((f) => f.key === "lifecycle")!;
    expect(lifecycle.values).toEqual([
      { value: "active", count: 3 },
      { value: "end of life", count: 1 },
    ]);
  });
});

describe("counting a facet against the others but not itself", () => {
  it("keeps the other values of a chosen facet reachable", () => {
    /*
     * The one thing an implementation gets wrong: if a facet counted against its own selection,
     * every unchosen value in it would read zero and the filter would be a one-way door.
     */
    const chosen: Selection = { lifecycle: ["active"] };
    const lifecycle = facets(estate(), FIELDS, chosen).find((f) => f.key === "lifecycle")!;
    expect(lifecycle.values.find((v) => v.value === "end of life")?.count).toBe(1);
  });

  it("does narrow every other facet by that choice", () => {
    const chosen: Selection = { lifecycle: ["end of life"] };
    const owner = facets(estate(), FIELDS, chosen).find((f) => f.key === "owner")!;
    expect(owner.values).toEqual([{ value: "Grid", count: 1 }]);
  });
});

describe("filtering", () => {
  it("ANDs the facets together", () => {
    const kept = filterItems(estate(), { lifecycle: ["active"], owner: ["Grid"] }, "");
    expect(kept.map((i) => i.name)).toEqual(["SCADA"]);
  });

  it("ORs the values inside one facet", () => {
    const kept = filterItems(estate(), { criticality: ["high", "medium"] }, "");
    expect(kept.map((i) => i.name)).toEqual(["SCADA", "Maximo", "Historian"]);
  });

  it("can select the things with no value at all", () => {
    // Selecting "not set" on owner is the question the rail exists to make one click.
    const kept = filterItems(estate(), { owner: [""] }, "");
    expect(kept.map((i) => i.name)).toEqual(["M365"]);
  });

  it("matches a value regardless of how it was capitalised", () => {
    const items = [app("A", { lifecycle: "Active" })];
    expect(filterItems(items, { lifecycle: ["active"] }, "")).toHaveLength(1);
  });

  it("searches names, descriptions and values together", () => {
    expect(filterItems(estate(), {}, "grid").map((i) => i.name)).toEqual(["SCADA", "Historian"]);
    expect(filterItems(estate(), {}, "hist").map((i) => i.name)).toEqual(["Historian"]);
  });

  it("applies the search on top of the facets", () => {
    expect(filterItems(estate(), { lifecycle: ["active"] }, "grid").map((i) => i.name)).toEqual(["SCADA"]);
  });
});

describe("toggling", () => {
  it("adds, then removes, then drops the key entirely", () => {
    let sel = toggleFacet({}, "lifecycle", "active");
    expect(sel).toEqual({ lifecycle: ["active"] });
    sel = toggleFacet(sel, "lifecycle", "end of life");
    expect(sel.lifecycle).toEqual(["active", "end of life"]);
    sel = toggleFacet(sel, "lifecycle", "active");
    expect(sel.lifecycle).toEqual(["end of life"]);
    sel = toggleFacet(sel, "lifecycle", "end of life");
    expect(sel).toEqual({});
  });

  it("counts what is narrowing the view", () => {
    expect(activeCount({ lifecycle: ["active", "sunset"], owner: ["Grid"] })).toBe(3);
    expect(activeCount({})).toBe(0);
  });
});

describe("columns", () => {
  it("gives a declared field a column even when nothing fills it", () => {
    expect(columns(estate(), FIELDS)).toContain("annual cost");
  });

  it("puts discovered keys after the declared ones", () => {
    expect(columns(estate(), FIELDS)).toEqual(["lifecycle", "owner", "annual cost", "criticality"]);
  });

  it("stops at the cap so the table stays readable", () => {
    const many = [app("A", Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, "v"])))];
    expect(columns(many, []).length).toBe(8);
  });
});

describe("editing a value the model has an opinion about", () => {
  const lifecycle = field("lifecycle", { dataType: "enum", options: ["active", "end of life"] });

  it("refuses an enum value the model does not declare, and lists the ones it does", () => {
    /*
     * Editing a declared enum as free text is exactly how "Active" and "active" both end up in
     * the column — and Nexus then grows a proposals system to clean up a mess it allowed.
     */
    expect(valueProblem(lifecycle, "retired")).toMatch(/not one of: active, end of life/);
    expect(valueProblem(lifecycle, "active")).toBeNull();
  });

  it("accepts a differently-capitalised enum value and stores the model's spelling", () => {
    expect(valueProblem(lifecycle, "Active")).toBeNull();
    expect(canonical(lifecycle, "ACTIVE")).toBe("active");
  });

  it("leaves an undeclared key alone entirely", () => {
    expect(valueProblem(undefined, "anything at all")).toBeNull();
    expect(canonical(undefined, "Anything")).toBe("Anything");
  });

  it("lets any field be cleared, because requiredness is about a finished record", () => {
    // Refusing to let somebody empty a field is how data gets stuck wrong.
    expect(valueProblem(field("owner", { required: true }), "")).toBeNull();
  });

  it("checks numbers, dates and web addresses", () => {
    expect(valueProblem(field("cost", { dataType: "number" }), "12.5")).toBeNull();
    expect(valueProblem(field("cost", { dataType: "number" }), "lots")).toMatch(/not a number/);
    expect(valueProblem(field("site", { dataType: "url" }), "https://x.dk")).toBeNull();
    expect(valueProblem(field("site", { dataType: "url" }), "over there")).toMatch(/not a web address/);
  });

  it("accepts a year or a month as a date, because an estate records those constantly", () => {
    const eos = field("end of support", { dataType: "date" });
    expect(valueProblem(eos, "2027")).toBeNull();
    expect(valueProblem(eos, "2027-06")).toBeNull();
    expect(valueProblem(eos, "2027-06-30")).toBeNull();
    expect(valueProblem(eos, "soon")).toMatch(/not a date/);
  });

  it("takes yes and no for a boolean, not only true and false", () => {
    const f = field("synchronous", { dataType: "boolean" });
    expect(valueProblem(f, "yes")).toBeNull();
    expect(valueProblem(f, "maybe")).toMatch(/not yes or no/);
  });
});

describe("the plural of a type name", () => {
  it("does not say “23 application”, which is the first thing a reader sees", () => {
    expect(plural("Application", 23)).toBe("Applications");
    expect(plural("Application", 1)).toBe("Application");
  });

  it("handles the y that naive pluralisation ruins", () => {
    // "Business Capabilitys" makes the whole page look unfinished.
    expect(plural("Business Capability", 4)).toBe("Business Capabilities");
    // …but not a y after a vowel.
    expect(plural("Gateway", 2)).toBe("Gateways");
  });

  it("adds es where English does", () => {
    expect(plural("Process", 2)).toBe("Processes");
    expect(plural("Switch", 2)).toBe("Switches");
    expect(plural("Index", 2)).toBe("Indexes");
  });

  it("leaves an empty name alone rather than inventing one", () => {
    expect(plural("", 5)).toBe("");
  });
});
