"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { isBoxElement, type Box } from "./document";
import { contentBounds, unionBoxes, visibleWorldRect } from "./geometry";
import { useCanvas, useCanvasStore } from "./store";
import { documentStats } from "@/components/workspace/BoardThumbnail";

const W = 182;
const H = 100;

/**
 * "Map overview" card: minimap drawn on a <canvas> straight from the store (at most one redraw
 * per animation frame, no React re-render per pan or drag step), a readout and a fit button.
 * Click or drag on the map moves the viewport.
 */
export function MapCard() {
  const store = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<{ box: Box; scale: number; ox: number; oy: number } | null>(null);
  const dragging = useRef(false);
  // light subscriptions for the text readout only
  const zoom = useCanvas((s) => s.camera.zoom);
  const elementCount = useCanvas((s) => Object.keys(s.elements).length);
  const stats = useCanvas(useShallow((s) => documentStats({ version: 2, elements: s.elements })));
  const hasSelection = useCanvas((s) => s.selection.length > 0);
  const coverage = useCanvas((s) => {
    const vis = visibleWorldRect(s.camera, s.viewport.w, s.viewport.h);
    const content = contentBounds(s.elements);
    return content ? Math.min(100, Math.round(((vis.w * vis.h) / Math.max(1, (content.w + 1) * (content.h + 1))) * 100)) : 100;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      raf = 0;
      const s = store.getState();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const vis = visibleWorldRect(s.camera, s.viewport.w, s.viewport.h);
      const content = contentBounds(s.elements);
      const all = unionBoxes(content ? [content, vis] : [vis])!;
      const pad = Math.max(all.w, all.h) * 0.05;
      const box = { x: all.x - pad, y: all.y - pad, w: all.w + pad * 2, h: all.h + pad * 2 };
      const scale = Math.min(W / box.w, H / box.h);
      const ox = (W - box.w * scale) / 2;
      const oy = (H - box.h * scale) / 2;
      world.current = { box, scale, ox, oy };
      const sel = new Set(s.selection);
      for (const el of Object.values(s.elements)) {
        if (!isBoxElement(el)) continue;
        const x = ox + (el.x - box.x) * scale;
        const y = oy + (el.y - box.y) * scale;
        const w = Math.max(2, el.w * scale);
        const h = Math.max(1.5, el.h * scale);
        ctx.fillStyle = el.type === "shape" ? "#94a3b8" : el.type === "frame" ? el.color + "22" : el.color;
        ctx.fillRect(x, y, w, h);
        if (el.type === "frame" || sel.has(el.id)) {
          ctx.strokeStyle = sel.has(el.id) ? "#1376d4" : el.type === "frame" ? el.color : "#1376d4";
          ctx.lineWidth = sel.has(el.id) ? 1.5 : 0.75;
          ctx.strokeRect(x, y, w, h);
        }
      }
      ctx.fillStyle = "rgba(19, 118, 212, 0.08)";
      ctx.strokeStyle = "#1376d4";
      ctx.lineWidth = 1.5;
      const vx = ox + (vis.x - box.x) * scale;
      const vy = oy + (vis.y - box.y) * scale;
      ctx.fillRect(vx, vy, vis.w * scale, vis.h * scale);
      ctx.strokeRect(vx, vy, vis.w * scale, vis.h * scale);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    schedule();
    const unsub = store.subscribe((s, prev) => { if (s.camera !== prev.camera || s.elements !== prev.elements || s.viewport !== prev.viewport || s.selection !== prev.selection) schedule(); });
    return () => { unsub(); if (raf) cancelAnimationFrame(raf); };
  }, [store]);

  const navigate = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const w = world.current;
    if (!w) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    store.getState().centerOn({ x: w.box.x + (mx - w.ox) / w.scale, y: w.box.y + (my - w.oy) / w.scale });
  };

  return (
    <section className="floating-panel map-card" aria-label="Map overview" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <strong className="map-title">Map overview</strong>
      <canvas
        ref={canvasRef}
        className="mini-map"
        width={W}
        height={H}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); navigate(e); }}
        onPointerMove={(e) => dragging.current && navigate(e)}
        onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
      />
      <div className="map-readout" aria-label="Map overview status">
        <span>{stats.cards} cards · {stats.notes} notes · {stats.frames} frames</span>
        <span>{stats.connectors} links · {Math.round(zoom * 100)}% zoom · {coverage}% view · {elementCount} objects</span>
      </div>
      <button className="map-fit-button" type="button" onClick={() => store.getState().zoomToFit()}>Fit visible board</button>
      {hasSelection && <button className="map-fit-button secondary" type="button" onClick={() => store.getState().zoomToSelection()}>Fit selection</button>}
    </section>
  );
}
