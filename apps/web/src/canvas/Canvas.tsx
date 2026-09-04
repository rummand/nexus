"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useWheel } from "./hooks/useWheel";
import { useKeyboard } from "./hooks/useKeyboard";
import { useAutosave } from "./hooks/useAutosave";
import { ElementLayer } from "./ElementLayer";
import { ConnectorLayer } from "./ConnectorLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { SelectionToolbar } from "./SelectionToolbar";
import { CommandBar } from "./CommandBar";
import { Toolbar } from "./Toolbar";
import { InspectorPanel } from "./InspectorPanel";
import { InventoryPanel } from "./InventoryPanel";
import { MapCard } from "./MapCard";
import { ZoomCard } from "./ZoomCard";
import { HelpPanel } from "./HelpPanel";

/** Minor grid spacing adapts to zoom so lines never get denser than ~16 screen px. */
function gridStep(zoom: number) {
  let step = 20;
  while (step * zoom < 14) step *= 2;
  while (step * zoom > 56) step /= 2;
  return step * zoom;
}

export function Canvas() {
  const store = useCanvasStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const camera = useCanvas((s) => s.camera);
  const tool = useCanvas((s) => s.tool);
  const spaceDown = useCanvas((s) => s.spaceDown);
  const dragging = useCanvas((s) => s.isDragging);
  const panels = useCanvas((s) => s.panels);
  const isEmpty = useCanvas((s) => Object.keys(s.elements).length === 0);
  const count = useCanvas((s) => Object.keys(s.elements).length);

  const interaction = useCanvasInteraction(rootRef);
  useWheel(rootRef);
  useKeyboard(true);
  useAutosave();

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

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  const minor = gridStep(camera.zoom);
  const major = minor * 4;
  const pos = `${camera.x}px ${camera.y}px`;
  const mode = spaceDown || tool === "hand" ? "pan-tool" : tool === "select" ? "select-tool" : "draw-tool";

  return (
    <main
      ref={rootRef}
      className={`canvas-viewport ${mode} ${dragging ? "is-dragging" : ""}`}
      aria-label="Nexus canvas"
      style={{
        backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
        backgroundPosition: `${pos}, ${pos}, ${pos}, ${pos}`,
      }}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (!(t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) e.preventDefault();
      }}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerUp}
      onDoubleClick={interaction.onDoubleClick}
    >
      {/* world layer */}
      <div className="absolute left-0 top-0" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, transformOrigin: "0 0", width: 0, height: 0, willChange: "transform" }}>
        <ElementLayer />
        <ConnectorLayer />
      </div>

      {isEmpty && (
        <section className="empty-board" style={{ pointerEvents: "none" }}>
          <Sparkles size={24} />
          <h2>This board is empty</h2>
          <p>Press C for an architecture card, N for a note, F for a frame — or double-click anywhere to drop a note. Everything saves automatically.</p>
        </section>
      )}

      {/* screen-space overlays */}
      <SelectionOverlay onBeginResize={interaction.beginResize} />
      <SelectionToolbar />
      <CommandBar />
      <Toolbar />
      <InventoryPanel rootRef={rootRef} />
      <InspectorPanel rootRef={rootRef} />
      {panels.map && <MapCard />}
      {panels.help && <HelpPanel />}
      <ZoomCard />
      <span className="inventory-status">{count} objects on this board · layout and viewport autosaved</span>
    </main>
  );
}
