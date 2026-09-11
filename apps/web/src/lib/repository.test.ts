import { describe, expect, it } from "vitest";
import {
  NO_FILTERS,
  activeFilters,
  facetCounts,
  filterRepository,
  sortRepository,
  type RepoItem,
} from "./repository";

const item = (over: Partial<RepoItem> & { id: string; name: string }): RepoItem => ({
  kind: "Application",
  description: "",
  parent: "",
  relationCount: 0,
  boardCount: 0,
  updatedAt: "2026-09-01T00:00:00.000Z",
  declared: true,
  ...over,
});

const estate: RepoItem[] = [
  item({ id: "a", name: "Maximo", relationCount: 4, boardCount: 1, parent: "Asset records", updatedAt: "2026-09-10T00:00:00.000Z" }),
  item({ id: "b", name: "CRM", relationCount: 2, boardCount: 0, updatedAt: "2026-09-02T00:00:00.000Z" }),
  item({ id: "c", name: "Asset records", kind: "Business Capability", relationCount: 0, boardCount: 3, declared: false }),
  item({ id: "d", name: "SCADA", relationCount: 0, boardCount: 0, parent: "Grid", declared: false, description: "control room" }),
];

describe("filtering the repository", () => {
  it("searches name, type, description and parent", () => {
    expect(filterRepository(estate, { ...NO_FILTERS, query: "control" }).map((i) => i.id)).toEqual(["d"]);
    expect(filterRepository(estate, { ...NO_FILTERS, query: "capability" }).map((i) => i.id)).toEqual(["c"]);
    expect(filterRepository(estate, { ...NO_FILTERS, query: "asset records" }).map((i) => i.id).sort()).toEqual(["a", "c"]);
  });

  it("ORs the types and ANDs the facets", () => {
    const both = filterRepository(estate, { ...NO_FILTERS, kinds: ["Application", "Business Capability"] });
    expect(both).toHaveLength(4);
    expect(filterRepository(estate, { ...NO_FILTERS, kinds: ["Application"], links: "orphan" }).map((i) => i.id)).toEqual(["d"]);
  });

  it("knows where a thing sits, what it is connected to, and whether anyone put it on a board", () => {
    expect(filterRepository(estate, { ...NO_FILTERS, place: "top" }).map((i) => i.id)).toEqual(["b", "c"]);
    expect(filterRepository(estate, { ...NO_FILTERS, place: "inside" }).map((i) => i.id)).toEqual(["a", "d"]);
    expect(filterRepository(estate, { ...NO_FILTERS, links: "orphan" }).map((i) => i.id)).toEqual(["c", "d"]);
    expect(filterRepository(estate, { ...NO_FILTERS, boards: "off" }).map((i) => i.id)).toEqual(["b", "d"]);
    expect(filterRepository(estate, { ...NO_FILTERS, declared: "no" }).map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("counts a facet against the others but never against itself", () => {
    // With Application chosen, the other types must still show what choosing them would give —
    // otherwise the filter is a one-way door.
    const counts = facetCounts(estate, { ...NO_FILTERS, kinds: ["Application"] });
    expect(counts.kind.get("Application")).toBe(3);
    expect(counts.kind.get("Business Capability")).toBe(1);

    // A different facet *is* counted against the chosen type: two of the three applications sit
    // somewhere, one is at the top.
    expect(counts.place).toEqual({ top: 1, inside: 2 });
  });

  it("counts every facet against the search as well", () => {
    const counts = facetCounts(estate, { ...NO_FILTERS, query: "asset records" });
    expect(counts.kind.get("Application")).toBe(1);
    expect(counts.kind.get("Business Capability")).toBe(1);
    expect(counts.links).toEqual({ connected: 1, orphan: 1 });
  });

  it("says how many facets are narrowing the list", () => {
    expect(activeFilters(NO_FILTERS)).toBe(0);
    expect(activeFilters({ ...NO_FILTERS, query: "x" })).toBe(0);
    expect(activeFilters({ ...NO_FILTERS, kinds: ["Application"], links: "orphan" })).toBe(2);
  });
});

describe("sorting the repository", () => {
  it("orders by name, and numerically where names carry numbers", () => {
    const rows = [item({ id: "1", name: "App 10" }), item({ id: "2", name: "App 2" })];
    expect(sortRepository(rows, "name").map((i) => i.name)).toEqual(["App 2", "App 10"]);
  });

  it("orders by what was touched last, then by name", () => {
    expect(sortRepository(estate, "changed").map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("orders by connectedness and by board use, most first", () => {
    expect(sortRepository(estate, "connected").map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(sortRepository(estate, "boards").map((i) => i.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("breaks every tie by name, so the list does not shuffle between renders", () => {
    const tied = [item({ id: "z", name: "Zebra" }), item({ id: "a", name: "Aardvark" })];
    for (const sort of ["changed", "connected", "boards", "type"] as const) {
      expect(sortRepository(tied, sort).map((i) => i.name)).toEqual(["Aardvark", "Zebra"]);
    }
  });

  it("does not mutate what it is given", () => {
    const before = estate.map((i) => i.id);
    sortRepository(estate, "boards");
    expect(estate.map((i) => i.id)).toEqual(before);
  });
});
