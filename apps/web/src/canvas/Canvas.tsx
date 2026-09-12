"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useCanvas, useCanvasStore } from "./store";
import { screenToWorld } from "./geometry";
import { cardsInGrid, dropGhosts, endEntityDrag, entityDragInFlight, ENTITY_DRAG_TYPE, parseEntityDrag, type DropGhost, type EntityLike } from "./entityCard";
import { DropPreview } from "./DropPreview";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useWheel } from "./hooks/useWheel";
import { useKeyboard } from "./hooks/useKeyboard";
import { useAutosave } from "./hooks/useAutosave";
import { useLive } from "./hooks/useLive";
import { useFollow } from "./hooks/useFollow";
import { FollowBar, GatheredNote, PeerLayer } from "./PeerLayer";
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
import { TimeScrubber } from "./TimeScrubber";
import { HelpPanel } from "./HelpPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ComposePanel } from "./ComposePanel";
import { CommentsPanel } from "./comments/CommentsPanel";
import { CommentBadges } from "./comments/CommentBadges";
import { AgentScopeOverlay } from "./AgentScopeOverlay";
import { ContextMenu } from "./ContextMenu";
import { GuidesOverlay } from "./GuidesOverlay";
import { GridCanvas } from "./GridCanvas";

/**
 * The chrome that floats over the board. Every one of these is a child of the canvas element, so a
 * drop landing on one has to be refused explicitly — see `onDragOver`. New chrome can opt in with
 * `data-canvas-chrome` instead of being added to this list.
 */
const CHROME = "[data-canvas-chrome], .floating-panel, .canvas-toolbar, .command-bar, .shape-inspector-bar, .lens-legend, .time-scrubber, .compose-panel, .comments-panel, .present-bar";

/** Is the pointer over the board itself, rather than over something floating above it? */
function overCanvas(e: React.DragEvent): boolean {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  return !hit || !hit.closest(CHROME);
}

