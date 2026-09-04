"use client";

import { AlignCenter, AlignLeft, AlignRight, ArrowLeftRight, ArrowRight, BringToFront, Circle, Copy, Diamond, Lock, Minus, Plus, SendToBack, Square, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import type { CanvasElement, ConnectorElement, ElementId } from "./document";
import { FRAME_COLORS, SHAPE_FILLS, STICKY_COLORS, STROKE_COLORS } from "./document";
import { boxToScreen, clamp } from "./geometry";
import { selectionBounds, useCanvas, useCanvasStore } from "./store";

/** Floating property bar positioned above the current selection (screen space). */
export function SelectionToolbar() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const camera = useCanvas((s) => s.camera);
  const viewport = useCanvas((s) => s.viewport);
  const editingId = useCanvas((s) => s.editingId);
  const marquee = useCanvas((s) => s.marquee);

  if (selection.length === 0 || editingId || marquee) return null;
  const bounds = selectionBounds(selection, elements);
  if (!bounds) return null;
  const sb = boxToScreen(bounds, camera);
  const items = selection.map((id) => elements[id]).filter((e): e is CanvasElement => !!e);
  const types = new Set(items.map((i) => i.type));
  const onlyType = types.size === 1 ? [...types][0] : null;
  const allLocked = items.every((i) => i.locked);

  const patchAll = (fn: (el: CanvasElement) => Partial<CanvasElement> | null) => {
    const patch: Record<ElementId, Partial<CanvasElement>> = {};
    for (const el of items) {
      const p = fn(el);
      if (p) patch[el.id] = p;
    }
    store.getState().updateElements(patch, { history: true });
  };

  const width = 420;
  const left = clamp(sb.x + sb.w / 2 - width / 2, 8, Math.max(8, viewport.w - width - 8));
  const above = sb.y - 56;
  const top = above > 64 ? above : Math.min(sb.y + sb.h + 12, viewport.h - 56);

  return (
    <div className="fade-in absolute z-20 flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1 shadow-float" style={{ left, top, width, pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {onlyType === "sticky" && <Swatches colors={STICKY_COLORS} current={items[0]!.type === "sticky" ? items[0]!.color : ""} onPick={(c) => patchAll(() => ({ color: c }))} />}
      {onlyType === "frame" && <Swatches colors={FRAME_COLORS} current={items[0]!.type === "frame" ? items[0]!.color : ""} onPick={(c) => patchAll(() => ({ color: c }))} />}
      {onlyType === "shape" && (
        <>
          <Swatches colors={SHAPE_FILLS} current={items[0]!.type === "shape" ? items[0]!.fill : ""} onPick={(c) => patchAll(() => ({ fill: c }))} bordered />
          <Divider />
          <IconButton title="Rectangle" active={items.every((i) => i.type === "shape" && i.shape === "rect")} onClick={() => patchAll(() => ({ shape: "rect" }))}><Square size={14} /></IconButton>
          <IconButton title="Ellipse" active={items.every((i) => i.type === "shape" && i.shape === "ellipse")} onClick={() => patchAll(() => ({ shape: "ellipse" }))}><Circle size={14} /></IconButton>
          <IconButton title="Diamond" active={items.every((i) => i.type === "shape" && i.shape === "diamond")} onClick={() => patchAll(() => ({ shape: "diamond" }))}><Diamond size={14} /></IconButton>
        </>
      )}
      {onlyType === "text" && (
        <>
          <IconButton title="Smaller" onClick={() => patchAll((el) => (el.type === "text" ? { fontSize: Math.max(10, el.fontSize - 2) } : null))}><Minus size={14} /></IconButton>
          <span className="w-8 text-center text-xs tabular-nums text-ink-700">{items[0]!.type === "text" ? items[0]!.fontSize : ""}</span>
          <IconButton title="Larger" onClick={() => patchAll((el) => (el.type === "text" ? { fontSize: Math.min(120, el.fontSize + 2) } : null))}><Plus size={14} /></IconButton>
          <Divider />
          <IconButton title="Align left" active={items.every((i) => i.type === "text" && i.align === "left")} onClick={() => patchAll(() => ({ align: "left" }))}><AlignLeft size={14} /></IconButton>
          <IconButton title="Align centre" active={items.every((i) => i.type === "text" && i.align === "center")} onClick={() => patchAll(() => ({ align: "center" }))}><AlignCenter size={14} /></IconButton>
          <IconButton title="Align right" active={items.every((i) => i.type === "text" && i.align === "right")} onClick={() => patchAll(() => ({ align: "right" }))}><AlignRight size={14} /></IconButton>
        </>
      )}
      {onlyType === "connector" && <ConnectorControls items={items as ConnectorElement[]} patchAll={patchAll} />}

      {onlyType && <Divider />}
      <div className="ml-auto flex items-center gap-0.5">
        <IconButton title="Bring to front  ⌘]" onClick={() => store.getState().bringToFront(selection)}><BringToFront size={14} /></IconButton>
        <IconButton title="Send to back  ⌘[" onClick={() => store.getState().sendToBack(selection)}><SendToBack size={14} /></IconButton>
        <IconButton title="Duplicate  ⌘D" onClick={() => store.getState().duplicateSelection()}><Copy size={14} /></IconButton>
        <IconButton title={allLocked ? "Unlock" : "Lock"} active={allLocked} onClick={() => patchAll(() => ({ locked: !allLocked }))}>{allLocked ? <Lock size={14} /> : <Unlock size={14} />}</IconButton>
        <IconButton title="Delete  ⌫" danger onClick={() => store.getState().deleteElements(selection)}><Trash2 size={14} /></IconButton>
      </div>
    </div>
  );
}

function ConnectorControls({ items, patchAll }: { items: ConnectorElement[]; patchAll: (fn: (el: CanvasElement) => Partial<CanvasElement> | null) => void }) {
  const first = items[0]!;
  const [label, setLabel] = useState(first.label);
  return (
    <>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => patchAll(() => ({ label }))}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="Label"
        className="h-7 w-28 rounded border border-ink-200 px-2 text-xs outline-none focus:border-accent-500"
      />
      <Divider />
      <Swatches colors={STROKE_COLORS} current={first.stroke} onPick={(c) => patchAll(() => ({ stroke: c }))} />
      <Divider />
      <IconButton title="Solid / dashed" active={first.style === "dashed"} onClick={() => patchAll((el) => (el.type === "connector" ? { style: el.style === "dashed" ? "solid" : "dashed" } : null))}><span className="block h-0 w-4 border-t-2 border-dashed border-current" /></IconButton>
      <IconButton title="Arrow at end" active={first.arrowEnd} onClick={() => patchAll((el) => (el.type === "connector" ? { arrowEnd: !el.arrowEnd } : null))}><ArrowRight size={14} /></IconButton>
      <IconButton title="Arrows both ways" active={first.arrowStart} onClick={() => patchAll((el) => (el.type === "connector" ? { arrowStart: !el.arrowStart } : null))}><ArrowLeftRight size={14} /></IconButton>
    </>
  );
}

function Swatches({ colors, current, onPick, bordered }: { colors: readonly string[]; current: string; onPick: (c: string) => void; bordered?: boolean }) {
  return (
    <div className="flex items-center gap-1 px-1">
      {colors.map((c) => (
        <button key={c} title={c} onClick={() => onPick(c)} className={`h-5 w-5 rounded-full ring-offset-1 transition-transform hover:scale-110 ${current === c ? "ring-2 ring-ink-900" : bordered ? "ring-1 ring-ink-300" : ""}`} style={{ background: c }} />
      ))}
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-ink-200" />;
}

export function IconButton({ children, title, onClick, active, danger }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${active ? "bg-accent-100 text-accent-700" : danger ? "text-ink-500 hover:bg-red-50 hover:text-red-600" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"}`}>
      {children}
    </button>
  );
}
