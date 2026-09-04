"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, GitMerge, Plus, Trash2, X } from "lucide-react";
import type { EntityDetail } from "@/lib/graph-types";
import { attributeIsRisk } from "@/canvas/document";
import { createRelationAction, deleteEntity, deleteRelationAction, mergeEntitiesAction, setEntityAttributeAction, updateEntity } from "@/lib/actions";

/**
 * Entity detail drawer on the Knowledge graph page: the one place to see and edit everything the
 * graph knows about an entity — kind / name / description, attributes (with the kind's schema as
 * suggestions), relations (navigable), boards it appears on, and duplicate candidates to merge.
 */
export function EntityDrawer({ entityId, workspaceId, kindColor, onClose, onNavigate, entities = [], relationKinds = [] }: { entityId: string | null; workspaceId: string; kindColor: (kind: string) => string; onClose: () => void; onNavigate: (id: string) => void; entities?: Array<{ id: string; name: string; kind: string }>; relationKinds?: string[] }) {
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({ kind: "", name: "", description: "" });
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [tick, setTick] = useState(0);
  const [rel, setRel] = useState<{ direction: "out" | "in"; kind: string; target: string }>({ direction: "out", kind: "", target: "" });
  const [relError, setRelError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetch(`/api/graph/entities/${entityId}`)
      .then((r) => (r.ok ? (r.json() as Promise<EntityDetail>) : null))
      .then((d) => {
        if (cancelled) return;
        if (!d) { setError("This entity no longer exists."); return; }
        setDetail(d);
        setDraft({ kind: d.entity.kind, name: d.entity.name, description: d.entity.description });
        setError(null);
      })
      .catch(() => !cancelled && setError("Could not load the entity."));
    return () => { cancelled = true; };
  }, [entityId, tick]);

  useEffect(() => {
    if (!entityId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entityId, onClose]);

  if (!entityId) return null;
  const refresh = () => setTick((t) => t + 1);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); refresh(); });
  const e = detail?.entity;
  const attrs = e?.attributes ?? {};
  const suggestions = (detail?.kindAttributeKeys ?? []).filter((k) => !(k in attrs));

  return (
    <div className="modal-backdrop" onMouseDown={onClose} data-entity-drawer>
      <aside className="entity-drawer fade-in" onMouseDown={(ev) => ev.stopPropagation()} role="dialog" aria-modal aria-label="Entity details">
        <header>
          <span className="board-glyph" style={{ background: kindColor(e?.kind ?? "") + "22", color: kindColor(e?.kind ?? "") }}>■</span>
          <div>
            <small>{e?.kind || "Untyped"}</small>
            <h2>{e?.name || (error ? "Not found" : "Loading…")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {error && <p className="form-error">{error}</p>}
        {e && (
          <div className="entity-drawer-body">
            <form className="entity-drawer-form" onSubmit={(ev) => { ev.preventDefault(); run(() => updateEntity(e.id, draft)); }}>
              <label><span>Kind</span><input value={draft.kind} onChange={(ev) => setDraft({ ...draft, kind: ev.target.value })} /></label>
              <label><span>Name</span><input value={draft.name} onChange={(ev) => setDraft({ ...draft, name: ev.target.value })} /></label>
              <label className="wide"><span>Description</span><textarea rows={2} value={draft.description} onChange={(ev) => setDraft({ ...draft, description: ev.target.value })} /></label>
              {(draft.kind !== e.kind || draft.name !== e.name || draft.description !== e.description) && <button type="submit" className="primary-home-button" disabled={pending}>Save changes</button>}
            </form>

            <div className="attributes-editor">
              <span>Attributes {Object.keys(attrs).length > 0 && <small>{Object.keys(attrs).length}</small>}</span>
              {Object.entries(attrs).map(([k, v]) => (
                <div key={k} className={attributeIsRisk(k, v) ? "attribute-row risk" : "attribute-row"}>
                  <b title={k}>{k}</b>
                  <input defaultValue={v} aria-label={`${k} value`} onBlur={(ev) => { if (ev.target.value !== v) run(() => setEntityAttributeAction(e.id, k, ev.target.value)); }} onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
                  <button type="button" onClick={() => run(() => setEntityAttributeAction(e.id, k, ""))} aria-label={`Remove ${k}`}>×</button>
                </div>
              ))}
              <div className="attribute-row add">
                <input value={newKey} onChange={(ev) => setNewKey(ev.target.value)} placeholder="key" aria-label="New attribute key" list="drawer-attr-keys" />
                <datalist id="drawer-attr-keys">{suggestions.map((k) => <option key={k} value={k} />)}</datalist>
                <input value={newValue} onChange={(ev) => setNewValue(ev.target.value)} placeholder="value" aria-label="New attribute value" onKeyDown={(ev) => { if (ev.key === "Enter" && newKey.trim()) { ev.preventDefault(); run(() => setEntityAttributeAction(e.id, newKey, newValue)); setNewKey(""); setNewValue(""); } }} />
                <button type="button" disabled={!newKey.trim() || pending} aria-label="Add attribute" onClick={() => { run(() => setEntityAttributeAction(e.id, newKey, newValue)); setNewKey(""); setNewValue(""); }}>+</button>
              </div>
              {suggestions.length > 0 && (
                <div className="attribute-suggest">
                  {suggestions.map((k) => <button key={k} type="button" onClick={() => setNewKey(k)}>{k}</button>)}
                </div>
              )}
            </div>

            <section className="entity-drawer-section" data-drawer-relations>
              <span>Relations <small>{detail!.relations.length}</small></span>
              {detail!.relations.length === 0 && <p className="muted">No relations yet. Add one below, connect cards on a board, or import a relations CSV.</p>}
              <ul>
                {detail!.relations.map((r) => (
                  <li key={r.id}>
                    {r.direction === "out" ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
                    <b>{r.kind || "(unlabelled)"}</b>
                    <button type="button" onClick={() => onNavigate(r.other.id)} title="Open this entity">{r.other.name}<small> · {r.other.kind || "Untyped"}</small></button>
                    <button type="button" className="entity-drawer-remove" aria-label="Delete relation" title="Delete this relation (also removes it from boards)" disabled={pending} onClick={() => run(() => deleteRelationAction(workspaceId, r.id))}>×</button>
                  </li>
                ))}
              </ul>
              <form
                className="entity-drawer-addrel"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const target = entities.find((x) => x.name.toLowerCase() === rel.target.trim().toLowerCase() || `${x.kind}: ${x.name}`.toLowerCase() === rel.target.trim().toLowerCase());
                  if (!target) { setRelError(`No entity called “${rel.target.trim()}”`); return; }
                  setRelError(null);
                  const [from, to] = rel.direction === "out" ? [e.id, target.id] : [target.id, e.id];
                  start(async () => {
                    const r = await createRelationAction(workspaceId, from, rel.kind, to);
                    if ("error" in r) setRelError(r.error);
                    else { setRel({ direction: rel.direction, kind: "", target: "" }); refresh(); }
                  });
                }}
              >
                <select value={rel.direction} onChange={(ev) => setRel({ ...rel, direction: ev.target.value as "out" | "in" })} aria-label="Direction">
                  <option value="out">this →</option>
                  <option value="in">→ this</option>
                </select>
                <input value={rel.kind} onChange={(ev) => setRel({ ...rel, kind: ev.target.value })} placeholder="relation, e.g. depends on" list="drawer-rel-kinds" aria-label="Relation type" />
                <datalist id="drawer-rel-kinds">{relationKinds.map((k) => <option key={k} value={k} />)}</datalist>
                <input value={rel.target} onChange={(ev) => setRel({ ...rel, target: ev.target.value })} placeholder="other entity" list="drawer-rel-targets" aria-label="Other entity" required />
                <datalist id="drawer-rel-targets">{entities.filter((x) => x.id !== e.id).slice(0, 400).map((x) => <option key={x.id} value={x.name}>{x.kind}</option>)}</datalist>
                <button type="submit" className="ghost-button" disabled={pending || !rel.target.trim()} aria-label="Add relation"><Plus size={14} /></button>
              </form>
              {relError && <p className="form-error" style={{ margin: 0 }}>{relError}</p>}
            </section>

            <section className="entity-drawer-section">
              <span>Boards <small>{detail!.boards.length}</small></span>
              {detail!.boards.length === 0 && <p className="muted">Not on any board. Place it from a board&apos;s Graph inventory.</p>}
              <ul>
                {detail!.boards.map((b) => <li key={b.id}><Link href={`/b/${b.id}`}>{b.name}</Link><small> · {b.spaceName}</small></li>)}
              </ul>
            </section>

            {detail!.duplicates.length > 0 && (
              <section className="entity-drawer-section warn">
                <span>Possible duplicates <small>{detail!.duplicates.length}</small></span>
                <ul>
                  {detail!.duplicates.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => onNavigate(d.id)}>{d.name}<small> · {d.kind || "Untyped"}</small></button>
                      <button type="button" className="entity-drawer-merge" disabled={pending} onClick={() => { if (confirm(`Merge "${d.name}" into "${e.name}"? Its relations and cards move here.`)) run(() => mergeEntitiesAction(workspaceId, e.id, [d.id])); }}><GitMerge size={12} /> Merge into this</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer>
              <small>Source {e.source} · updated {new Date(e.updatedAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
              <button type="button" className="ghost-button danger" disabled={pending} onClick={() => { if (confirm(`Delete "${e.name}" from the graph? Cards on boards keep their text but lose the link.`)) start(async () => { await deleteEntity(e.id); onClose(); }); }}><Trash2 size={14} /> Delete</button>
            </footer>
          </div>
        )}
      </aside>
    </div>
  );
}