export function Canvas({ draftBar }: { draftBar?: React.ReactNode } = {}) {
  const store = useCanvasStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const tool = useCanvas((s) => s.tool);
  const spaceDown = useCanvas((s) => s.spaceDown);
  const dragging = useCanvas((s) => s.isDragging);
  const panels = useCanvas((s) => s.panels);
  const presenting = useCanvas((s) => s.presenting);
  const [preview, setPreview] = useState<{ key: string; ghosts: DropGhost[] } | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  /* Where the pointer was on the last dragover, so the preview can be placed the moment it mounts
     rather than waiting for the next event to arrive and land at the world origin in between. */
  const ghostAt = useRef<{ x: number; y: number } | null>(null);

  /** The world point a drop at this screen position lands on. */
  const worldAt = (e: React.DragEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, store.getState().camera);
  };

  /** Entities in the payload that are not already on this board. */
  const notYetPlaced = (entities: EntityLike[]) => {
    const already = new Set(Object.values(store.getState().elements).map((el) => (el.type === "card" ? el.meta?.entityId : undefined)));
    return entities.filter((x) => !already.has(x.id));
  };

  const clearPreview = () => {
    if (ghostRef.current) ghostRef.current.style.display = "none";
    ghostAt.current = null;
    setPreview(null);
  };

  /** Entities dragged out of the Graph inventory land where they are dropped. */
  const onDrop = (e: React.DragEvent) => {
    clearPreview();
    endEntityDrag();
    if (!overCanvas(e)) return;
    const raw = e.dataTransfer.getData(ENTITY_DRAG_TYPE);
    if (!raw) return;
    const entities = parseEntityDrag(raw);
    if (!entities) return;
    e.preventDefault();
    const world = worldAt(e);
    if (!world) return;
    const fresh = notYetPlaced(entities);
    if (fresh.length === 0) return;
    store.getState().addElements(cardsInGrid(fresh, world), { select: true });
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(ENTITY_DRAG_TYPE)) return;
    /*
     * A drop onto a floating panel is not a drop onto the board: the panels are children of this
     * element, so without this the card would be created underneath one, where nobody can see it.
     * Refusing it makes the cursor say no rather than the board quietly swallowing the object.
     */
    if (!overCanvas(e)) {
      e.dataTransfer.dropEffect = "none";
      if (ghostRef.current) ghostRef.current.style.display = "none";
      return;
    }
    e.preventDefault(); // required, or the browser refuses the drop
    e.dataTransfer.dropEffect = "copy";

    /*
     * Keyed on what is actually in the hand, not on whether a preview happens to be showing: a
     * second drag started before the first one's ghosts were cleared would otherwise draw the
     * previous object, which is worse than drawing nothing.
     */
    const inFlight = entityDragInFlight();
    const key = inFlight ? inFlight.map((x) => x.id).join("|") : "";
    if (inFlight && preview?.key !== key) {
      const fresh = notYetPlaced(inFlight);
      setPreview(fresh.length ? { key, ghosts: dropGhosts(fresh) } : null);
    }
    ghostAt.current = worldAt(e);
    placeGhosts();
  };

  const placeGhosts = () => {
    const node = ghostRef.current;
    const at = ghostAt.current;
    if (!node || !at) return;
    node.style.display = "block";
    node.style.transform = `translate(${at.x}px, ${at.y}px)`;
  };

  // The preview is mounted by the first dragover and positioned here, in the same frame.
  useEffect(placeGhosts, [preview]);

  /*
   * A drag abandoned outside the window never reaches drop or dragleave, so the ghosts would sit
   * on the board until the next drag. `dragend` always fires on the source, which is on this page.
   */
  useEffect(() => {
    const done = () => { endEntityDrag(); clearPreview(); };
    window.addEventListener("dragend", done);
    return () => window.removeEventListener("dragend", done);
  }, []);
  const presentIndex = useCanvas((s) => s.presentIndex);
  const frameCount = useCanvas((s) => { let n = 0; for (const el of Object.values(s.elements)) if (el.type === "frame") n++; return n; });
  useProposals();
  const isEmpty = useCanvas((s) => Object.keys(s.elements).length === 0);

  const interaction = useCanvasInteraction(rootRef);
  useWheel(rootRef);
  useKeyboard(true);
  useAutosave();
  useLive(rootRef);
  useFollow();

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
      className={`canvas-viewport ${mode} ${dragging ? "is-dragging" : ""} ${preview ? "is-drop-target" : ""}`}
      /* A panel hanging from the top only has to keep clear of the map when the map is there
         (§5.55). CSS cannot read the store, so the store says so here and the property follows. */
      data-map={panels.map ? "on" : "off"}
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
      onDragLeave={(e) => { if (e.currentTarget === e.target) clearPreview(); }}
      onDrop={onDrop}
    >
      <GridCanvas />
      {/* world layer */}
      <div ref={worldRef} className="absolute left-0 top-0" data-canvas-world style={{ transformOrigin: "0 0", width: 0, height: 0, willChange: "transform" }}>
        <ElementLayer />
        <ConnectorLayer />
        {preview && <DropPreview ghosts={preview.ghosts} nodeRef={ghostRef} />}
      </div>

      {isEmpty && (
        <section className="empty-board" style={{ pointerEvents: "none" }}>
          <Sparkles size={24} />
          <h2>This board is empty</h2>
          <p>Press C for an architecture card, N for a note, F for a frame — or double-click anywhere to drop a note. Everything saves automatically.</p>
        </section>
      )}

      {/* screen-space overlays */}
      <PeerLayer />
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
      {!presenting && panels.comments && <CommentsPanel rootRef={rootRef} />}
      {!presenting && <AgentScopeOverlay />}
      {!presenting && <CommentBadges />}
      {/* What this board has drawn and not yet agreed (§5.101), passed in rather than imported so
          the canvas does not have to know which boards have one. */}
      {!presenting && draftBar}
      {!presenting && <FollowBar />}
      {!presenting && <GatheredNote />}
      {!presenting && <ZoomCard />}
      {!presenting && <TimeScrubber />}
      <LensLegend />
      <KindSuggestions />
      {/* The status line that used to sit here is gone (§5.55): it said the object count, which the
          topbar says, and "autosaved", which the topbar's save pill says in more detail and in
          real time. */}
      {presenting && (
        <div className="present-bar" data-present-exit onPointerDown={(e) => e.stopPropagation()}>
          {frameCount > 0 && <button type="button" onClick={() => store.getState().presentStep(-1)} aria-label="Previous frame">‹</button>}
          <button type="button" className="present-exit" onClick={() => store.getState().setPresenting(false)}>
            {frameCount > 0 ? (presentIndex === null ? `Whole board · ${frameCount} frame${frameCount === 1 ? "" : "s"} · → to step through` : `Frame ${presentIndex + 1} of ${frameCount}`) : "Presenting"} · Esc to exit
          </button>
          {frameCount > 0 && <button type="button" onClick={() => store.getState().presentStep(1)} aria-label="Next frame">›</button>}
        </div>
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
