"use client";

import { useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import type { EntityDetail } from "@/lib/graph-types";
import { isEntityId } from "@/lib/graph-types";
import { mergeEntitiesAction } from "@/lib/actions";
import { ProposalsBlock } from "./ProposalsBlock";
import { AskBlock } from "./AskBlock";
import { Filter } from "lucide-react";
import { attributeIsRisk, elementName, elementTypeLabel, isBoxElement, type CanvasElement, type CardElement, type ElementId } from "./document";
import { useDraggablePanel } from "./hooks/useDraggablePanel";
import { selectionBounds, useCanvas, useCanvasStore } from "./store";
import { documentStats } from "@/components/workspace/BoardThumbnail";

/** Draggable "Selection" inspector (LeanFlow "Impact selection" pattern). */
export function InspectorPanel({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const collapsed = useCanvas((s) => !s.panels.inspector);
  const { pos, onPointerDown, panelRef } = useDraggablePanel(rootRef, { right: 12, y: 76 });

  const items = selection.map((id) => elements[id]).filter((e): e is CanvasElement => !!e);
  const single = items.length === 1 ? items[0] : null;
  const stats = documentStats({ version: 2, elements });

  const connectionsOf = (id: ElementId) => Object.values(elements).filter((e) => e.type === "connector" && (("elementId" in e.from && e.from.elementId === id) || ("elementId" in e.to && e.to.elementId === id))).length;

  const patch = (p: Partial<CanvasElement>) => single && store.getState().updateElements({ [single.id]: p }, { history: true });
  const entityId = single?.type === "card" && isEntityId(single.meta?.entityId) ? single.meta.entityId : null;
  /**
   * A card placed from a change set has an entity id but no entity: it is a drawing of an
   * intention (§5.21). Asking the graph about it would 404, and inviting a merge or a rename of
   * something that does not exist would be worse than the 404.
   */
  const planned = single?.type === "card" ? Boolean(single.meta?.planned) : false;

  return (
    <section
      ref={(el) => { panelRef.current = el; }}
      className={collapsed ? "floating-panel inspector-panel collapsed" : "floating-panel inspector-panel"}
      aria-label="Selection inspector"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 76 }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="panel-title" onPointerDown={onPointerDown} title="Drag to move">
        <Filter size={18} />
        Selection
        <div className="panel-title-actions">
          <button type="button" onClick={() => store.getState().togglePanel("inspector")}>{collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>

      {collapsed ? (
        <div className="inspector-summary">
          <strong>{single ? elementName(single) : items.length > 1 ? `${items.length} objects` : "Nothing selected"}</strong>
          <small>{single ? elementTypeLabel(single) : `${stats.total} objects on this board`}</small>
        </div>
      ) : single ? (
        <>
          <h2>{elementName(single)}</h2>
          <p>{elementTypeLabel(single)}{isBoxElement(single) ? ` · ${connectionsOf(single.id)} connections` : ""}{single.locked ? " · locked" : ""}</p>
          {planned && (
            <p className="inspector-planned" data-planned>
              Planned, not in the graph. This card comes from a change set; it becomes a real object when that change set is delivered.
            </p>
          )}
          <div className="detail-grid">
            {single.type === "card" && (
              <>
                <div><span>Kind</span><input value={single.kind} onChange={(e) => patch({ kind: e.target.value })} placeholder="e.g. Application" /></div>
                <div><span>Title</span><input value={single.title} onChange={(e) => patch({ title: e.target.value })} /></div>
                <div><span>Description</span><textarea value={single.description} onChange={(e) => patch({ description: e.target.value })} /></div>
                <AttributesEditor key={single.id} card={single} onChange={(attributes) => patch({ attributes })} />
              </>
            )}
            {single.type === "sticky" && (
              <>
                <div><span>Title</span><input value={single.title} onChange={(e) => patch({ title: e.target.value })} /></div>
                <div><span>Note</span><textarea value={single.text} onChange={(e) => patch({ text: e.target.value })} /></div>
              </>
            )}
            {single.type === "text" && (
              <>
                <div><span>Title</span><input value={single.title} onChange={(e) => patch({ title: e.target.value })} /></div>
                <div><span>Body</span><textarea value={single.text} onChange={(e) => patch({ text: e.target.value })} /></div>
              </>
            )}
            {single.type === "frame" && <div><span>Title</span><input value={single.title} onChange={(e) => patch({ title: e.target.value })} /></div>}
            {single.type === "shape" && <div><span>Label</span><input value={single.text} onChange={(e) => patch({ text: e.target.value })} /></div>}
            {single.type === "connector" && (
              <>
                <div><span>Label</span><input value={single.label} onChange={(e) => patch({ label: e.target.value })} /></div>
                <div><span>From → To</span><strong>{"elementId" in single.from ? elementName(elements[single.from.elementId] ?? single) : "free point"} → {"elementId" in single.to ? elementName(elements[single.to.elementId] ?? single) : "free point"}</strong></div>
              </>
            )}
            {isBoxElement(single) && (
              <div className="detail-grid two" style={{ margin: 0, padding: 0, background: "transparent", border: 0 }}>
                <div><span>Position</span><strong>{Math.round(single.x)}, {Math.round(single.y)}</strong></div>
                <div><span>Size</span><strong>{Math.round(single.w)} × {Math.round(single.h)}</strong></div>
              </div>
            )}
          </div>
          {entityId && !planned && <GraphBlock key={entityId} entityId={entityId} boardId={store.getState().boardId} />}
          {entityId && !planned && <ProposalsBlock key={`p-${entityId}`} entityId={entityId} />}
          {isBoxElement(single) && single.type !== "agent" && <AskBlock key={`a-${single.id}`} ids={[single.id]} label="this" />}
          <div className="inspector-actions">
            <button type="button" onClick={() => store.getState().focusElement(single.id)}>Focus</button>
            <button type="button" onClick={() => store.getState().duplicateSelection()}>Duplicate</button>
            <button type="button" onClick={() => store.getState().bringToFront([single.id])}>To front</button>
            <button type="button" onClick={() => patch({ locked: !single.locked })}>{single.locked ? "Unlock" : "Lock"}</button>
            <button type="button" className="danger" onClick={() => store.getState().deleteElements([single.id])}>Delete</button>
          </div>
        </>
      ) : items.length > 1 ? (
        <>
          <h2>{items.length} objects selected</h2>
          <p>{summarise(items)}</p>
          {(() => {
            const b = selectionBounds(selection, elements);
            return b ? (
              <div className="detail-grid two">
                <div><span>Bounds</span><strong>{Math.round(b.w)} × {Math.round(b.h)}</strong></div>
                <div><span>Origin</span><strong>{Math.round(b.x)}, {Math.round(b.y)}</strong></div>
              </div>
            ) : null;
          })()}
          <AskBlock key={`a-${selection.join(",")}`} ids={selection} label={`these ${items.length}`} />
          <div className="inspector-actions">
            <button type="button" onClick={() => store.getState().zoomToSelection()}>Focus</button>
            <button type="button" onClick={() => store.getState().duplicateSelection()}>Duplicate</button>
            <button type="button" className="danger" onClick={() => store.getState().deleteElements(selection)}>Delete</button>
          </div>
        </>
      ) : (
        <>
          <h2>Nothing selected</h2>
          <p>Click an object to inspect it. Drag to move, double-click a shape to label it, hold Shift to multi-select.</p>
          <div className="detail-grid two">
            <div><span>Cards</span><strong>{stats.cards}</strong></div>
            <div><span>Notes</span><strong>{stats.notes}</strong></div>
            <div><span>Frames</span><strong>{stats.frames}</strong></div>
            <div><span>Text</span><strong>{stats.text}</strong></div>
            <div><span>Shapes</span><strong>{stats.shapes}</strong></div>
            <div><span>Connectors</span><strong>{stats.connectors}</strong></div>
          </div>
          <div className="mode-banner">
            <span>Board mode</span>
            <strong>Freeform canvas · saved automatically</strong>
            <small>Cards are the canvas face of future graph entities. Agents will propose kinds and relations here.</small>
          </div>
        </>
      )}
    </section>
  );
}

function summarise(items: CanvasElement[]) {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(elementTypeLabel(it), (counts.get(elementTypeLabel(it)) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${n} ${k.toLowerCase()}${n === 1 ? "" : "s"}`).join(" · ");
}

/** Graph facts for an entity-backed card: where else it appears and how it is related. */
function GraphBlock({ entityId, boardId }: { entityId: string; boardId: string }) {
  const store = useCanvasStore();
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [merging, setMerging] = useState(false);

  const merge = async (otherId: string) => {
    setMerging(true);
    try {
      const s = store.getState();
      const r = await mergeEntitiesAction(s.workspaceId, entityId, [otherId]);
      // relink cards on this board that pointed at the merged entity
      const patch: Record<string, Partial<CanvasElement>> = {};
      for (const el of Object.values(s.elements)) {
        if (el.type === "card" && r.otherIds.includes(String(el.meta?.entityId))) patch[el.id] = { meta: { ...el.meta, entityId: r.survivorId } };
      }
      if (Object.keys(patch).length) s.updateElements(patch, { history: true });
      setDetail((d) => (d ? { ...d, duplicates: d.duplicates.filter((x) => x.id !== otherId) } : d));
    } finally {
      setMerging(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/graph/entities/${entityId}`)
        .then((r) => (r.ok ? (r.json() as Promise<EntityDetail>) : null))
        .then((d) => { if (cancelled) return; if (d) setDetail(d); else setMissing(true); })
        .catch(() => !cancelled && setMissing(true));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [entityId]);
  const otherBoards = detail?.boards.filter((b) => b.id !== boardId) ?? [];
  return (
    <>
      {detail && detail.duplicates.length > 0 && (
        <div className="graph-block warn">
          <span className="label">Agent proposal</span>
          <strong>Possible duplicate{detail.duplicates.length > 1 ? "s" : ""}</strong>
          <small>{detail.duplicates.map((d) => `${d.name} (${d.kind || "untyped"})`).join(", ")} share this name. Merge keeps this card&apos;s entity and relinks the others everywhere.</small>
          <div className="dupe-actions">
            {detail.duplicates.map((d) => (
              <button key={d.id} type="button" disabled={merging} onClick={() => void merge(d.id)}>Merge “{d.name}” into this</button>
            ))}
          </div>
        </div>
      )}
    <div className="graph-block">
      <span className="label">Knowledge graph</span>
      {missing && <small>Not in the graph yet — it will be indexed on the next save.</small>}
      {!detail && !missing && <small>Loading…</small>}
      {detail && (
        <>
          <strong>{detail.relations.length} relation{detail.relations.length === 1 ? "" : "s"} · on {detail.boards.length} board{detail.boards.length === 1 ? "" : "s"}</strong>
          {detail.relations.length > 0 && (
            <ul>
              {detail.relations.slice(0, 6).map((r) => (
                <li key={r.id}>{r.direction === "out" ? "→" : "←"} <b>{r.kind || "related to"}</b> {r.other.name}{r.other.kind ? ` (${r.other.kind})` : ""}</li>
              ))}
              {detail.relations.length > 6 && <li>… {detail.relations.length - 6} more</li>}
            </ul>
          )}
          {otherBoards.length > 0 && <small>Also on: {otherBoards.map((b, i) => <span key={b.id}>{i > 0 && ", "}<Link href={`/b/${b.id}`}>{b.name}</Link></span>)}</small>}
          <small>Source: {detail.entity.source} · <Link href={`/e/${detail.entity.id}`} title="Open this entity on the Knowledge graph page">Open in graph →</Link></small>
        </>
      )}
    </div>
    </>
  );
}

const COMMON_ATTRIBUTE_KEYS = ["lifecycle", "owner", "criticality", "hosting", "vendor", "cost", "data classification"];

/** Key / value attributes on a card; keys used by the same kind elsewhere are offered as suggestions. */
function AttributesEditor({ card, onChange }: { card: CardElement; onChange: (attributes: Record<string, string>) => void }) {
  const attrs = card.attributes ?? {};
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const entityId = isEntityId(card.meta?.entityId) ? card.meta.entityId : null;
  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetch(`/api/graph/entities/${entityId}`).then((r) => (r.ok ? (r.json() as Promise<EntityDetail>) : null)).then((d) => { if (!cancelled && d) setSuggested(d.kindAttributeKeys); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [entityId]);
  const options = [...new Set([...suggested, ...COMMON_ATTRIBUTE_KEYS])].filter((k) => !(k in attrs)).slice(0, 6);
  const set = (k: string, v: string) => onChange({ ...attrs, [k]: v });
  const remove = (k: string) => { const next = { ...attrs }; delete next[k]; onChange(next); };
  const add = () => {
    const k = newKey.trim();
    if (!k) return;
    onChange({ ...attrs, [k]: newValue.trim() });
    setNewKey("");
    setNewValue("");
  };
  return (
    <div className="attributes-editor">
      <span>Attributes {Object.keys(attrs).length > 0 && <small>{Object.keys(attrs).length}</small>}</span>
      {Object.entries(attrs).map(([k, v]) => (
        <div key={k} className={attributeIsRisk(k, v) ? "attribute-row risk" : "attribute-row"}>
          <b title={k}>{k}</b>
          <input value={v} onChange={(e) => set(k, e.target.value)} aria-label={`${k} value`} />
          <button type="button" onClick={() => remove(k)} aria-label={`Remove ${k}`}>×</button>
        </div>
      ))}
      <div className="attribute-row add">
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key" list={`attr-keys-${card.id}`} aria-label="New attribute key" />
        <datalist id={`attr-keys-${card.id}`}>{options.map((k) => <option key={k} value={k} />)}</datalist>
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="value" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="New attribute value" />
        <button type="button" onClick={add} disabled={!newKey.trim()} aria-label="Add attribute">+</button>
      </div>
      {options.length > 0 && (
        <div className="attribute-suggest">
          {options.map((k) => <button key={k} type="button" onClick={() => setNewKey(k)}>{k}</button>)}
        </div>
      )}
    </div>
  );
}
