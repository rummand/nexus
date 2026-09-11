"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import {
  NO_FILTERS,
  SORTS,
  activeFilters,
  facetCounts,
  filterRepository,
  sortRepository,
  type FacetCounts,
  type RepoFilters,
  type RepoItem,
  type RepoSort,
} from "@/lib/repository";

/**
 * Everything in the repository (§5.76).
 *
 * Rev 109 made each type browsable and reachable at its own address, and then left the only way
 * in as a chip on another page — so the product had object pages and no shelf to find them on.
 * This is the shelf: every object in the workspace, in one flat list, opening its own sheet.
 *
 * Deliberately one flat list rather than a tree or a board. The question this page answers is
 * "where is that thing" — 478 rows with a search box answer it in a second, and a shape that
 * needs navigating does not.
 *
 * What the flat list could not answer is every *other* question, and with 478 objects those
 * arrive at once: which applications are connected to nothing, what sits at the top level, what
 * did we touch last week, which types has nobody declared. Those are the rail (§5.78) — on the
 * left, where a filter belongs, rather than a row of chips above a table that had already run out
 * of room at twelve types.
 */

/** A row in the list. The shape the filter logic works on, re-exported under the page's name. */
export type RepositoryItem = RepoItem;

export interface RepositoryType {
  kind: string;
  count: number;
  color: string;
  declared: boolean;
}

const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

/** One row of a facet: a label, what choosing it would give you, and whether it is chosen. */
function Choice({
  label, count, on, onClick, tone, mark,
}: { label: string; count: number; on: boolean; onClick: () => void; tone?: "warn"; mark?: string }) {
  return (
    <button
      type="button"
      className={`${on ? "on" : ""}${tone === "warn" ? " missing" : ""}`}
      onClick={onClick}
      aria-pressed={on}
      data-repo-choice={mark ?? label}
      /* A choice that would empty the list is shown and disabled rather than hidden: its absence
         is an answer too, and a rail whose rows come and go cannot be learned. */
      disabled={count === 0 && !on}
    >
      <span>{label}</span>
      <b>{count}</b>
    </button>
  );
}

