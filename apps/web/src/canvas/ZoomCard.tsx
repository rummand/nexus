"use client";

import { Maximize2, Minus, Mouse, Plus, Touchpad } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";

export function ZoomCard() {
  const store = useCanvasStore();
  const zoom = useCanvas((s) => s.camera.zoom);
  const scrollMode = useCanvas((s) => s.scrollMode);
  const viewport = useCanvas((s) => s.viewport);
  const centre = { x: viewport.w / 2, y: viewport.h / 2 };
  return (
    <section className="floating-panel zoom-card" aria-label="Zoom controls" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button type="button" title={scrollMode === "pan" ? "Scroll pans (trackpad). Click for scroll-to-zoom." : "Scroll zooms (mouse). Click for scroll-to-pan."} onClick={() => store.getState().setScrollMode(scrollMode === "pan" ? "zoom" : "pan")}>
        {scrollMode === "pan" ? <Touchpad size={18} /> : <Mouse size={18} />}
      </button>
      <button type="button" title="Zoom out  ⌘−" onClick={() => store.getState().zoomAt(centre, 0.8)}><Minus size={18} /></button>
      <strong title="Reset to 100%  ⌘0" style={{ cursor: "pointer" }} onClick={() => store.getState().zoomTo(1)}>{Math.round(zoom * 100)}%</strong>
      <button type="button" title="Zoom in  ⌘+" onClick={() => store.getState().zoomAt(centre, 1.25)}><Plus size={18} /></button>
      <button type="button" title="Fit board  ⇧1" onClick={() => store.getState().zoomToFit()}><Maximize2 size={18} /></button>
    </section>
  );
}
