"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Plus } from "lucide-react";
import type { EntitySummary, GraphSnapshot } from "@/lib/graph-types";
import { setEntityAttributeAction } from "@/lib/actions";

type SortKey = "name" | "kind" | "relations" | "boards" | `attr:${string}`;

/**
 * Spreadsheet view of entities: one column per attribute key in use (the emergent schema),
 * cells editable in place. Adding a column just adds a key — the schema is whatever the data says.
 */
export function EntityTable({ entities, snapshot, kindFilter }: { entities: EntitySummary[]; snapshot: GraphSnapshot; kindFilter: string | null }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [extraKeys, setExtraKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);

  const keys = useMemo(() => {
    const counts = new Map<string, number>();
    const kindKeys = kindFilter ? snapshot.kinds.find((k) => k.kind === kindFilter)?.attributeKeys.map((a) => a.key) ?? [] : [];
    for (const e of entities) for (const k of Object.keys(e.attributes)) counts.set(k, (counts.get(k) ?? 0) + 1);
    const ordered = kindKeys.length ? [...kindKeys, ...[...counts.keys()].filter((k) => !kindKeys.includes(k))] : [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    return [...ordered, ...extraKeys.filter((k) => !ordered.includes(k))];
  }, [entities, snapshot, kindFilter, extraKeys]);

  const rows = useMemo(() => {
    const val = (e: EntitySummary): string | number => {
      if (sort.key === "name") return e.name.toLowerCase();
      if (sort.key === "kind") return e.kind.toLowerCase();
      if (sort.key === "relations") return e.relationCount;
      if (sort.key === "boards") return e.boards.length;
      return (e.attributes[sort.key.slice(5)] ?? "￿").toLowerCase();
    };
    return [...entities].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [entities, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const head = (k: SortKey, label: string) => <Head key={k} k={k} label={label} sort={sort} onToggle={toggleSort} />;

  const copyCsv = async () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const header = ["kind", "name", "description", ...keys];
    const lines = [header.join(","), ...rows.map((e) => [e.kind, e.name, e.description, ...keys.map((k) => e.attributes[k] ?? "")].map(esc).join(","))];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — nothing to do */
    }
  };

  return (
    <div className="entity-table-wrap">
      <div className="entity-table-tools">
        <form className="entity-table-addcol" onSubmit={(e) => { e.preventDefault(); const k = newKey.trim(); if (k && !keys.includes(k)) setExtraKeys((x) => [...x, k]); setNewKey(""); }}>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="New attribute column" aria-label="New attribute column" />
          <button type="submit" className="ghost-button" disabled={!newKey.trim()}><Plus size={14} /> Add column</button>
        </form>
        <button type="button" className="ghost-button" onClick={copyCsv} disabled={rows.length === 0}><Copy size={14} /> {copied ? "Copied" : "Copy as CSV"}</button>
      </div>
      <div className="entity-table-scroll">
        <table className="entity-table" data-entity-table>
          <thead>
            <tr>
              {head("name", "Name")}
              {!kindFilter && head("kind", "Kind")}
              {keys.map((k) => head(`attr:${k}`, k))}
              {head("relations", "Relations")}
              {head("boards", "Boards")}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="entity-table-name"><strong>{e.name || "(unnamed)"}</strong>{e.description && <small>{e.description}</small>}</td>
                {!kindFilter && <td><span className="entity-table-kind"><i style={{ background: snapshot.kinds.find((k) => k.kind === e.kind)?.color ?? "#1376d4" }} />{e.kind || "Untyped"}</span></td>}
                {keys.map((k) => <Cell key={k} entityId={e.id} attrKey={k} value={e.attributes[k] ?? ""} />)}
                <td className="num">{e.relationCount}</td>
                <td>{e.boards.length ? e.boards.map((b, i) => <span key={b.id}>{i > 0 && ", "}<Link href={`/b/${b.id}`}>{b.name}</Link></span>) : <span className="muted">—</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={keys.length + 4} className="muted" style={{ textAlign: "center", padding: 24 }}>No entities match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Head({ k, label, sort, onToggle }: { k: SortKey; label: string; sort: { key: SortKey; dir: 1 | -1 }; onToggle: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <th aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onToggle(k)}>{label}{active && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button>
    </th>
  );
}

/** One editable attribute cell: click to edit, Enter / blur saves, Escape cancels, empty removes the attribute. */
function Cell({ entityId, attrKey, value }: { entityId: string; attrKey: string; value: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const [shown, setShown] = useState(value);
  // keep the optimistic value in sync when the server re-renders with fresh data
  if (!editing && !pending && shown !== value) setShown(value);
  const commit = () => {
    setEditing(false);
    if (draft === shown) return;
    setShown(draft);
    start(async () => { await setEntityAttributeAction(entityId, attrKey, draft); });
  };
  if (editing) {
    return (
      <td className="editing">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(shown); setEditing(false); } }}
          aria-label={`${attrKey} value`}
        />
      </td>
    );
  }
  return (
    <td className={shown ? "" : "empty"} onClick={() => { setDraft(shown); setEditing(true); }} title="Click to edit" data-cell>
      {shown || <span>—</span>}
    </td>
  );
}
