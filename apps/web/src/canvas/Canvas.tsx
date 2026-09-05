"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";
import { screenToWorld } from "./geometry";
import { cardCentredAt, cardsInGrid, ENTITY_DRAG_TYPE, parseEntityDrag } from "./entityCard";
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
import { useProposals } from "./hooks/useProposals";
import { MapCard } from "./MapCard";
import { ZoomCard } from "./ZoomCard";
import { HelpPanel } from "./HelpPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ComposePanel } from "./ComposePanel";
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
  const presenting = useCanvas((s) => s.presenting);
  const [dropActive, setDropActive] = useState(false);

  /** Entities dragged out of the Graph inventory land where they are dropped. */
  const onDrop = (e: React.DragEvent) => {
    setDropActive(false);
    const raw = e.dataTransfer.getData(ENTITY_DRAG_TYPE);
    if (!raw) return;
    const entities = parseEntityDrag(raw);
    if (!entities) return;
    e.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = store.getState();
    const world = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, s.camera);
    const already = new Set(Object.values(s.elements).map((el) => (el.type === "card" ? el.meta?.entityId : undefined)));
    const fresh = entities.filter((x) => !already.has(x.id));
    if (fresh.length === 0) return;
    s.addElements(fresh.length === 1 ? [cardCentredAt(fresh[0]!, world.x, world.y)] : cardsInGrid(fresh, world), { select: true });
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(ENTITY_DRAG_TYPE)) return;
    e.preventDefault(); // required, or the browser refuses the drop
    e.dataTransfer.dropEffect = "copy";
    if (!dropActive) setDropActive(true);
  };
  const presentIndex = useCanvas((s) => s.presentIndex);
  const frameCount = useCanvas((s) => { let n = 0; for (const el of Object.values(s.elements)) if (el.type === "frame") n++; return n; });
  useProposals();
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
      className={`canvas-viewport ${mode} ${dragging ? "is-dragging" : ""} ${dropActive ? "is-drop-target" : ""}`}
      aria-label="Nexus canvas"
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        // preventDefault stops the canvas stealing focus, but it also cancels a native drag
        // before dragstart fires — so leave draggable sources (the Graph inventory) alone.
        if (t.closest('[draggable="true"]')) return;
        if (!(t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) e.preventDefault();
      }}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerUp}
      onDoubleClick={interaction.onDoubleClick}
      onContextMenu={interaction.onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropActive(false); }}
      onDrop={onDrop}
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
      {!presenting && <SelectionOverlay onBeginResize={interaction.beginResize} />}
      {!presenting && <ContextMenu />}
      {!presenting && <SelectionToolbar />}
      {!presenting && <CommandBar />}
      {!presenting && <Toolbar />}
      {!presenting && <InventoryPanel rootRef={rootRef} />}
      {!presenting && <InspectorPanel rootRef={rootRef} />}
      {!presenting && panels.map && <MapCard />}
      {!presenting && panels.help && <HelpPanel />}
      {!presenting && panels.history && <HistoryPanel rootRef={rootRef} />}
      {!presenting && panels.compose && <ComposePanel rootRef={rootRef} />}
      {!presenting && <ZoomCard />}
      <LensLegend />
      <KindSuggestions />
      {presenting ? (
        <div className="present-bar" data-present-exit onPointerDown={(e) => e.stopPropagation()}>
          {frameCount > 0 && <button type="button" onClick={() => store.getState().presentStep(-1)} aria-label="Previous frame">‹</button>}
          <button type="button" className="present-exit" onClick={() => store.getState().setPresenting(false)}>
            {frameCount > 0 ? (presentIndex === null ? `Whole board · ${frameCount} frame${frameCount === 1 ? "" : "s"} · → to step through` : `Frame ${presentIndex + 1} of ${frameCount}`) : "Presenting"} · Esc to exit
          </button>
          {frameCount > 0 && <button type="button" onClick={() => store.getState().presentStep(1)} aria-label="Next frame">›</button>}
        </div>
      ) : (
        <span className="inventory-status">{count} objects on this board · layout and viewport autosaved</span>
      )}
    </main>
  );
}

/** Datalists of kinds and entity names in the workspace graph, offered by the card fields. */
function KindSuggestions() {
  const kinds = useCanvas((s) => s.graphKinds);
  const names = useCanvas((s) => s.graphEntities);
  return (
    <>
      <datalist id="nexus-kinds">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
      <datalist id="nexus-entities">{names.slice(0, 600).map((e) => <option key={e.id} value={e.name}>{e.kind}</option>)}</datalist>
    </>
  );
}
