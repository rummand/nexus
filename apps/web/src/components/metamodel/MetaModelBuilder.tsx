"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, BookOpen, Layers as LayersIcon, Network, Plus, Rows3, ShieldCheck, Spline, Table2, Trash2, X } from "lucide-react";
import type { MetaField, MetaLayer, MetaModel, MetaNodeType, MetaRelationType, Presence } from "@/lib/metamodel";
import {
  addField, addRule, createNodeType, createRelationType, declareNodeType,
  deleteField, deleteNodeType, deleteRelationType, deleteRule, updateField, updateNodeType, updateRelationType,
} from "@/lib/metamodel-actions";
import { MetaModelDiagram } from "./MetaModelDiagram";
import { Conformance } from "./Conformance";
import { Frameworks } from "./Frameworks";
import { Layers } from "./Layers";
import { framework } from "@/lib/frameworks";
import { sectionsOf } from "@/lib/factsheet";
import { placeNodeType } from "@/lib/layers/actions";
import { article, type Conformance as ConformanceReport } from "@/lib/metamodel-conformance";
import { bands, cards, filterCards, health, type Only, type TypeCard } from "@/lib/metamodel-board";
import { TypeCardTile } from "./TypeCard";
import { HealthStrip } from "./HealthStrip";
import { Rules } from "./Rules";

/**
 * Meta-model builder — the technical view of the graph's schema.
 *
 * Left: the hierarchy, node types and relation types with their fields and rules. Right: the
 * selected type. Every row carries its presence, which is the point of the screen: what was
 * declared, what merely grew from the data, and what was modelled but never used.
 */

const DATA_TYPES = ["text", "number", "date", "boolean", "enum"];

type Selection = { kind: "node" | "relation"; name: string } | null;

/** What the corpus says about a type name — precomputed on the server (§5.20). */
export interface TypeNote { label: string; title: string; url: string; text: string }

