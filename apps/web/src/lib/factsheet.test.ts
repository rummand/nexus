import { describe, expect, it } from "vitest";
import { completeness, FROM_DATA, sectionsOf, sheetSections, UNFILED } from "./factsheet";
import type { MetaField } from "./metamodel";

/**
 * Arranging an object page (§5.77).
 *
 * The cases are the ones that decide whether a reader trusts the page: a required field nobody
 * filled has to be visible, a key nobody declared must not be filed under a heading somebody's
 * regex picked, and the sections have to keep the order the modeller put them in.
 */

const field = (key: string, over: Partial<MetaField> = {}): MetaField => ({
  id: `f_${key}`, key, dataType: "text", description: "", required: false, options: [], section: "",
  usage: 1, presence: "declared", ...over,
});

describe("grouping an object page into sections", () => {
  const fields = [
    field("owner", { section: "Ownership" }),
    field("steward", { section: "Ownership" }),
    field("lifecycle", { section: "Lifecycle", required: true }),
    field("notes"),
  ];

  it("puts each field in the section its type gave it", () => {
    const s = sheetSections(fields, { owner: "Grid Ops", steward: "Maria", lifecycle: "active", notes: "" });
    expect(s.map((x) => x.title)).toEqual(["Ownership", "Lifecycle", UNFILED]);
    expect(s[0]!.values.map((v) => v.key)).toEqual(["owner", "steward"]);
  });

  it("keeps the modeller's order, not the alphabet", () => {
    // Somebody decided Ownership comes before Lifecycle. Sorting the headings throws that away.
    const s = sheetSections(fields, {});
    expect(s.map((x) => x.title)).toEqual(["Ownership", "Lifecycle", UNFILED]);
  });

  it("shows a declared field that is empty, and marks a required one", () => {
    const s = sheetSections(fields, { owner: "Grid Ops" });
    const lifecycle = s.find((x) => x.title === "Lifecycle")!.values[0]!;
    expect(lifecycle.value).toBe("");
    expect(lifecycle.missing).toBe(true);
    const notes = s.find((x) => x.title === UNFILED)!.values[0]!;
    expect(notes.missing, "empty and not required is not a finding").toBe(false);
  });

  it("files what nobody declared together, rather than guessing", () => {
    /*
     * Energinet's import brought keys like lxCostCentre and createdAt. A heuristic would put the
     * first under Cost and the second under Lifecycle, and be wrong often enough that nobody
     * trusts any heading on the page.
     */
    const s = sheetSections(fields, { owner: "Grid Ops", lxCostCentre: "4410", createdAt: "2026-01-27" });
    const loose = s.find((x) => x.title === FROM_DATA)!;
    expect(loose.fromData).toBe(true);
    expect(loose.values.map((v) => v.key)).toEqual(["createdAt", "lxCostCentre"]);
  });

  it("does not invent a section for an object that carries nothing", () => {
    expect(sheetSections([], {})).toEqual([]);
  });

  it("matches a declared field to its value whatever the casing", () => {
    const s = sheetSections([field("Owner", { section: "Ownership" })], { owner: "Grid Ops" });
    expect(s[0]!.values[0]!.value).toBe("Grid Ops");
  });

  it("leaves an empty undeclared key off the page", () => {
    // A blank the import brought is not a finding about this object; a blank declared field is.
    const s = sheetSections([], { leftover: "" });
    expect(s).toEqual([]);
  });

  it("offers the sections a type already uses, in order and without repeats", () => {
    expect(sectionsOf(fields)).toEqual(["Ownership", "Lifecycle"]);
  });

  it("counts completeness over declared fields only", () => {
    const s = sheetSections(fields, { owner: "Grid Ops", lxCostCentre: "4410" });
    // Four declared fields, one filled, one of the empties required.
    expect(completeness(s)).toEqual({ filled: 1, declared: 4, missing: 1 });
  });
});
