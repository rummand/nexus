"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers, Search } from "lucide-react";
import { EntityDrawer } from "@/components/workspace/EntityDrawer";

/**
 * Everything in the repository (§5.76).
 *
 * Rev 109 made each type browsable and reachable at its own address, and then left the only way
 * in as a chip on another page — so the product had fact sheets and no shelf to find them on.
 * This is the shelf: every type with what it holds, and under it every object in the workspace,
 * searchable and filterable, opening the same drawer the rest of the product opens.
 *
 * Deliberately one flat list rather than a tree or a board. The question this page answers is
 * "where is that thing" — 492 rows with a search box answer it in a second, and a shape that
 * needs navigating does not.
 */

export interface RepositoryItem {
  id: string;
  name: string;
  kind: string;
  description: string;
  parent: string;
  relationCount: number;
  boardCount: number;
  updatedAt: string;
}

export interface RepositoryType {
  kind: string;
  count: number;
  color: string;
  declared: boolean;
}

const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

export function Repository({ slug, types, items }: { slug: string; types: RepositoryType[]; items: RepositoryItem[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (!q) return true;
      return `${item.name} ${item.kind} ${item.description} ${item.parent}`.toLowerCase().includes(q);
    });
  }, [items, kind, query]);

  const colorOf = useMemo(() => new Map(types.map((t) => [t.kind, t.color])), [types]);

  return (
    <div className="inventory" data-repository>
      <header className="inventory-head">
        <div className="inventory-title">
          <i style={{ background: "#1376d4" }} />
          <div>
            <h1>Fact sheets</h1>
            <p>
              {items.length} object{items.length === 1 ? "" : "s"} across {types.length} type{types.length === 1 ? "" : "s"}
              {" · everything the model holds, whoever put it there"}
            </p>
          </div>
        </div>
        <label className="studio-home-search inventory-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search every object"
            aria-label="Search every object"
            data-repository-search
          />
        </label>
      </header>

      <nav className="inventory-siblings" aria-label="Types">
        <button type="button" className={kind === null ? "on" : ""} onClick={() => setKind(null)} data-type-all>
          <Layers size={12} /> Everything <small>{items.length}</small>
        </button>
        {types.map((t) => (
          <button
            key={t.kind}
            type="button"
            className={kind === t.kind ? "on" : ""}
            onClick={() => setKind(kind === t.kind ? null : t.kind)}
            data-type={t.kind}
            title={t.declared ? "Declared in the meta-model" : "This type grew from the data and has not been declared"}
          >
            <i style={{ background: t.color }} />
            {t.kind || "Untyped"} <small>{t.count}</small>
            {!t.declared && <em className="undeclared">·</em>}
          </button>
        ))}
      </nav>

      <div className="repository-body">
        <p className="inventory-count" data-repository-count>
          {shown.length === items.length ? `${items.length} objects` : `${shown.length} of ${items.length}`}
          {kind && (
            <>
              {" · "}
              <Link href={`/w/${slug}/type/${encodeURIComponent(kind)}`} data-open-type>
                open the {kind} inventory <ArrowRight size={11} />
              </Link>
            </>
          )}
        </p>

        {shown.length === 0 ? (
          <p className="inventory-empty" data-repository-empty>Nothing matches. Try a different search, or clear the type.</p>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table" data-repository-table>
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
                      <button type="button" onClick={() => setOpen(item.id)} data-open-item={item.id}>
                        {item.name || "(unnamed)"}
                      </button>
                      {item.description && <small className="repository-said">{item.description.slice(0, 90)}</small>}
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
                    <td>{day(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 600 && (
              <p className="inventory-empty">
                Showing the first 600 of {shown.length}. Search, or narrow it to one type.
              </p>
            )}
          </div>
        )}
      </div>

      {open && (
        <EntityDrawer
          entityId={open}
          workspaceId=""
          kindColor={(k) => colorOf.get(k) ?? "#94a3b8"}
          onClose={() => setOpen(null)}
          onNavigate={setOpen}
        />
      )}
    </div>
  );
}
