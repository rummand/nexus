"use client";

import { useRef } from "react";
import { isBoxElement } from "./document";
import { contentBounds, unionBoxes, visibleWorldRect } from "./geometry";
import { useCanvas, useCanvasStore } from "./store";
import { documentStats } from "@/components/workspace/BoardThumbnail";

const W = 182;
const H = 100;

/** "Map overview" card: minimap with a draggable viewport, readout and fit button. */
export function MapCard() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const camera = useCanvas((s) => s.camera);
  const viewport = useCanvas((s) => s.viewport);
  const selection = useCanvas((s) => s.selection);
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
  const coverage = content ? Math.min(100, Math.round(((vis.w * vis.h) / Math.max(1, (content.w + 1) * (content.h + 1))) * 100)) : 100;
  const stats = documentStats({ version: 2, elements });

  const navigate = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    store.getState().centerOn({ x: world.x + (mx - ox) / scale, y: world.y + (my - oy) / scale });
  };

  const v = toMini(vis.x, vis.y);
  return (
    <section className="floating-panel map-card" aria-label="Map overview" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <strong className="map-title">Map overview</strong>
      <svg
        className="mini-map"
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); navigate(e); }}
        onPointerMove={(e) => dragging.current && navigate(e)}
        onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
      >
        {Object.values(elements).map((el) => {
          if (!isBoxElement(el)) return null;
          const p = toMini(el.x, el.y);
          const fill = el.type === "card" ? el.color : el.type === "sticky" ? el.color : el.type === "frame" ? el.color + "22" : el.type === "text" ? el.color : "#94a3b8";
          const selected = selection.includes(el.id);
          return <rect key={el.id} x={p.x} y={p.y} width={Math.max(2, el.w * scale)} height={Math.max(1.5, el.h * scale)} fill={fill} stroke={selected ? "#1376d4" : el.type === "frame" ? el.color : undefined} strokeWidth={selected ? 1.5 : 0.75} rx={1} />;
        })}
        <rect x={v.x} y={v.y} width={vis.w * scale} height={vis.h * scale} fill="rgb(19 118 212 / 0.08)" stroke="#1376d4" strokeWidth={1.5} rx={2} style={{ cursor: "grab" }} />
      </svg>
      <div className="map-readout" aria-label="Map overview status">
        <span>{stats.cards} cards · {stats.notes} notes · {stats.frames} frames</span>
        <span>{stats.connectors} links · {Math.round(camera.zoom * 100)}% zoom · {coverage}% view</span>
      </div>
      <button className="map-fit-button" type="button" onClick={() => store.getState().zoomToFit()}>Fit visible board</button>
      {selection.length > 0 && <button className="map-fit-button secondary" type="button" onClick={() => store.getState().zoomToSelection()}>Fit selection</button>}
    </section>
  );
}
