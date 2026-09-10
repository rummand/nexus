import { describe, expect, it } from "vitest";
import { entityName, mapExport, readableRelation, readableType, summarise } from "./map";
import type { FactSheet, LeanIxExport } from "./types";

/**
 * Bringing a LeanIX workspace in (§5.62).
 *
 * The property that matters most is the unglamorous one: **nothing may be lost quietly**. A
 * migration that drops a hundred relations and reports success is worse than one that fails,
 * because the second gets investigated.
 */

const fs = (over: Partial<FactSheet> & { id: string }): FactSheet => ({
  type: "Application", name: "A", fields: {}, tags: [], subscriptions: [], ...over,
});
const dump = (over: Partial<LeanIxExport> = {}): LeanIxExport => ({
  host: "acme.leanix.net", workspace: "acme", exportedAt: "2026-01-01T00:00:00Z",
  factSheets: [], relations: [], types: [], ...over,
});

describe("keeping their vocabulary", () => {
  it("makes a LeanIX type readable without renaming it", () => {
    expect(readableType("ITComponent")).toBe("IT Component");
    expect(readableType("BusinessCapability")).toBe("Business Capability");
    expect(readableType("Application")).toBe("Application");
    expect(readableType("DataObject")).toBe("Data Object");
  });

  it("does not invent a kind for a fact sheet that has no type", () => {
    expect(readableType("")).toBe("Untyped");
  });

  it("keeps both ends of a relation name and invents no verb", () => {
    // "relApplicationToITComponent" says which two types it joins and nothing else. A guessed
    // "uses" or "depends on" would be an invention presented as data.
    expect(readableRelation("relApplicationToITComponent")).toBe("application → it component");
    expect(readableRelation("relToChild")).toBe("→ child");
    expect(readableRelation("")).toBe("relates to");
  });
});

describe("mapping a workspace", () => {
  it("carries every configured field across as an attribute", () => {
    const m = mapExport(dump({ factSheets: [fs({ id: "1", name: "Maximo", fields: { lifecycle: "active", costCentre: "4711" } })] }));
    expect(m.entities[0]!.attributes).toMatchObject({ lifecycle: "active", costCentre: "4711" });
  });

  it("keeps the LeanIX id, so a second import updates rather than duplicates", () => {
    const m = mapExport(dump({ factSheets: [fs({ id: "abc123", name: "Maximo" })] }));
    expect(m.entities[0]!.attributes?.["leanix id"]).toBe("abc123");
  });

  it("turns subscriptions into the ownership fields every health measure asks for", () => {
    const m = mapExport(dump({ factSheets: [fs({ id: "1", subscriptions: [{ email: "a@x.test", role: "Owner" }] })] }));
    expect(m.entities[0]!.attributes?.owner).toBe("a@x.test");
  });

  it("joins two people in the same role rather than letting one overwrite the other", () => {
    const m = mapExport(dump({ factSheets: [fs({ id: "1", subscriptions: [
      { email: "a@x.test", role: "Owner" }, { email: "b@x.test", role: "Owner" },
    ] })] }));
    expect(m.entities[0]!.attributes?.owner).toBe("a@x.test, b@x.test");
  });

  it("drops an empty field rather than importing a column of blanks", () => {
    const m = mapExport(dump({ factSheets: [fs({ id: "1", fields: { lifecycle: "", owner: "  " } })] }));
    expect(m.entities[0]!.attributes).not.toHaveProperty("lifecycle");
    expect(m.entities[0]!.attributes).not.toHaveProperty("owner");
  });

  it("prefers the display name, and never produces a nameless object", () => {
    expect(entityName(fs({ id: "1", name: "raw", displayName: "Shown" }))).toBe("Shown");
    expect(entityName(fs({ id: "1", name: "", type: "ITComponent" }))).toBe("(unnamed IT Component)");
  });
});

describe("the things that lose data if nobody thinks about them", () => {
  it("keeps two systems with the same name apart", () => {
    // LeanIX allows duplicate names and large workspaces are full of "Reporting". Nexus keys an
    // import on the name, so merging them would silently make two systems into one.
    const m = mapExport(dump({ factSheets: [
      fs({ id: "aaaaaaaa-1", name: "Reporting" }),
      fs({ id: "bbbbbbbb-2", name: "Reporting" }),
      fs({ id: "cccccccc-3", name: "Unique" }),
    ] }));
    const names = m.entities.map((e) => e.name);
    expect(new Set(names).size).toBe(3);
    expect(names).toContain("Unique");           // an unambiguous name is left alone
    expect(names.filter((n) => n.startsWith("Reporting ("))).toHaveLength(2);
  });

  it("uses the disambiguated name on both ends of a relation too", () => {
    const m = mapExport(dump({
      factSheets: [fs({ id: "aaaaaaaa-1", name: "Reporting" }), fs({ id: "bbbbbbbb-2", name: "Reporting" })],
      relations: [{ fromId: "aaaaaaaa-1", toId: "bbbbbbbb-2", type: "relToChild", fields: {} }],
    }));
    expect(m.relations[0]!.from).toBe("Reporting (aaaaaaaa)");
    expect(m.relations[0]!.to).toBe("Reporting (bbbbbbbb)");
  });

  it("counts a relation whose other end was not exported instead of discarding it", () => {
    const m = mapExport(dump({
      factSheets: [fs({ id: "1" })],
      relations: [{ fromId: "1", toId: "missing", type: "relToChild", fields: {} }],
    }));
    expect(m.relations).toHaveLength(0);
    expect(m.dropped).toEqual([{ from: "1", to: "missing", type: "relToChild" }]);
  });

  it("says in the summary that relations were dropped, and why", () => {
    const d = dump({ factSheets: [fs({ id: "1" })], relations: [{ fromId: "1", toId: "gone", type: "relToChild", fields: {} }] });
    const text = summarise(d, mapExport(d));
    expect(text).toMatch(/1 dropped/);
    expect(text).toMatch(/permission boundary/);
  });

  it("counts by kind so the total can be checked against LeanIX itself", () => {
    const m = mapExport(dump({ factSheets: [
      fs({ id: "1", type: "Application" }), fs({ id: "2", type: "Application" }), fs({ id: "3", type: "ITComponent" }),
    ] }));
    expect(m.byKind).toEqual([{ kind: "Application", count: 2 }, { kind: "IT Component", count: 1 }]);
  });

  it("has something sensible to say about an empty workspace", () => {
    const d = dump();
    expect(() => summarise(d, mapExport(d))).not.toThrow();
    expect(mapExport(d).entities).toEqual([]);
  });
});
