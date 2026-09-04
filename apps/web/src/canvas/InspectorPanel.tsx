"use client";

import { type RefObject } from "react";
import { Filter } from "lucide-react";
import { elementName, elementTypeLabel, isBoxElement, type CanvasElement, type ElementId } from "./document";
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
          <div className="detail-grid">
            {single.type === "card" && (
              <>
                <div><span>Kind</span><input value={single.kind} onChange={(e) => patch({ kind: e.target.value })} placeholder="e.g. Application" /></div>
                <div><span>Title</span><input value={single.title} onChange={(e) => patch({ title: e.target.value })} /></div>
                <div><span>Description</span><textarea value={single.description} onChange={(e) => patch({ description: e.target.value })} /></div>
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
