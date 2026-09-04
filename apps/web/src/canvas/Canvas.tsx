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
import { LensLegend } from "./LensLegend";
import { MapCard } from "./MapCard";
import { ZoomCard } from "./ZoomCard";
import { HelpPanel } from "./HelpPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ContextMenu } from "./ContextMenu";
import { GuidesOverlay } from "./GuidesOverlay";
import { GridCanvas } from "./GridCanvas";

export function Canvas() {
  const store = useCanvasStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
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

  // The world transform is written straight to the DOM on camera changes so panning and
  // zooming never re-render the React tree (only the culling key below can).
  useEffect(() => {
    const apply = () => {
      const { camera } = store.getState();
      if (worldRef.current) worldRef.current.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    };
    apply();
    return store.subscribe((s, prev) => { if (s.camera !== prev.camera) apply(); });
  }, [store]);

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

  const mode = spaceDown || tool === "hand" ? "pan-tool" : tool === "select" ? "select-tool" : "draw-tool";

  return (
    <main
      ref={rootRef}
      className={`canvas-viewport ${mode} ${dragging ? "is-dragging" : ""}`}
      aria-label="Nexus canvas"
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (!(t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) e.preventDefault();
      }}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerUp}
      onDoubleClick={interaction.onDoubleClick}
      onContextMenu={interaction.onContextMenu}
    >
      <GridCanvas />
      {/* world layer */}
      <div ref={worldRef} className="absolute left-0 top-0" data-canvas-world style={{ transformOrigin: "0 0", width: 0, height: 0, willChange: "transform" }}>
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
      <GuidesOverlay />
      <SelectionOverlay onBeginResize={interaction.beginResize} />
      <ContextMenu />
      <SelectionToolbar />
      <CommandBar />
      <Toolbar />
      <InventoryPanel rootRef={rootRef} />
      <InspectorPanel rootRef={rootRef} />
      {panels.map && <MapCard />}
      {panels.help && <HelpPanel />}
      {panels.history && <HistoryPanel rootRef={rootRef} />}
      <ZoomCard />
      <LensLegend />
      <span className="inventory-status">{count} objects on this board · layout and viewport autosaved</span>
    </main>
  );
}
