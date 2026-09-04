"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Database, LayoutTemplate, Pencil, Search, Trash2, Upload } from "lucide-react";
import type { Space } from "@/db/schema";
import type { GraphSnapshot, ImportResult, Proposal } from "@/lib/graph-types";
import { ProposalsPanel } from "./ProposalsPanel";
import { createBoardFromGraph, deleteEntity, importGraphText, renameKind, updateEntity } from "@/lib/actions";
import { Modal } from "./Modal";

const SAMPLE = `kind,name,description
Application,CRM Cloud,Customer relationship management
Application,ERP Core,Finance and procurement
Business Capability,Revenue Management,Bill and collect
Interface,Customer API,REST interface exposed by CRM Cloud
# relations
from,relation,to
CRM Cloud,provides,Customer API
Customer API,consumed by,ERP Core
CRM Cloud,supports,Revenue Management`;

/** Workspace knowledge graph: inventory, emergent meta-model, import, lay out on a board. */
export function GraphBrowser({ workspaceId, slug, snapshot, spaces, proposals }: { workspaceId: string; slug: string; snapshot: GraphSnapshot; spaces: Space[]; proposals: Proposal[] }) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ kind: "", name: "", description: "" });
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.entities.filter((e) => (!kindFilter || e.kind === kindFilter) && (!q || `${e.kind} ${e.name} ${e.description}`.toLowerCase().includes(q)));
  }, [snapshot, query, kindFilter]);

  const totalRelations = snapshot.relationKinds.reduce((a, k) => a + k.count, 0);

  return (
    <section className="studio-home-main">
      <header className="studio-home-topbar">
        <div>
          <span>{snapshot.entities.length} entities · {snapshot.kinds.length} kinds · {totalRelations} relations — the meta-model grows from what you put on boards and import</span>
          <h1>Knowledge graph</h1>
        </div>
        <div className="studio-home-actions">
          <button className="ghost-button" type="button" onClick={() => setLayoutOpen(true)} disabled={snapshot.entities.length === 0}><LayoutTemplate size={16} /> Lay out on a board</button>
          <button className="primary-home-button" type="button" onClick={() => setImportOpen(true)}><Upload size={18} /> Import data</button>
        </div>
      </header>

      <ProposalsPanel workspaceId={workspaceId} proposals={proposals} />

      <section className="studio-board-browser" aria-label="Meta-model">
        <div className="studio-board-browser-title">
          <div>
            <h2>Emergent meta-model</h2>
            <p>Kinds and relation types discovered so far. Click a kind to filter; rename a kind to merge vocabularies.</p>
          </div>
        </div>
        <div className="metamodel-grid">
          {snapshot.kinds.map((k) => (
            <KindCard key={k.kind} kind={k.kind} count={k.count} color={k.color} active={kindFilter === k.kind} onSelect={() => setKindFilter(kindFilter === k.kind ? null : k.kind)} onRename={(to) => start(() => renameKind(workspaceId, k.kind, to))} />
          ))}
          {snapshot.kinds.length === 0 && <div className="studio-empty-boards"><Database size={26} /><strong>No kinds yet</strong><span>Add cards to a board or import a CSV to start growing the meta-model.</span></div>}
        </div>
        {snapshot.relationKinds.length > 0 && (
          <div className="relation-kind-row">
            <span>Relation types</span>
            {snapshot.relationKinds.map((r) => <i key={r.kind}>{r.kind || "(unlabelled)"} · {r.count}</i>)}
          </div>
        )}
      </section>

      <section className="studio-board-browser" aria-label="Entities">
        <div className="studio-board-browser-title">
          <div>
            <h2>{kindFilter ? `${kindFilter} entities` : "All entities"}</h2>
            <p>{filtered.length} shown · place any entity on any board from that board&apos;s Graph inventory.</p>
          </div>
          <label className="studio-home-search" style={{ width: 320 }}>
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search entities" />
          </label>
        </div>
        <div className="studio-board-list">
          {filtered.map((e) => (
            <article key={e.id} className="studio-board-row entity-row">
              {editing === e.id ? (
                <form
                  className="entity-edit"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    start(async () => {
                      await updateEntity(e.id, draft);
                      setEditing(null);
                    });
                  }}
                >
                  <input value={draft.kind} onChange={(ev) => setDraft({ ...draft, kind: ev.target.value })} placeholder="Kind" />
                  <input value={draft.name} onChange={(ev) => setDraft({ ...draft, name: ev.target.value })} placeholder="Name" autoFocus />
                  <input value={draft.description} onChange={(ev) => setDraft({ ...draft, description: ev.target.value })} placeholder="Description" />
                  <button type="submit" className="primary-home-button" disabled={pending}>Save</button>
                  <button type="button" className="ghost-button" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <div className="studio-board-open" style={{ cursor: "default" }}>
                    <span className="board-glyph" style={{ background: kindColor(snapshot, e.kind) + "22", color: kindColor(snapshot, e.kind) }}>■</span>
                    <span>
                      <strong>{e.name || "(unnamed)"}</strong>
                      <small>{e.description || "No description"}</small>
                      <em>{e.kind || "Untyped"} · {e.relationCount} relation{e.relationCount === 1 ? "" : "s"} · source {e.source}</em>
                    </span>
                  </div>
                  <span>{e.boards.length ? e.boards.map((b, i) => <span key={b.id}>{i > 0 && ", "}<Link href={`/b/${b.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>{b.name}</Link></span>) : "Not on any board"}</span>
                  <span>{new Date(e.updatedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</span>
                  <div className="studio-board-row-actions">
                    <button type="button" title="Edit" onClick={() => { setEditing(e.id); setDraft({ kind: e.kind, name: e.name, description: e.description }); }}><Pencil size={17} /></button>
                    <button type="button" className="danger" title="Delete from graph (cards stay on boards)" onClick={() => { if (confirm(`Delete "${e.name}" from the graph? Cards on boards keep their text but lose the link.`)) start(() => deleteEntity(e.id)); }}><Trash2 size={17} /></button>
                  </div>
                </>
              )}
            </article>
          ))}
          {filtered.length === 0 && <div className="studio-empty-boards"><Database size={26} /><strong>No entities</strong><span>{snapshot.entities.length ? "Nothing matches the filter." : "Cards you create on boards become entities here automatically."}</span></div>}
        </div>
      </section>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} workspaceId={workspaceId} />
      <LayoutDialog open={layoutOpen} onClose={() => setLayoutOpen(false)} workspaceId={workspaceId} spaces={spaces} kinds={snapshot.kinds.map((k) => k.kind)} slug={slug} />
    </section>
  );
}

function kindColor(snapshot: GraphSnapshot, kind: string) {
  return snapshot.kinds.find((k) => k.kind === kind)?.color ?? "#1376d4";
}

function KindCard({ kind, count, color, active, onSelect, onRename }: { kind: string; count: number; color: string; active: boolean; onSelect: () => void; onRename: (to: string) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(kind);
  return (
    <div className={active ? "kind-card active" : "kind-card"}>
      <button type="button" className="kind-card-main" onClick={onSelect}>
        <i style={{ background: color }} />
        {renaming ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => { setRenaming(false); if (value.trim() && value.trim() !== kind) onRename(value); else setValue(kind); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setValue(kind); setRenaming(false); } }}
          />
        ) : (
          <strong>{kind || "Untyped"}</strong>
        )}
        <small>{count}</small>
      </button>
      <button type="button" className="kind-card-rename" title="Rename kind" onClick={() => setRenaming(true)}><Pencil size={13} /></button>
    </div>
  );
}

function ImportDialog({ open, onClose, workspaceId }: { open: boolean; onClose: () => void; workspaceId: string }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<ImportResult | { error: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open={open} onClose={onClose} title="Import data into the graph" width={680}>
      <div className="grid gap-4">
        <p style={{ color: "#65738a", fontSize: 13, margin: 0 }}>
          Paste CSV or JSON, or load a file. Entities: <code>kind,name,description</code>. Relations after a <code># relations</code> line: <code>from,relation,to</code> (names, or <code>Kind:Name</code>). Existing entities are matched by kind and name.
        </p>
        <div className="field-row">
          <div className="field">
            <label>Source name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ServiceNow export, Q3 portfolio" />
          </div>
          <div className="field">
            <label>File</label>
            <input type="file" accept=".csv,.txt,.json" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!name) setName(f.name); f.text().then(setText); }} />
          </div>
        </div>
        <div className="field">
          <label>Data</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={SAMPLE} style={{ fontFamily: "var(--mono)", fontSize: 12, minHeight: 200 }} />
        </div>
        {result && "error" in result && <p className="form-error">{result.error}</p>}
        {result && !("error" in result) && (
          <div className="mode-banner" style={{ margin: 0 }}>
            <span>Import result</span>
            <strong>{result.entitiesCreated} entities created · {result.entitiesUpdated} updated · {result.relationsCreated} relations created</strong>
            {result.skipped.length > 0 && <small>Skipped: {result.skipped.slice(0, 5).join("; ")}{result.skipped.length > 5 ? ` … +${result.skipped.length - 5}` : ""}</small>}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost-button spacer" onClick={() => setText(SAMPLE)}>Use sample</button>
          <button type="button" className="ghost-button" onClick={onClose}>{result ? "Done" : "Cancel"}</button>
          <button type="button" className="primary-home-button" disabled={pending || !text.trim()} onClick={() => start(async () => setResult(await importGraphText(workspaceId, text, name || undefined)))}>{pending ? "Importing…" : "Import"}</button>
        </div>
      </div>
    </Modal>
  );
}

function LayoutDialog({ open, onClose, workspaceId, spaces, kinds }: { open: boolean; onClose: () => void; workspaceId: string; spaces: Space[]; kinds: string[]; slug: string }) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open={open} onClose={onClose} title="Lay the graph out on a new board">
      <div className="grid gap-4">
        <p style={{ color: "#65738a", fontSize: 13, margin: 0 }}>One frame per kind, cards inside, connectors for every relation between placed entities. The board stays linked: edits flow back into the graph.</p>
        <div className="field-row">
          <div className="field">
            <label>Space</label>
            <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>{spaces.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}</select>
          </div>
          <div className="field">
            <label>Board name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Whole graph" />
          </div>
        </div>
        <div className="field">
          <span>Kinds (none selected = all)</span>
          <div className="swatch-row" style={{ gap: 8 }}>
            {kinds.map((k) => (
              <button key={k} type="button" className={selected.includes(k) ? "ghost-button active" : "ghost-button"} style={{ height: 32, minHeight: 32, width: "auto", borderRadius: 999 }} onClick={() => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}>{k || "Untyped"}</button>
            ))}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-home-button" disabled={pending || !spaceId} onClick={() => start(async () => { const r = await createBoardFromGraph({ workspaceId, spaceId, name, kinds: selected.length ? selected : undefined }); if (r && "error" in r) setError(r.error); })}>{pending ? "Creating…" : "Create board"}</button>
        </div>
      </div>
    </Modal>
  );
}
