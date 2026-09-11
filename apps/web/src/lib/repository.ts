/**
 * Filtering and sorting the repository (§5.76).
 *
 * The repository started as one flat list with a search box, which answers "where is that thing"
 * and nothing else. With 478 objects the other questions arrive immediately — *which applications
 * are connected to nothing*, *what is at the top level*, *what did we touch last week* — and a
 * search box cannot ask any of them.
 *
 * So the page grows a rail, and this is the logic behind it, kept out of the component because a
 * faceted filter has exactly one interesting rule and it is worth a test:
 *
 * **Each facet counts against every *other* facet's selection, never its own.** If a facet counted
 * against itself, choosing "Application" would show every other type as zero and the filter would
 * be a one-way door — you could narrow but never switch. The type inventory (§5.72) learned this
 * already; this is the same rule over the cross-cutting questions rather than over a type's fields.
 */

export interface RepoItem {
  id: string;
  name: string;
  kind: string;
  description: string;
  parent: string;
  relationCount: number;
  boardCount: number;
  updatedAt: string;
  /** Whether the meta-model declares the type this object claims. */
  declared: boolean;
}

export type RepoSort = "name" | "changed" | "connected" | "boards" | "type";

export interface RepoFilters {
  query: string;
  kinds: string[];
  /** Where it sits: at the top level, or inside something. */
  place: "" | "top" | "inside";
  /** Whether it is connected to anything at all. */
  links: "" | "connected" | "orphan";
  boards: "" | "on" | "off";
  declared: "" | "yes" | "no";
}

export const NO_FILTERS: RepoFilters = { query: "", kinds: [], place: "", links: "", boards: "", declared: "" };

/** The facets, in the order the rail shows them. `kind` is first because it is the one people use. */
export type FacetName = "kind" | "place" | "links" | "boards" | "declared";
const FACETS: FacetName[] = ["kind", "place", "links", "boards", "declared"];

const hit = (item: RepoItem, facet: FacetName, f: RepoFilters): boolean => {
  switch (facet) {
    case "kind": return f.kinds.length === 0 || f.kinds.includes(item.kind);
    case "place": return f.place === "" || (f.place === "top" ? !item.parent : Boolean(item.parent));
    case "links": return f.links === "" || (f.links === "connected" ? item.relationCount > 0 : item.relationCount === 0);
    case "boards": return f.boards === "" || (f.boards === "on" ? item.boardCount > 0 : item.boardCount === 0);
    case "declared": return f.declared === "" || (f.declared === "yes" ? item.declared : !item.declared);
  }
};

const searched = (item: RepoItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${item.name} ${item.kind} ${item.description} ${item.parent}`.toLowerCase().includes(q);
};

/** Everything that survives the search and every facet. */
export function filterRepository(items: RepoItem[], f: RepoFilters): RepoItem[] {
  return items.filter((item) => searched(item, f.query) && FACETS.every((facet) => hit(item, facet, f)));
}

/**
 * What survives everything *except* one facet — the population that facet's counts are taken over.
 * Exported because the type counts in the rail are built from it.
 */
export function exceptFacet(items: RepoItem[], f: RepoFilters, skip: FacetName): RepoItem[] {
  return items.filter((item) => searched(item, f.query) && FACETS.every((facet) => facet === skip || hit(item, facet, f)));
}

export interface FacetCounts {
  /** Per kind, counted against the other facets. */
  kind: Map<string, number>;
  place: { top: number; inside: number };
  links: { connected: number; orphan: number };
  boards: { on: number; off: number };
  declared: { yes: number; no: number };
}

export function facetCounts(items: RepoItem[], f: RepoFilters): FacetCounts {
  const kind = new Map<string, number>();
  for (const item of exceptFacet(items, f, "kind")) kind.set(item.kind, (kind.get(item.kind) ?? 0) + 1);

  const place = exceptFacet(items, f, "place");
  const links = exceptFacet(items, f, "links");
  const boards = exceptFacet(items, f, "boards");
  const declared = exceptFacet(items, f, "declared");

  return {
    kind,
    place: { top: place.filter((i) => !i.parent).length, inside: place.filter((i) => Boolean(i.parent)).length },
    links: { connected: links.filter((i) => i.relationCount > 0).length, orphan: links.filter((i) => i.relationCount === 0).length },
    boards: { on: boards.filter((i) => i.boardCount > 0).length, off: boards.filter((i) => i.boardCount === 0).length },
    declared: { yes: declared.filter((i) => i.declared).length, no: declared.filter((i) => !i.declared).length },
  };
}

/** How many facets are narrowing the list, for the "narrowed by N" line and the clear button. */
export function activeFilters(f: RepoFilters): number {
  return (f.kinds.length > 0 ? 1 : 0) + (f.place ? 1 : 0) + (f.links ? 1 : 0) + (f.boards ? 1 : 0) + (f.declared ? 1 : 0);
}

const byName = (a: RepoItem, b: RepoItem) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true });

/**
 * Sorting. Every order falls back to the name, so the list is stable — two objects changed in the
 * same second must not swap places between renders.
 */
export function sortRepository(items: RepoItem[], sort: RepoSort): RepoItem[] {
  const rows = [...items];
  switch (sort) {
    case "name": return rows.sort(byName);
    case "changed": return rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") || byName(a, b));
    case "connected": return rows.sort((a, b) => b.relationCount - a.relationCount || byName(a, b));
    case "boards": return rows.sort((a, b) => b.boardCount - a.boardCount || byName(a, b));
    case "type": return rows.sort((a, b) => (a.kind || "").localeCompare(b.kind || "") || byName(a, b));
  }
}

export const SORTS: Array<{ id: RepoSort; label: string }> = [
  { id: "name", label: "Name" },
  { id: "changed", label: "Recently changed" },
  { id: "connected", label: "Most connected" },
  { id: "boards", label: "Most used on boards" },
  { id: "type", label: "Type" },
];
