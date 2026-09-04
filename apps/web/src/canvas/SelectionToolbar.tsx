"use client";

import { AlignEndHorizontal, ArrowLeftRight, ArrowRight, BringToFront, Circle, Copy, Diamond, Lock, Network, SendToBack, Square, Trash2, Unlock } from "lucide-react";
import { useGraphActions } from "./hooks/useGraphActions";
import { useState } from "react";
import type { CanvasElement, ConnectorElement, ElementId } from "./document";
import { CARD_KINDS, FRAME_COLORS, NOTE_COLORS, SHAPE_FILLS, STROKE_COLORS, TEXT_COLORS } from "./document";
import { boxToScreen, clamp } from "./geometry";
import { selectionBounds, useCanvas, useCanvasStore } from "./store";

/** Floating property bar above the selection (LeanFlow "shape inspector bar"). */
export function SelectionToolbar() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const camera = useCanvas((s) => s.camera);
  const viewport = useCanvas((s) => s.viewport);
  const editingId = useCanvas((s) => s.editingId);
  const marquee = useCanvas((s) => s.marquee);
  const dragging = useCanvas((s) => s.isDragging);
  const { busy, expandSelection } = useGraphActions();

  if (selection.length === 0 || editingId || marquee || dragging) return null;
  const bounds = selectionBounds(selection, elements);
  if (!bounds) return null;
  const sb = boxToScreen(bounds, camera);
  const items = selection.map((id) => elements[id]).filter((e): e is CanvasElement => !!e);
  const types = new Set(items.map((i) => i.type));
  const only = types.size === 1 ? [...types][0] : null;
  const allLocked = items.every((i) => i.locked);
  const first = items[0]!;

  const patchAll = (fn: (el: CanvasElement) => Partial<CanvasElement> | null) => {
    const patch: Record<ElementId, Partial<CanvasElement>> = {};
    for (const el of items) {
      const p = fn(el);
      if (p) patch[el.id] = p;
    }
    store.getState().updateElements(patch, { history: true });
  };

  const width = 560;
  const left = clamp(sb.x + sb.w / 2 - width / 2, 8, Math.max(8, viewport.w - width - 8));
  const above = sb.y - 64;
  const top = above > 80 ? above : Math.min(sb.y + sb.h + 14, viewport.h - 70);

  return (
    <div className="shape-inspector-bar fade-in" style={{ left, top, width }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {only === "card" && (
        <div className="shape-inspector-group">
          <button type="button" title="Place this card's graph neighbours around it" disabled={busy} onClick={() => void expandSelection(1, "both")}><Network size={12} /> Expand</button>
        </div>
      )}
      {only === "card" && (
        <div className="shape-inspector-group colors" title="Kind">
          {CARD_KINDS.map((k) => (
            <button key={k.kind} type="button" className={first.type === "card" && first.kind === k.kind ? "swatch active" : "swatch"} style={{ background: k.color }} title={k.kind} onClick={() => patchAll(() => ({ kind: k.kind, color: k.color }))} />
          ))}
        </div>
      )}
      {only === "sticky" && <Swatches colors={NOTE_COLORS} current={first.type === "sticky" ? first.color : ""} onPick={(c) => patchAll(() => ({ color: c }))} />}
      {only === "frame" && <Swatches colors={FRAME_COLORS} current={first.type === "frame" ? first.color : ""} onPick={(c) => patchAll(() => ({ color: c }))} />}
      {only === "text" && (
        <>
          <Swatches colors={TEXT_COLORS} current={first.type === "text" ? first.color : ""} onPick={(c) => patchAll(() => ({ color: c }))} />
          <span className="shape-inspector-divider" />
          <div className="shape-inspector-group">
            <button type="button" className={items.every((i) => i.type === "text" && i.variant === "text") ? "active" : ""} onClick={() => patchAll(() => ({ variant: "text" }))}>Text</button>
            <button type="button" className={items.every((i) => i.type === "text" && i.variant === "section") ? "active" : ""} onClick={() => patchAll(() => ({ variant: "section" }))}>Section</button>
          </div>
        </>
      )}
      {only === "shape" && (
        <>
          <Swatches colors={SHAPE_FILLS} current={first.type === "shape" ? first.fill : ""} onPick={(c) => patchAll(() => ({ fill: c }))} bordered />
          <span className="shape-inspector-divider" />
          <div className="shape-inspector-group">
            <button type="button" className={items.every((i) => i.type === "shape" && i.shape === "rect") ? "active" : ""} onClick={() => patchAll(() => ({ shape: "rect" }))}><Square size={12} /> Rectangle</button>
            <button type="button" className={items.every((i) => i.type === "shape" && i.shape === "ellipse") ? "active" : ""} onClick={() => patchAll(() => ({ shape: "ellipse" }))}><Circle size={12} /> Oval</button>
            <button type="button" className={items.every((i) => i.type === "shape" && i.shape === "diamond") ? "active" : ""} onClick={() => patchAll(() => ({ shape: "diamond" }))}><Diamond size={12} /> Rhombus</button>
          </div>
        </>
      )}
      {only === "connector" && <ConnectorControls key={`${first.id}:${(first as ConnectorElement).label}`} items={items as ConnectorElement[]} patchAll={patchAll} />}

      {only && <span className="shape-inspector-divider" />}
      <div className="shape-inspector-group" style={{ marginLeft: "auto" }}>
        <button type="button" title="Bring to front  ⌘]" onClick={() => store.getState().bringToFront(selection)}><BringToFront size={12} /> Front</button>
        <button type="button" title="Send to back  ⌘[" onClick={() => store.getState().sendToBack(selection)}><SendToBack size={12} /> Back</button>
        <button type="button" title="Duplicate  ⌘D" onClick={() => store.getState().duplicateSelection()}><Copy size={12} /></button>
        <button type="button" title={allLocked ? "Unlock" : "Lock"} className={allLocked ? "active" : ""} onClick={() => patchAll(() => ({ locked: !allLocked }))}>{allLocked ? <Lock size={12} /> : <Unlock size={12} />}</button>
        <button type="button" title="Delete  ⌫" className="danger" onClick={() => store.getState().deleteElements(selection)}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function ConnectorControls({ items, patchAll }: { items: ConnectorElement[]; patchAll: (fn: (el: CanvasElement) => Partial<CanvasElement> | null) => void }) {
  const first = items[0]!;
  const [label, setLabel] = useState(first.label);
  return (
    <>
      <div className="shape-inspector-group">
        <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => patchAll(() => ({ label }))} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} placeholder="Relation label" />
      </div>
      <Swatches colors={STROKE_COLORS} current={first.stroke} onPick={(c) => patchAll(() => ({ stroke: c }))} />
      <span className="shape-inspector-divider" />
      <div className="shape-inspector-group">
        <button type="button" className={first.style === "dashed" ? "active" : ""} onClick={() => patchAll((el) => (el.type === "connector" ? { style: el.style === "dashed" ? "solid" : "dashed" } : null))}><AlignEndHorizontal size={12} /> Dashed</button>
        <button type="button" className={first.arrowEnd ? "active" : ""} onClick={() => patchAll((el) => (el.type === "connector" ? { arrowEnd: !el.arrowEnd } : null))}><ArrowRight size={12} /> Arrow</button>
        <button type="button" className={first.arrowStart ? "active" : ""} onClick={() => patchAll((el) => (el.type === "connector" ? { arrowStart: !el.arrowStart } : null))}><ArrowLeftRight size={12} /> Both</button>
      </div>
    </>
  );
}

function Swatches({ colors, current, onPick, bordered }: { colors: readonly string[]; current: string; onPick: (c: string) => void; bordered?: boolean }) {
  return (
    <div className="shape-inspector-group colors">
      {colors.map((c) => (
        <button key={c} type="button" title={c} className={current === c ? "swatch active" : "swatch"} style={{ background: c, borderColor: bordered ? "#cbd5e1" : c }} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}
