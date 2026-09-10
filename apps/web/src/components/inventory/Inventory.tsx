"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import type { MetaField } from "@/lib/metamodel";
import {
  activeCount, columns, facets, filterItems, plural, toggleFacet, NOT_SET,
  type InventoryItem, type Selection,
} from "@/lib/inventory";
import { EntityDrawer } from "@/components/workspace/EntityDrawer";
import { InventoryCell } from "./InventoryCell";

/**
 * The inventory of one type (§5.72).
 *
 * Three columns, in the order the reading goes: the facets that narrow it, the things
 * themselves, and — once you pick one — everything about it. The rail is built from the type's
 * *declared fields first*, because that order is somebody's considered opinion about what
 * matters, and a declared field nobody has filled still gets a row, because an empty one is a
 * finding rather than an absence.
 */

const label = (kind: string) => kind || "Untyped";

export function Inventory({
  slug, kind, color, description, declared, framework, fields, items, siblings,
}: {
  slug: string;
  kind: string;
  color: string;
  description: string;
  declared: boolean;
  framework: string;
  fields: MetaField[];
  items: InventoryItem[];
  siblings: Array<{ kind: string; count: number; color: string }>;
}) {
  const [selection, setSelection] = useState<Selection>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rail = useMemo(() => facets(items, fields, selection), [items, fields, selection]);
  const shown = useMemo(() => filterItems(items, selection, query), [items, selection, query]);
  const cols = useMemo(() => columns(items, fields), [items, fields]);
  const fieldFor = useMemo(
    () => new Map(fields.map((f) => [f.key.trim().toLowerCase(), f])),
    [fields],
  );
  const narrowing = activeCount(selection);

  return (
    <div className="inventory" data-inventory={kind}>
      <header className="inventory-head">
        <div className="inventory-title">
          <i style={{ background: color || "#94a3b8" }} />
          <div>
            <h1>{label(kind)}</h1>
            <p>
              {items.length} in the estate
              {declared
                ? framework
                  ? ` · declared, from ${framework}`
                  : " · declared in the meta-model"
                : " · this type grew from the data and has not been declared"}
              {description ? ` · ${description}` : ""}
            </p>
          </div>
        </div>
        <label className="studio-home-search inventory-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${plural(label(kind), 2).toLowerCase()}`}
            aria-label={`Search ${plural(label(kind), 2)}`}
            data-inventory-search
          />
        </label>
      </header>

      <nav className="inventory-siblings" aria-label="Other types">
        {siblings.map((s) => (
          <Link
            key={s.kind}
            href={`/w/${slug}/type/${encodeURIComponent(s.kind)}`}
            className={s.kind === kind ? "on" : ""}
            data-sibling={s.kind}
          >
            <i style={{ background: s.color }} />
            {label(s.kind)} <small>{s.count}</small>
          </Link>
        ))}
      </nav>

      <div className="inventory-body">
        <aside className="inventory-facets" aria-label="Filters" data-facets>
          <div className="inventory-facets-head">
            <span><SlidersHorizontal size={12} /> Narrow it down</span>
            {narrowing > 0 && (
              <button type="button" onClick={() => setSelection({})} data-clear-facets>
                Clear {narrowing}
              </button>
            )}
          </div>

          {rail.map((f) => (
            <section key={f.key} className="facet" data-facet={f.key}>
              <h3>
                {f.key}
                {!f.declared && <em title="This key is in the data; the meta-model does not declare it">from data</em>}
              </h3>
              {f.values.length === 0 && f.missing === 0 ? (
                <p className="facet-none">Nothing here carries it.</p>
              ) : (
                <div className="facet-values">
                  {f.values.slice(0, 8).map((v) => {
                    const on = (selection[f.key] ?? []).includes(v.value);
                    return (
                      <button
                        key={v.value}
                        type="button"
                        className={on ? "on" : ""}
                        onClick={() => setSelection(toggleFacet(selection, f.key, v.value))}
                        data-facet-value={v.value}
                      >
                        {on && <Check size={11} />}
                        <span>{v.value}</span>
                        <b>{v.count}</b>
                      </button>
                    );
                  })}
                  {f.values.length > 8 && <em className="facet-more">+{f.values.length - 8} more values</em>}
                  {f.missing > 0 && (
                    <button
                      type="button"
                      className={`missing ${(selection[f.key] ?? []).includes(NOT_SET) ? "on" : ""}`}
                      onClick={() => setSelection(toggleFacet(selection, f.key, NOT_SET))}
                      title={`The ${plural(label(kind), 2).toLowerCase()} with no ${f.key}`}
                      data-facet-missing
                    >
                      {(selection[f.key] ?? []).includes(NOT_SET) && <Check size={11} />}
                      <span>not set</span>
                      <b>{f.missing}</b>
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
        </aside>

        <main className="inventory-list">
          <p className="inventory-count" data-inventory-count>
            {shown.length === items.length
              ? `${items.length} ${plural(label(kind), items.length).toLowerCase()}`
              : `${shown.length} of ${items.length}`}
            {narrowing > 0 && <span> · narrowed by {narrowing} filter{narrowing === 1 ? "" : "s"}</span>}
          </p>

          {shown.length === 0 ? (
            <p className="inventory-empty" data-inventory-empty>
              Nothing matches. {narrowing > 0 ? "Clear a filter, or " : ""}try a different search.
            </p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table" data-inventory-table>
                <thead>
                  <tr>
                    <th>Name</th>
                    {cols.map((c) => (
                      <th key={c}>
                        {c}
                        {fieldFor.get(c.trim().toLowerCase())?.required && <b title="Required by the meta-model">*</b>}
                      </th>
                    ))}
                    <th className="num">Relations</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <tr key={item.id} data-inventory-row={item.id}>
                      <th scope="row">
                        <button type="button" onClick={() => setOpen(item.id)} data-open-item={item.id}>
                          {item.name || "(unnamed)"}
                        </button>
                      </th>
                      {cols.map((c) => (
                        <td key={c}>
                          <InventoryCell
                            entityId={item.id}
                            column={c}
                            value={item.attributes[c] ?? ""}
                            field={fieldFor.get(c.trim().toLowerCase())}
                          />
                        </td>
                      ))}
                      <td className="num">{item.relationCount || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {open && (
        <EntityDrawer
          entityId={open}
          workspaceId=""
          kindColor={() => color || "#94a3b8"}
          onClose={() => setOpen(null)}
          onNavigate={setOpen}
        />
      )}

      <button type="button" className="inventory-close-hint" hidden onClick={() => setOpen(null)}>
        <X size={12} /> close
      </button>
    </div>
  );
}