export function Repository({ slug, types, items }: { slug: string; types: RepositoryType[]; items: RepositoryItem[] }) {
  const [filters, setFilters] = useState<RepoFilters>(NO_FILTERS);
  const [sort, setSort] = useState<RepoSort>("name");

  const set = (patch: Partial<RepoFilters>) => setFilters((f) => ({ ...f, ...patch }));
  /** A facet with two values behaves as a toggle: choosing what is chosen clears it. */
  const pick = <K extends keyof RepoFilters>(key: K, value: RepoFilters[K]) =>
    set({ [key]: filters[key] === value ? "" : value } as Partial<RepoFilters>);

  const shown = useMemo(() => sortRepository(filterRepository(items, filters), sort), [items, filters, sort]);
  const counts: FacetCounts = useMemo(() => facetCounts(items, filters), [items, filters]);
  const narrowing = activeFilters(filters);
  const colorOf = useMemo(() => new Map(types.map((t) => [t.kind, t.color])), [types]);
  const only = filters.kinds.length === 1 ? filters.kinds[0]! : null;

  return (
    <div className="inventory" data-repository>
      <header className="inventory-head">
        <div className="inventory-title">
          <i style={{ background: "#1376d4" }} />
          <div>
            <h1>Objects</h1>
            <p>
              {items.length} object{items.length === 1 ? "" : "s"} across {types.length} type{types.length === 1 ? "" : "s"}
              {" · everything the model holds, whoever put it there"}
            </p>
          </div>
        </div>
        <label className="repository-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as RepoSort)} aria-label="Sort by" data-repository-sort>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="studio-home-search inventory-search">
          <Search size={15} />
          <input
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search every object"
            aria-label="Search every object"
            data-repository-search
          />
        </label>
      </header>

      <div className="repository-shell">
        <aside className="repository-rail" aria-label="Filters" data-repository-rail>
          <div className="inventory-facets-head">
            <span><SlidersHorizontal size={11} /> Narrow it down</span>
            {narrowing > 0 && (
              <button type="button" onClick={() => setFilters({ ...NO_FILTERS, query: filters.query })} data-repo-clear>
                clear {narrowing}
              </button>
            )}
          </div>

          <section className="facet">
            <h3>Type <em>{types.length}</em></h3>
            <div className="facet-values">
              <Choice
                label="Everything"
                count={counts.kind.size === 0 ? 0 : [...counts.kind.values()].reduce((a, b) => a + b, 0)}
                on={filters.kinds.length === 0}
                onClick={() => set({ kinds: [] })}
                mark="everything"
              />
              {types.map((t) => (
                <button
                  key={t.kind}
                  type="button"
                  className={filters.kinds.includes(t.kind) ? "on" : ""}
                  onClick={() => set({
                    kinds: filters.kinds.includes(t.kind)
                      ? filters.kinds.filter((k) => k !== t.kind)
                      : [...filters.kinds, t.kind],
                  })}
                  aria-pressed={filters.kinds.includes(t.kind)}
                  data-type={t.kind}
                  title={t.declared ? "Declared in the meta-model" : "This type grew from the data and has not been declared"}
                >
                  <i className="facet-dot" style={{ background: t.color || "#94a3b8" }} />
                  <span>{t.kind || "Untyped"}{!t.declared && <em className="undeclared" title="Not declared"> ·</em>}</span>
                  <b>{counts.kind.get(t.kind) ?? 0}</b>
                </button>
              ))}
            </div>
          </section>

          <section className="facet">
            <h3>Where it sits</h3>
            <div className="facet-values">
              <Choice label="At the top level" count={counts.place.top} on={filters.place === "top"} onClick={() => pick("place", "top")} mark="top" />
              <Choice label="Inside something" count={counts.place.inside} on={filters.place === "inside"} onClick={() => pick("place", "inside")} mark="inside" />
            </div>
          </section>

          <section className="facet">
            <h3>Connections</h3>
            <div className="facet-values">
              <Choice label="Connected" count={counts.links.connected} on={filters.links === "connected"} onClick={() => pick("links", "connected")} mark="connected" />
              {/* An orphan is a finding, not a category, so it is marked the way an empty required
                  field is marked everywhere else in the product. */}
              <Choice label="Connected to nothing" count={counts.links.orphan} on={filters.links === "orphan"} onClick={() => pick("links", "orphan")} tone="warn" mark="orphan" />
            </div>
          </section>

          <section className="facet">
            <h3>On a board</h3>
            <div className="facet-values">
              <Choice label="Drawn somewhere" count={counts.boards.on} on={filters.boards === "on"} onClick={() => pick("boards", "on")} mark="on-board" />
              <Choice label="On no board" count={counts.boards.off} on={filters.boards === "off"} onClick={() => pick("boards", "off")} mark="no-board" />
            </div>
          </section>

          <section className="facet">
            <h3>The meta-model</h3>
            <div className="facet-values">
              <Choice label="Type is declared" count={counts.declared.yes} on={filters.declared === "yes"} onClick={() => pick("declared", "yes")} mark="declared" />
              <Choice label="Type is not declared" count={counts.declared.no} on={filters.declared === "no"} onClick={() => pick("declared", "no")} tone="warn" mark="undeclared" />
            </div>
          </section>
        </aside>

        <div className="repository-body">
          <p className="inventory-count" data-repository-count>
            {shown.length === items.length ? `${items.length} objects` : `${shown.length} of ${items.length}`}
            {narrowing > 0 && <> · narrowed by {narrowing} filter{narrowing === 1 ? "" : "s"}</>}
            {only && (
              <>
                {" · "}
                <Link href={`/w/${slug}/type/${encodeURIComponent(only)}`} data-open-type>
                  open the {only} inventory <ArrowRight size={11} />
                </Link>
              </>
            )}
          </p>

          {shown.length === 0 ? (
            <p className="inventory-empty" data-repository-empty>Nothing matches. Try a different search, or clear the filters.</p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table repository-table" data-repository-table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Inside</th>
                    <th className="num">Relations</th>
                    <th className="num">Boards</th>
                    <th>Changed</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 600).map((item) => (
                    <tr key={item.id} data-repository-row={item.id}>
                      <th scope="row">
                        {/* The object has a sheet of its own (§5.77); a list row is a way to it. */}
                        <Link href={`/w/${slug}/fs/${item.id}`} data-open-item={item.id}>
                          {item.name || "(unnamed)"}
                        </Link>
                        {item.description && <small className="repository-said">{item.description.slice(0, 110)}</small>}
                      </th>
                      <td>
                        <span className="repository-kind">
                          <i style={{ background: colorOf.get(item.kind) ?? "#94a3b8" }} />
                          {item.kind || "Untyped"}
                        </span>
                      </td>
                      <td>{item.parent || <em className="repository-top">top level</em>}</td>
                      <td className="num">{item.relationCount || "—"}</td>
                      <td className="num">{item.boardCount || "—"}</td>
                      <td className="repository-when">{day(item.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length > 600 && (
                <p className="inventory-empty">
                  Showing the first 600 of {shown.length}. Search, or narrow it in the rail.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