export function MetaModelBuilder({ model, workspaceId, slug, notes = {}, report, adopted = [] }: { model: MetaModel; workspaceId: string; slug: string; notes?: Record<string, TypeNote>; report: ConformanceReport; adopted?: string[] }) {
  /*
   * Nothing is selected to begin with (§5.66). The old page opened with the first node type
   * expanded in an inspector, which answered a question nobody had asked yet; the board answers
   * "what is our architecture made of" before anybody clicks.
   */
  const [selected, setSelected] = useState<Selection>(null);
  const [filter, setFilter] = useState("");
  const [only, setOnly] = useState<Only>("all");
  const [groupBy, setGroupBy] = useState<"none" | "layer" | "kind">("kind");
  const [shape, setShape] = useState<"board" | "rules" | "diagram">("board");
  const [drawer, setDrawer] = useState<"layers" | "conformance" | "frameworks" | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | unknown>) => {
    setError(null);
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && "error" in r && r.error) setError(r.error);
    });
  };

  const all = useMemo(() => cards(model, report), [model, report]);
  const shown = useMemo(() => filterCards(all, filter, only), [all, filter, only]);
  const grouped = useMemo(() => bands(shown, model, groupBy), [shown, model, groupBy]);
  const state = useMemo(() => health(all, report), [all, report]);

  const current = selected?.kind === "node"
    ? model.nodeTypes.find((t) => t.name === selected.name) ?? null
    : selected?.kind === "relation"
      ? model.relationTypes.find((t) => t.name === selected.name) ?? null
      : null;

  const allTypeNames = model.nodeTypes.map((t) => t.name);
  const pick = (card: TypeCard) => setSelected({ kind: card.kind, name: card.name });

  return (
    <div className="meta-shell">
      <header className="meta-topbar">
        <div className="meta-title">
          <h1>Meta-model</h1>
          <p>
            The vocabulary this organisation uses for its own architecture —
            {" "}{model.nodeTypes.length} object {model.nodeTypes.length === 1 ? "type" : "types"},
            {" "}{model.relationTypes.length} relationship {model.relationTypes.length === 1 ? "type" : "types"},
            {" "}over {model.totals.entities.toLocaleString()} objects.
          </p>
        </div>
        <Link className="ghost-button" href={`/w/${slug}/explore`}>Open explorer →</Link>
      </header>

      <HealthStrip state={state} only={only} onOnly={setOnly} />

      {/*
        One toolbar over one view (§5.66). What used to be five tabs is a shape toggle, a grouping
        and three drawers: Layers, Conformance and Frameworks are things you consult *about* the
        model on screen, not separate screens showing the same types again.
      */}
      <div className="meta-toolbar">
        {shape === "board" && (
          <input
            className="meta-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search types"
            aria-label="Search types"
            data-meta-search
          />
        )}
        <div className="meta-seg" role="group" aria-label="How to show the model">
          <button type="button" className={shape === "board" ? "on" : ""} onClick={() => setShape("board")} data-shape="board"><Rows3 size={13} /> Types</button>
          <button type="button" className={shape === "rules" ? "on" : ""} onClick={() => setShape("rules")} data-shape="rules"><Spline size={13} /> Rules</button>
          <button type="button" className={shape === "diagram" ? "on" : ""} onClick={() => setShape("diagram")} data-shape="diagram"><Network size={13} /> Diagram</button>
        </div>
        {/* Grouping is a property of the card board; it means nothing to a table or a diagram. */}
        {shape === "board" && (
        <div className="meta-seg" role="group" aria-label="Group by">
          <button type="button" className={groupBy === "kind" ? "on" : ""} onClick={() => setGroupBy("kind")} data-group="kind">Kind</button>
          <button
            type="button"
            className={groupBy === "layer" ? "on" : ""}
            onClick={() => setGroupBy("layer")}
            disabled={model.layers.length === 0}
            title={model.layers.length === 0 ? "No layers yet — read a stack from the data in Layers" : "Band the model by its layers"}
            data-group="layer"
          >
            Layer
          </button>
          <button type="button" className={groupBy === "none" ? "on" : ""} onClick={() => setGroupBy("none")} data-group="none">Flat</button>
        </div>
        )}
        <span className="meta-toolbar-gap" />
        <button type="button" className={`ghost-button ${drawer === "layers" ? "on" : ""}`} onClick={() => setDrawer(drawer === "layers" ? null : "layers")} data-tab-layers>
          <LayersIcon size={14} /> Layers{model.layers.length > 0 && <i className="tab-count">{model.layers.length}</i>}
        </button>
        <button type="button" className={`ghost-button ${drawer === "conformance" ? "on" : ""}`} onClick={() => setDrawer(drawer === "conformance" ? null : "conformance")} data-tab-conformance>
          <ShieldCheck size={14} /> Conformance{report.breaches.length > 0 && <i className="tab-count">{report.breaches.length}</i>}
        </button>
        <button type="button" className={`ghost-button ${drawer === "frameworks" ? "on" : ""}`} onClick={() => setDrawer(drawer === "frameworks" ? null : "frameworks")} data-tab-frameworks>
          <BookOpen size={14} /> Frameworks{adopted.length > 0 && <i className="tab-count">{adopted.length}</i>}
        </button>
      </div>

      {error && <p className="form-error meta-error">{error}</p>}

      {drawer && (
        <div className="meta-drawer" data-meta-drawer={drawer}>
          <button type="button" className="meta-drawer-close" onClick={() => setDrawer(null)} aria-label="Close"><X size={14} /></button>
          {drawer === "layers" && <Layers model={model} workspaceId={workspaceId} onChanged={() => router.refresh()} />}
          {drawer === "conformance" && <Conformance report={report} slug={slug} />}
          {drawer === "frameworks" && <Frameworks workspaceId={workspaceId} adopted={adopted} model={model} onChanged={() => router.refresh()} />}
        </div>
      )}

      <div className={`meta-body ${selected ? "with-inspector" : ""}`}>
        <div className="meta-main">
          {shape === "diagram" ? (
            <MetaModelDiagram model={model} selected={selected} onSelect={(next) => setSelected(next)} />
          ) : shape === "rules" ? (
            <Rules model={model} slug={slug} />
          ) : grouped.length === 0 ? (
            <p className="meta-empty" data-meta-empty>
              {all.length === 0
                ? "Nothing is modelled yet. Declare a type, or adopt a framework to start from one somebody else has already argued about."
                : "Nothing matches. Clear the search, or the filter above it."}
            </p>
          ) : (
            grouped.map((band) => (
              <section key={band.id} className="meta-band" data-meta-band={band.id}>
                {band.label && (
                  <header className="meta-band-head">
                    {band.color && <i className="meta-band-swatch" style={{ background: band.color }} />}
                    <h2>{band.label}</h2>
                    <em>{band.cards.length}</em>
                    {band.note && <span>{band.note}</span>}
                  </header>
                )}
                {band.shared && <p className={`meta-band-shared ${band.shared.kind}`}>{band.shared.text}</p>}
                <div className="meta-grid">
                  {band.cards.map((card) => (
                    <TypeCardTile
                      key={card.id}
                      card={card}
                      selected={selected?.kind === card.kind && selected.name === card.name}
                      onSelect={() => pick(card)}
                      quiet={Boolean(band.shared)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          <div className="meta-new">
            <button type="button" className="ghost-button" disabled={pending} onClick={() => run(async () => {
              const r = await createNodeType(workspaceId, "New type");
              router.refresh();
              return r;
            })} data-new-node-type><Plus size={14} /> New object type</button>
            <button type="button" className="ghost-button" disabled={pending} onClick={() => run(async () => {
              const r = await createRelationType(workspaceId, "relates to");
              router.refresh();
              return r;
            })} data-new-relation-type><Plus size={14} /> New relationship type</button>
          </div>
        </div>

        {/*
          The inspector appears when something is selected and takes the space back when it is
          not (§5.66). A permanent right-hand panel showing "select a type on the left" is a
          third of the screen spent saying nothing.
        */}
        {selected && (
        <section className="meta-detail" aria-label="Type details">
          <header className="meta-detail-head">
            <span>{selected.kind === "node" ? "Object type" : "Relationship type"}</span>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close" data-close-inspector><X size={14} /></button>
          </header>

          {!current && <p className="muted">That type is gone.</p>}

          {current && selected?.kind === "node" && (
            <NodeTypeDetail
              note={notes[(current as MetaNodeType).name.toLowerCase()]}
              type={current as MetaNodeType}
              allTypeNames={allTypeNames}
              layers={model.layers}
              pending={pending}
              run={run}
              workspaceId={workspaceId}
              slug={slug}
              onRenamed={(name) => setSelected({ kind: "node", name })}
              onDeleted={() => setSelected(null)}
            />
          )}

          {current && selected?.kind === "relation" && (
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
        )}
      </div>
    </div>
  );
}

const PRESENCE_TITLE: Record<Presence, string> = {
  declared: "Declared in the meta-model and present in the data",
  undeclared: "Found in the data but never declared",
  unused: "Declared but nothing uses it yet",
};


const frameworkName = (id: string) => framework(id)?.name ?? id;

function PresenceTag({ presence }: { presence: Presence }) {
  const label = presence === "declared" ? "declared" : presence === "undeclared" ? "from data" : "unused";
  return <i className={`meta-presence ${presence}`} title={PRESENCE_TITLE[presence]}>{label}</i>;
}

/**
 * What an enum value may be (§5.72).
 *
 * Comma-separated, because the alternative is a list widget with add and remove buttons for
 * something people almost always paste in one go. The options are what the inventory offers as
 * a dropdown and what `valueProblem` checks against, so this small box is the difference
 * between a declared type that constrains the data and one that only describes it.
 */
function EnumOptions({ field, pending, run }: {
  field: MetaField;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [draft, setDraft] = useState(field.options.join(", "));
  const parsed = draft.split(",").map((o) => o.trim()).filter(Boolean);
  const changed = parsed.join("|") !== field.options.join("|");

  return (
    <div className="meta-options" data-enum-options={field.key}>
      <label>
        <span>allowed values</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="active, sunset, retired"
          aria-label={`Allowed values for ${field.key}`}
          data-enum-input={field.key}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onBlur={() => { if (changed) run(() => updateField(field.id!, { options: parsed })); }}
        />
      </label>
      {field.options.length === 0 && (
        <em>Nothing declared yet, so anything is allowed and the inventory edits it as free text.</em>
      )}
      {pending && <em>saving…</em>}
    </div>
  );
}

function NodeTypeDetail({ type, allTypeNames, layers, pending, run, workspaceId, slug, onRenamed, onDeleted, note }: {
  type: MetaNodeType; allTypeNames: string[]; layers: MetaLayer[]; pending: boolean;
  run: (fn: () => Promise<unknown>) => void; workspaceId: string; slug: string;
  onRenamed: (name: string) => void; onDeleted: () => void;
  /** What the EA corpus says about a type with this name, if anything. */
  note?: TypeNote;
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
          <small>
            Node type · {type.instances} instance{type.instances === 1 ? "" : "s"}
            {type.framework && <> · declared by <b>{frameworkName(type.framework)}</b></>}
          </small>
          <h2>{type.name}</h2>
        </div>
        <PresenceTag presence={type.presence} />
      </header>

      {/* A type with data is a place you can go (§5.72): the inventory, faceted by these fields. */}
      {type.instances > 0 && (
        <Link className="ghost-button meta-browse" href={`/w/${slug}/type/${encodeURIComponent(type.name)}`} data-browse-type>
          <Table2 size={13} /> Browse the {type.instances.toLocaleString()} {type.instances === 1 ? "object" : "objects"}
        </Link>
      )}

      {/*
        The literature on this type, from the knowledge base. A meta-model is a set of claims about
        what kinds of thing exist; having the definition next to the declaration is how you notice
        that your "Capability" is really a department.
      */}
      {note && (
        <details className="meta-literature" data-literature>
          <summary><BookOpen size={12} /> What the literature calls {article(type.name)} {type.name.toLowerCase()}</summary>
          <blockquote>
            {note.text}
            <a href={note.url} target="_blank" rel="noreferrer noopener">{note.label}</a>
          </blockquote>
        </details>
      )}

      {/* Which band of the stack this type sits in (§5.58). */}
      {type.id && layers.length > 0 && (
        <label className="meta-layer-pick">
          <span>Layer</span>
          <select
            value={type.layerId ?? ""}
            disabled={pending}
            data-layer-pick
            onChange={(e) => run(() => placeNodeType(type.id!, e.target.value || null))}
          >
            <option value="">not in a layer</option>
            {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

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
            <datalist id={`sections-${type.id}`}>
              {sectionsOf(type.fields).map((sec) => <option key={sec} value={sec} />)}
            </datalist>
            <table className="meta-table">
              <thead><tr><th>Key</th><th>Type</th><th>Section</th><th>Used</th><th /></tr></thead>
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
                    <td>
                      {/*
                        * Where the field sits on a fact sheet (§5.77). A free text box with the
                        * sections this type already uses offered alongside: a fixed list would be
                        * this product deciding that every organisation groups an application the
                        * same way, which is the assumption §2.2 exists to reject.
                        */}
                      {f.id ? (
                        <>
                          <input
                            className="meta-section-input"
                            defaultValue={f.section}
                            list={`sections-${type.id}`}
                            placeholder="unfiled"
                            aria-label={`Section for ${f.key}`}
                            data-field-section={f.key}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            onBlur={(e) => { if (e.target.value.trim() !== f.section) run(() => updateField(f.id!, { section: e.target.value })); }}
                          />
                        </>
                      ) : <em>—</em>}
                    </td>
                    <td className="num">{f.usage}</td>
                    <td>
                      {f.id
                        ? <button type="button" className="meta-icon danger" title="Remove the declaration (values stay on instances)" disabled={pending} onClick={() => run(() => deleteField(f.id!))}><Trash2 size={13} /></button>
                        : <button type="button" className="meta-icon" title="Declare this field" disabled={pending} onClick={() => run(() => addField(type.id!, f.key))}><Plus size={13} /></button>}
                    </td>
                  </tr>
                ))}
                {/*
                  * An enum's options had no interface at all: they could only arrive by adopting a
                  * framework, which left a workspace that invented its own types unable to say
                  * what a value may be — and the inventory's typed editing (§5.72) unreachable on
                  * exactly the path §2.2 calls the default one.
                  */}
                {type.fields.filter((f) => f.id && f.dataType === "enum").map((f) => (
                  <tr key={`${f.key}-options`} className="meta-options-row">
                    <td colSpan={5}>
                      <EnumOptions field={f} pending={pending} run={run} />
                    </td>
                  </tr>
                ))}
                {type.fields.length === 0 && <tr><td colSpan={5} className="muted">No fields yet.</td></tr>}
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

