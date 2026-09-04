"use client";

import { useRef } from "react";
import { isBoxElement } from "./document";
import { contentBounds, unionBoxes, visibleWorldRect } from "./geometry";
import { useCanvas, useCanvasStore } from "./store";

const W = 220;
const H = 140;

/** Overview of the whole board with a draggable viewport rectangle. */
export function Minimap() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const camera = useCanvas((s) => s.camera);
  const viewport = useCanvas((s) => s.viewport);
  const dragging = useRef(false);

  const vis = visibleWorldRect(camera, viewport.w, viewport.h);
  const content = contentBounds(elements);
  const all = unionBoxes(content ? [content, vis] : [vis])!;
  const pad = Math.max(all.w, all.h) * 0.05;
  const world = { x: all.x - pad, y: all.y - pad, w: all.w + pad * 2, h: all.h + pad * 2 };
  const scale = Math.min(W / world.w, H / world.h);
  const ox = (W - world.w * scale) / 2;
  const oy = (H - world.h * scale) / 2;
  const toMini = (x: number, y: number) => ({ x: ox + (x - world.x) * scale, y: oy + (y - world.y) * scale });

  const navigate = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    store.getState().centerOn({ x: world.x + (mx - ox) / scale, y: world.y + (my - oy) / scale });
  };

  const v = toMini(vis.x, vis.y);
  return (
    <div className="absolute bottom-16 right-4 z-20 overflow-hidden rounded-lg border border-ink-200 bg-white/95 shadow-float backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
      <svg
        width={W}
        height={H}
        className="block cursor-crosshair"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          navigate(e);
        }}
        onPointerMove={(e) => dragging.current && navigate(e)}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        {Object.values(elements).map((el) => {
          if (!isBoxElement(el)) return null;
          const p = toMini(el.x, el.y);
          const fill = el.type === "sticky" ? el.color : el.type === "frame" ? el.color + "33" : el.type === "shape" ? "#94a3b8" : "#cbd5e1";
          return <rect key={el.id} x={p.x} y={p.y} width={Math.max(1.5, el.w * scale)} height={Math.max(1.5, el.h * scale)} fill={fill} stroke={el.type === "frame" ? el.color : undefined} strokeWidth={0.75} rx={1} />;
        })}
        <rect x={v.x} y={v.y} width={vis.w * scale} height={vis.h * scale} fill="rgb(79 70 229 / 0.10)" stroke="#4f46e5" strokeWidth={1.25} rx={2} />
      </svg>
    </div>
  );
}
