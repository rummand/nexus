"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { isBoxElement } from "./document";
import { boxToScreen, elementBounds, HANDLES, handleCursor, handlePoint, worldToScreen, type HandleId } from "./geometry";
import { selectionBounds, useCanvas } from "./store";

const HANDLE = 9;

/** Screen-space selection outlines, resize handles, hover outline and marquee. */
export function SelectionOverlay({ onBeginResize }: { onBeginResize: (id: string, handle: HandleId, e: ReactPointerEvent) => void }) {
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const hoverId = useCanvas((s) => s.hoverId);
  const camera = useCanvas((s) => s.camera);
  const marquee = useCanvas((s) => s.marquee);
  const editingId = useCanvas((s) => s.editingId);
  const tool = useCanvas((s) => s.tool);
  const pending = useCanvas((s) => s.pendingConnector);

  const single = selection.length === 1 ? elements[selection[0]!] : undefined;
  const bounds = selection.length > 1 ? selectionBounds(selection, elements) : null;
  const hover = hoverId && !selection.includes(hoverId) ? elements[hoverId] : undefined;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
      {/* hover */}
      {hover && (() => {
        const b = elementBounds(hover, elements);
        if (!b) return null;
        const sb = boxToScreen(b, camera);
        const connectTarget = tool === "connector" || pending;
        return <div className="absolute rounded-sm" style={{ left: sb.x - 2, top: sb.y - 2, width: sb.w + 4, height: sb.h + 4, border: `${connectTarget ? 2 : 1.5}px solid ${connectTarget ? "#4f46e5" : "#818cf8"}`, background: connectTarget ? "rgb(79 70 229 / 0.08)" : undefined }} />;
      })()}

      {/* per-element outlines */}
      {selection.map((id) => {
        const el = elements[id];
        if (!el) return null;
        const b = elementBounds(el, elements);
        if (!b) return null;
        const sb = boxToScreen(b, camera);
        const isEditing = editingId === id;
        return <div key={id} className="absolute" style={{ left: sb.x - 1, top: sb.y - 1, width: sb.w + 2, height: sb.h + 2, border: `${isEditing ? 2 : 1.5}px solid #4f46e5`, borderRadius: 3 }} />;
      })}

      {/* group bounds */}
      {bounds && (() => {
        const sb = boxToScreen(bounds, camera);
        return <div className="absolute" style={{ left: sb.x - 4, top: sb.y - 4, width: sb.w + 8, height: sb.h + 8, border: "1px dashed #4f46e5", borderRadius: 4 }} />;
      })()}

      {/* resize handles for a single box element */}
      {single && isBoxElement(single) && !single.locked && editingId !== single.id &&
        HANDLES.map((h) => {
          const p = worldToScreen(handlePoint(single, h), camera);
          return (
            <div
              key={h}
              onPointerDown={(e) => onBeginResize(single.id, h, e)}
              className="pointer-events-auto absolute rounded-[2px] border border-accent-600 bg-white shadow-sm"
              style={{ left: p.x - HANDLE / 2, top: p.y - HANDLE / 2, width: HANDLE, height: HANDLE, cursor: handleCursor(h) }}
            />
          );
        })}

      {/* marquee */}
      {marquee && (() => {
        const sb = boxToScreen(marquee, camera);
        return <div className="absolute rounded-sm" style={{ left: sb.x, top: sb.y, width: sb.w, height: sb.h, border: "1px solid #4f46e5", background: "rgb(79 70 229 / 0.08)" }} />;
      })()}
    </div>
  );
}
