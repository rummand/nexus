"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, ChevronDown, ChevronRight, Network, Plus, Rows3, Spline, Trash2, X } from "lucide-react";
import type { MetaModel, MetaNodeType, MetaRelationType, Presence } from "@/lib/metamodel";
import {
  addField, addRule, createNodeType, createRelationType, declareNodeType,
  deleteField, deleteNodeType, deleteRelationType, deleteRule, updateField, updateNodeType, updateRelationType,
} from "@/lib/metamodel-actions";
import { MetaModelDiagram } from "./MetaModelDiagram";

/**
 * Meta-model builder — the technical view of the graph's schema.
 *
 * Left: the hierarchy, node types and relation types with their fields and rules. Right: the
 * selected type. Every row carries its presence, which is the point of the screen: what was
 * declared, what merely grew from the data, and what was modelled but never used.
 */

const DATA_TYPES = ["text", "number", "date", "boolean", "enum"];

type Selection = { kind: "node" | "relation"; name: string } | null;

export function MetaModelBuilder({ model, workspaceId, slug }: { model: MetaModel; workspaceId: string; slug: string }) {
  const [selected, setSelected] = useState<Selection>(model.nodeTypes[0] ? { kind: "node", name: model.nodeTypes[0].name } : null);
  const [openNodes, setOpenNodes] = useState(true);
  const [openRels, setOpenRels] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"details" | "diagram">("details");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | unknown>) => {
    setError(null);
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && "error" in r && r.error) setError(r.error);
    });
  };

  const q = filter.trim().toLowerCase();
  const nodeTypes = useMemo(() => model.nodeTypes.filter((t) => !q || t.name.toLowerCase().includes(q)), [model.nodeTypes, q]);
  const relationTypes = useMemo(() => model.relationTypes.filter((t) => !q || t.name.toLowerCase().includes(q)), [model.relationTypes, q]);

  const current = selected?.kind === "node"
    ? model.nodeTypes.find((t) => t.name === selected.name) ?? null
    : selected?.kind === "relation"
      ? model.relationTypes.find((t) => t.name === selected.name) ?? null
      : null;

  const allTypeNames = model.nodeTypes.map((t) => t.name);
  const toggle = (key: string) => setExpanded((e) => (e.includes(key) ? e.filter((x) => x !== key) : [...e, key]));

  return (
    <div className="meta-shell">
      <header className="meta-topbar">
        <div className="meta-title">
          <h1>Meta-model</h1>
          <p>
            {model.nodeTypes.length} node types · {model.relationTypes.length} relation types ·
            {" "}{model.totals.entities} nodes · {model.totals.relations} edges
            {model.totals.violations > 0 ? ` · ${model.totals.violations} rule violation${model.totals.violations === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <Link className="ghost-button" href={`/w/${slug}/explore`}>Open explorer →</Link>
      </header>

      <div className="meta-body">
        {/* ---- left: the hierarchy ---- */}
        <nav className="meta-tree" aria-label="Meta-model hierarchy">
          <input className="meta-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter types" aria-label="Filter types" />

          <button type="button" className="meta-tree-section" onClick={() => setOpenNodes((v) => !v)}>
            {openNodes ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Boxes size={13} /> Node types <small>{model.nodeTypes.length}</small>
          </button>
          {openNodes && nodeTypes.map((t) => (
            <div key={`n-${t.name}`}>
              <div className={`meta-tree-item ${selected?.kind === "node" && selected.name === t.name ? "active" : ""}`} data-type-kind="node">
                <button type="button" className="meta-tree-caret" onClick={() => toggle(`n-${t.name}`)} aria-label={`Fields of ${t.name}`}>
                  {expanded.includes(`n-${t.name}`) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button type="button" className="meta-tree-label" onClick={() => setSelected({ kind: "node", name: t.name })}>
                  <i style={{ background: t.color }} />
                  <b>{t.name}</b>
                  <PresenceDot presence={t.presence} />
                  <small>{t.instances}</small>
                </button>
              </div>
              {expanded.includes(`n-${t.name}`) && (
                <ul className="meta-tree-fields">
                  {t.fields.length === 0 && <li className="muted">no fields</li>}
                  {t.fields.map((f) => (
                    <li key={f.key} className={f.presence}>
                      <span>{f.key}</span>
                      <em>{f.dataType}</em>
                      <small>{f.usage}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <button type="button" className="meta-tree-section" onClick={() => setOpenRels((v) => !v)}>
            {openRels ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Spline size={13} /> Relation types <small>{model.relationTypes.length}</small>
          </button>
          {openRels && relationTypes.map((t) => (
            <div key={`r-${t.name}`}>
              <div className={`meta-tree-item ${selected?.kind === "relation" && selected.name === t.name ? "active" : ""}`} data-type-kind="relation">
                <button type="button" className="meta-tree-caret" onClick={() => toggle(`r-${t.name}`)} aria-label={`Rules of ${t.name}`}>
                  {expanded.includes(`r-${t.name}`) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button type="button" className="meta-tree-label" onClick={() => setSelected({ kind: "relation", name: t.name })}>
                  <i className="rel" />
                  <b>{t.name}</b>
                  <PresenceDot presence={t.presence} />
                  <small>{t.instances}</small>
                </button>
              </div>
              {expanded.includes(`r-${t.name}`) && (
                <ul className="meta-tree-fields">
                  {t.observedPairs.length === 0 && <li className="muted">no edges yet</li>}
                  {t.observedPairs.map((p) => (
                    <li key={`${p.fromType}-${p.toType}`} className={p.declared ? "declared" : t.rules.length ? "violation" : "undeclared"}>
                      <span>{p.fromType} → {p.toType}</span>
                      <small>{p.count}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="meta-tree-actions">
            <NewTypeButton label="New node type" onCreate={(name) => run(() => createNodeType(workspaceId, name))} disabled={pending} />
            <NewTypeButton label="New relation type" onCreate={(name) => run(() => createRelationType(workspaceId, name))} disabled={pending} />
          </div>
        </nav>

        {/* ---- right: the selected type, or the whole model as a diagram ---- */}
        <section className="meta-detail" aria-label="Type details">
          <div className="panel-tabs meta-view-tabs" role="tablist" aria-label="Meta-model view">
            <button type="button" role="tab" className={view === "details" ? "active" : ""} onClick={() => setView("details")}><Rows3 size={13} /> Details</button>
            <button type="button" role="tab" className={view === "diagram" ? "active" : ""} onClick={() => setView("diagram")}><Network size={13} /> Diagram</button>
          </div>

          {error && <p className="form-error">{error}</p>}

          {view === "diagram" && (
            <MetaModelDiagram model={model} selected={selected} onSelect={(next) => setSelected(next)} />
          )}

          {view === "details" && !current && <p className="muted">Select a type on the left.</p>}

          {view === "details" && current && selected?.kind === "node" && (
            <NodeTypeDetail
              type={current as MetaNodeType}
              allTypeNames={allTypeNames}
              pending={pending}
              run={run}
              workspaceId={workspaceId}
              onRenamed={(name) => setSelected({ kind: "node", name })}
              onDeleted={() => setSelected(null)}
            />
          )}

          {view === "details" && current && selected?.kind === "relation" && (
            <RelationTypeDetail
              type={current as MetaRelationType}
              allTypeNames={allTypeNames}
              pending={pending}
              run={run}
              workspaceId={workspaceId}
              onRenamed={(name) => setSelected({ kind: "relation", name })}
              onDeleted={() => setSelected(null)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

const PRESENCE_TITLE: Record<Presence, string> = {
  declared: "Declared in the meta-model and present in the data",
  undeclared: "Found in the data but never declared",
  unused: "Declared but nothing uses it yet",
};

/** Tree rows are narrow, so presence is a dot there rather than a word. */
function PresenceDot({ presence }: { presence: Presence }) {
  return <i className={`meta-dot ${presence}`} title={PRESENCE_TITLE[presence]} aria-label={presence} />;
}

function PresenceTag({ presence }: { presence: Presence }) {
  const label = presence === "declared" ? "declared" : presence === "undeclared" ? "from data" : "unused";
  return <i className={`meta-presence ${presence}`} title={PRESENCE_TITLE[presence]}>{label}</i>;
}

function NodeTypeDetail({ type, allTypeNames, pending, run, workspaceId, onRenamed, onDeleted }: {
  type: MetaNodeType; allTypeNames: string[]; pending: boolean;
  run: (fn: () => Promise<unknown>) => void; workspaceId: string;
  onRenamed: (name: string) => void; onDeleted: () => void;
}) {
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description);
  const [newField, setNewField] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  return (
    <div className="meta-detail-body" data-node-detail>
      <header>
        <i style={{ background: type.color }} />
        <div>
          <small>Node type · {type.instances} instance{type.instances === 1 ? "" : "s"}</small>
          <h2>{type.name}</h2>
        </div>
        <PresenceTag presence={type.presence} />
      </header>

      {/*
        Gated on the declaration id, not on presence: for the moment between declaring and the
        refreshed model arriving there is no id to post, and a form that quietly submits null is
        worse than one that is not there yet.
      */}
      {type.id === null ? (
        <div className="meta-callout">
          <p><b>{type.name}</b> grew from the data and has never been declared. Declaring it lets you describe it, fix its field list and constrain its relations.</p>
          <button type="button" className="primary-home-button" disabled={pending} onClick={() => run(() => declareNodeType(workspaceId, type.name))}>Declare this type</button>
        </div>
      ) : (
        <>
          <div className="meta-fields-form">
            <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="wide"><span>Description</span><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <label><span>Parent type</span>
              <select value={type.parentId ?? ""} onChange={(e) => run(() => updateNodeType(type.id!, { parentId: e.target.value || null }))}>
                <option value="">— none —</option>
                {allTypeNames.filter((n) => n !== type.name).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {(name !== type.name || description !== type.description) && (
              <button type="button" className="primary-home-button" disabled={pending} onClick={() => run(async () => { const r = await updateNodeType(type.id!, { name, description }); if (!(r && "error" in r && r.error)) onRenamed(name.trim()); return r; })}>
                Save{name !== type.name ? " and rename instances" : ""}
              </button>
            )}
          </div>

          <section className="meta-section">
            <span>Fields <small>{type.fields.length}</small></span>
            <table className="meta-table">
              <thead><tr><th>Key</th><th>Type</th><th>Used</th><th /></tr></thead>
              <tbody>
                {type.fields.map((f) => (
                  <tr key={f.key} className={f.presence}>
                    <td>{f.key} <PresenceTag presence={f.presence} /></td>
                    <td>
                      {f.id ? (
                        <select value={f.dataType} onChange={(e) => run(() => updateField(f.id!, { dataType: e.target.value }))}>
                          {DATA_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : <em>text</em>}
                    </td>
                    <td className="num">{f.usage}</td>
                    <td>
                      {f.id
                        ? <button type="button" className="meta-icon danger" title="Remove the declaration (values stay on instances)" disabled={pending} onClick={() => run(() => deleteField(f.id!))}><Trash2 size={13} /></button>
                        : <button type="button" className="meta-icon" title="Declare this field" disabled={pending} onClick={() => run(() => addField(type.id!, f.key))}><Plus size={13} /></button>}
                    </td>
                  </tr>
                ))}
                {type.fields.length === 0 && <tr><td colSpan={4} className="muted">No fields yet.</td></tr>}
              </tbody>
            </table>
            <form className="meta-add" onSubmit={(e) => { e.preventDefault(); run(() => addField(type.id!, newField, newFieldType)); setNewField(""); }}>
              <input value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="New field key" aria-label="New field key" />
              <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} aria-label="Field data type">
                {DATA_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <button type="submit" className="ghost-button" disabled={pending || !newField.trim()}><Plus size={14} /> Add field</button>
            </form>
          </section>

          <footer className="meta-footer">
            <button type="button" className="ghost-button danger" disabled={pending} onClick={() => { if (confirm(`Remove the declaration for “${type.name}”? Its ${type.instances} instances keep their kind and it becomes an undeclared type again.`)) run(async () => { const r = await deleteNodeType(type.id!); onDeleted(); return r; }); }}>
              <Trash2 size={14} /> Remove declaration
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

function RelationTypeDetail({ type, allTypeNames, pending, run, workspaceId, onRenamed, onDeleted }: {
  type: MetaRelationType; allTypeNames: string[]; pending: boolean;
  run: (fn: () => Promise<unknown>) => void; workspaceId: string;
  onRenamed: (name: string) => void; onDeleted: () => void;
}) {
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description);
  const [from, setFrom] = useState(allTypeNames[0] ?? "");
  const [to, setTo] = useState(allTypeNames[0] ?? "");

  return (
    <div className="meta-detail-body" data-relation-detail>
      <header>
        <i className="rel" />
        <div>
          <small>Relation type · {type.instances} edge{type.instances === 1 ? "" : "s"}</small>
          <h2>{type.name}</h2>
        </div>
        <PresenceTag presence={type.presence} />
      </header>

      {/* Gated on the id for the same reason as node types above. */}
      {type.id === null ? (
        <div className="meta-callout">
          <p><b>{type.name}</b> exists only in the data. Declare it to describe it and constrain which node types it may join.</p>
          <button type="button" className="primary-home-button" disabled={pending} onClick={() => run(() => createRelationType(workspaceId, type.name))}>Declare this type</button>
        </div>
      ) : (
        <>
          <div className="meta-fields-form">
            <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="wide"><span>Description</span><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            {(name !== type.name || description !== type.description) && (
              <button type="button" className="primary-home-button" disabled={pending} onClick={() => run(async () => { const r = await updateRelationType(type.id!, { name, description }); if (!(r && "error" in r && r.error)) onRenamed(name.trim()); return r; })}>
                Save{name !== type.name ? " and rename edges" : ""}
              </button>
            )}
          </div>

          <section className="meta-section">
            <span>Allowed connections <small>{type.rules.length}</small></span>
            {type.rules.length === 0 && <p className="muted">No rules — any node type may be joined by this relation.</p>}
            <ul className="meta-rules">
              {type.rules.map((r) => (
                <li key={r.id}>
                  <b>{r.fromType}</b> → <b>{r.toType}</b>
                  <small>{r.cardinality}</small>
                  <button type="button" className="meta-icon danger" title="Remove rule" disabled={pending} onClick={() => run(() => deleteRule(r.id))}><X size={13} /></button>
                </li>
              ))}
            </ul>
            <form className="meta-add" onSubmit={(e) => { e.preventDefault(); run(() => addRule(type.id!, from, to)); }}>
              <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From node type">{allTypeNames.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              <span className="meta-arrow">→</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To node type">{allTypeNames.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              <button type="submit" className="ghost-button" disabled={pending || !from || !to}><Plus size={14} /> Add rule</button>
            </form>
          </section>
        </>
      )}

      <section className="meta-section">
        <span>Observed in the data <small>{type.observedPairs.length}</small></span>
        <ul className="meta-rules">
          {type.observedPairs.map((p) => (
            <li key={`${p.fromType}-${p.toType}`} className={type.rules.length && !p.declared ? "violation" : ""}>
              {type.rules.length > 0 && !p.declared && <AlertTriangle size={12} />}
              <b>{p.fromType}</b> → <b>{p.toType}</b>
              <small>{p.count} edge{p.count === 1 ? "" : "s"}</small>
              {type.rules.length > 0 && !p.declared && type.id && (
                <button type="button" className="meta-icon" title="Allow this connection" disabled={pending} onClick={() => run(() => addRule(type.id!, p.fromType, p.toType))}><Plus size={13} /></button>
              )}
            </li>
          ))}
          {type.observedPairs.length === 0 && <li className="muted">Nothing uses this relation type yet.</li>}
        </ul>
      </section>

      {type.id && (
        <footer className="meta-footer">
          <button type="button" className="ghost-button danger" disabled={pending} onClick={() => { if (confirm(`Remove the declaration for “${type.name}”? Its ${type.instances} edges keep their type.`)) run(async () => { const r = await deleteRelationType(type.id!); onDeleted(); return r; }); }}>
            <Trash2 size={14} /> Remove declaration
          </button>
        </footer>
      )}
    </div>
  );
}

function NewTypeButton({ label, onCreate, disabled }: { label: string; onCreate: (name: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) return <button type="button" className="ghost-button" onClick={() => setOpen(true)} disabled={disabled}><Plus size={14} /> {label}</button>;
  return (
    <form className="meta-add" onSubmit={(e) => { e.preventDefault(); onCreate(value); setValue(""); setOpen(false); }}>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={label} aria-label={label} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      <button type="submit" className="ghost-button" disabled={!value.trim()}>Add</button>
    </form>
  );
}
