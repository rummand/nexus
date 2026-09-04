"use client";

import { Map as MapIcon, Maximize, Minus, Mouse, Plus, Touchpad } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";

export function ZoomControls({ minimapOpen, onToggleMinimap }: { minimapOpen: boolean; onToggleMinimap: () => void }) {
  const store = useCanvasStore();
  const zoom = useCanvas((s) => s.camera.zoom);
  const scrollMode = useCanvas((s) => s.scrollMode);
  const viewport = useCanvas((s) => s.viewport);
  const centre = { x: viewport.w / 2, y: viewport.h / 2 };

  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1 shadow-float" onPointerDown={(e) => e.stopPropagation()}>
      <Btn title={scrollMode === "pan" ? "Scroll pans (trackpad). Click for scroll-to-zoom (mouse)." : "Scroll zooms (mouse). Click for scroll-to-pan (trackpad)."} onClick={() => store.getState().setScrollMode(scrollMode === "pan" ? "zoom" : "pan")}>
        {scrollMode === "pan" ? <Touchpad size={15} /> : <Mouse size={15} />}
      </Btn>
      <Btn title="Minimap" active={minimapOpen} onClick={onToggleMinimap}><MapIcon size={15} /></Btn>
      <span className="mx-0.5 h-5 w-px bg-ink-200" />
      <Btn title="Zoom out  ⌘−" onClick={() => store.getState().zoomAt(centre, 0.8)}><Minus size={15} /></Btn>
      <button title="Reset to 100%  ⌘0" onClick={() => store.getState().zoomTo(1)} className="h-7 min-w-[52px] rounded-md px-1 text-xs font-medium tabular-nums text-ink-700 hover:bg-ink-100">
        {Math.round(zoom * 100)}%
      </button>
      <Btn title="Zoom in  ⌘+" onClick={() => store.getState().zoomAt(centre, 1.25)}><Plus size={15} /></Btn>
      <Btn title="Zoom to fit  ⇧1" onClick={() => store.getState().zoomToFit()}><Maximize size={15} /></Btn>
    </div>
  );
}

function Btn({ children, title, onClick, active }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${active ? "bg-accent-100 text-accent-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"}`}>
      {children}
    </button>
  );
}
