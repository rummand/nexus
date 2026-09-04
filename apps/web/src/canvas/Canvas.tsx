"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvas, useCanvasStore } from "./store";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useWheel } from "./hooks/useWheel";
import { useKeyboard } from "./hooks/useKeyboard";
import { useAutosave } from "./hooks/useAutosave";
import { ElementLayer } from "./ElementLayer";
import { ConnectorLayer } from "./ConnectorLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { SelectionToolbar } from "./SelectionToolbar";
import { Toolbar } from "./Toolbar";
import { ZoomControls } from "./ZoomControls";
import { Minimap } from "./Minimap";

/** Grid spacing adapts to zoom so dots never get denser than ~16 screen px. */
function gridStep(zoom: number) {
  let step = 24;
  while (step * zoom < 16) step *= 2;
  while (step * zoom > 64) step /= 2;
  return step * zoom;
}

export function Canvas() {
  const store = useCanvasStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const camera = useCanvas((s) => s.camera);
  const tool = useCanvas((s) => s.tool);
  const spaceDown = useCanvas((s) => s.spaceDown);
  const [minimap, setMinimap] = useState(true);

  const interaction = useCanvasInteraction(rootRef);
  useWheel(rootRef);
  useKeyboard(true);
  useAutosave();

  // Track viewport size; fit content on first measurement.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      store.getState().setViewport(width, height);
      if (first && width > 0) {
        first = false;
        store.getState().zoomToFit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);

  // Block the browser context menu on the canvas surface.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  const step = gridStep(camera.zoom);
  const cursor = spaceDown ? "grab" : tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div
      ref={rootRef}
      className="canvas-root dot-grid relative h-full w-full overflow-clip bg-ink-50"
      style={{ backgroundSize: `${step}px ${step}px`, backgroundPosition: `${camera.x}px ${camera.y}px`, cursor }}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (!(t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) e.preventDefault();
      }}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerUp}
      onDoubleClick={interaction.onDoubleClick}
    >
      {/* world layer */}
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, transformOrigin: "0 0", width: 0, height: 0, willChange: "transform" }}
      >
        <ElementLayer />
        <ConnectorLayer />
      </div>

      {/* screen-space overlays */}
      <SelectionOverlay onBeginResize={interaction.beginResize} />
      <SelectionToolbar />
      <Toolbar />
      {minimap && <Minimap />}
      <ZoomControls minimapOpen={minimap} onToggleMinimap={() => setMinimap((m) => !m)} />
    </div>
  );
}
