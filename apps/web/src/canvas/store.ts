import { createStore, type StoreApi } from "zustand/vanilla";
export { useStore } from "zustand";
import { computeLens, NO_LENS, type Lens, type LensResult } from "./lens";
import type { Proposal } from "@/lib/graph-types";
import { useStore } from "zustand";
import { createContext, useContext } from "react";
import { nanoid } from "nanoid";
import type { Box, BoxElement, CanvasDocument, CanvasElement, ConnectorEnd, ElementId, Point, SavedViewpoint } from "./document";
import { DOCUMENT_VERSION, isBoxElement } from "./document";
import { type AlignMode, type Camera, type Insets, alignBoxes, cameraToFitInsets, contentBounds, distributeBoxes, elementBounds, unionBoxes, zoomCameraAt, zoomCameraTo, clamp, MIN_ZOOM, MAX_ZOOM } from "./geometry";

export type Tool = "select" | "hand" | "frame" | "sticky" | "text" | "section" | "card" | "rect" | "ellipse" | "diamond" | "connector";

export type ConnectorPreset = "arrow" | "line" | "dashed";

export type PanelName = "inspector" | "map" | "shapePicker" | "help" | "inventory" | "history";

export type SaveState = "saved" | "dirty" | "saving" | "error";

export type ScrollMode = "pan" | "zoom";

type Elements = Record<ElementId, CanvasElement>;

const HISTORY_LIMIT = 100;

export interface CanvasState {
  boardId: string;
  workspaceId: string;
  elements: Elements;
  camera: Camera;
  viewport: { w: number; h: number };
  tool: Tool;
  selection: ElementId[];
  editingId: ElementId | null;
  hoverId: ElementId | null;
  /** Transient connector being drawn (screen-independent, world coords). */
  pendingConnector: { from: ElementId; to: Point } | null;
  /** Marquee rectangle in world coords while dragging. */
  marquee: Box | null;
  past: Elements[];
  future: Elements[];
  saveState: SaveState;
  /** Increments on every document mutation; the autosave hook watches it. */
  revision: number;
  scrollMode: ScrollMode;
  spaceDown: boolean;
  connectorPreset: ConnectorPreset;
  panels: Record<PanelName, boolean>;
  /** Viewpoint: card kinds dimmed on this board (client-side lens, not persisted). */
  hiddenKinds: string[];
  /** Which tab the left graph panel shows. */
  graphTab: "inventory" | "viewpoint";
  /** Smart alignment guides while dragging (world coords). */
  guides: { x: number[]; y: number[] };
  snapEnabled: boolean;
  /** Context menu anchor (screen coords) and the element under it, if any. */
  contextMenu: { x: number; y: number; targetId: string | null; world: Point } | null;
  /** Saved viewpoints (persisted with the document). */
  viewpoints: SavedViewpoint[];
  /** Presentation mode: chrome hidden, canvas only (Esc leaves). */
  presenting: boolean;
  /** Index of the frame currently shown as a "slide" while presenting (null = whole board). */
  presentIndex: number | null;
  /** Open agent proposals for this workspace (fetched after every save) and a per-entity index. */
  proposals: Proposal[];
  proposalsByEntity: Record<string, Proposal[]>;
  /** Active lens (client-side optic, saved with viewpoints) and its derived result. */
  lens: Lens;
  lensResult: LensResult | null;
  /** Frame id the inspector should scroll to / highlight after "Focus". */
  isDragging: boolean;

  // camera
  setViewport(w: number, h: number): void;
  setCamera(cam: Camera): void;
  panBy(dx: number, dy: number): void;
  zoomAt(anchor: Point, factor: number): void;
  zoomTo(zoom: number, anchor?: Point): void;
  zoomToFit(): void;
  zoomToSelection(): void;
  centerOn(world: Point): void;

  // ui
  setTool(tool: Tool): void;
  setScrollMode(mode: ScrollMode): void;
  setSpaceDown(v: boolean): void;
  setHover(id: ElementId | null): void;
  setMarquee(b: Box | null): void;
  setPendingConnector(p: CanvasState["pendingConnector"]): void;
  setSaveState(s: SaveState): void;
  setConnectorPreset(p: ConnectorPreset): void;
  togglePanel(name: PanelName, value?: boolean): void;
  setDragging(v: boolean): void;
  toggleKind(kind: string): void;
  clearHiddenKinds(): void;
  setGraphTab(tab: "inventory" | "viewpoint"): void;
  setGuides(g: { x: number[]; y: number[] }): void;
  setSnapEnabled(v: boolean): void;
  setContextMenu(m: CanvasState["contextMenu"]): void;
  setLens(lens: Lens): void;
  setPresenting(v: boolean): void;
  /** Move to the next / previous frame slide while presenting; wraps around. */
  presentStep(delta: 1 | -1): void;
  setProposals(list: Proposal[]): void;
  saveViewpoint(name: string): void;
  applyViewpoint(id: string): void;
  deleteViewpoint(id: string): void;
  /** Select an element and bring it into view. */
  focusElement(id: ElementId): void;

  // selection
  select(ids: ElementId[], additive?: boolean): void;
  toggleSelect(id: ElementId): void;
  clearSelection(): void;
  selectAll(): void;
  startEditing(id: ElementId | null): void;

  // document
  addElements(els: CanvasElement[], opts?: { select?: boolean; history?: boolean }): void;
  updateElements(patch: Record<ElementId, Partial<CanvasElement>>, opts?: { history?: boolean }): void;
  /** Replace the whole element map (used by drags that computed positions externally). */
  replaceElements(next: Elements, opts?: { history?: boolean }): void;
  deleteElements(ids: ElementId[], opts?: { history?: boolean }): void;
  /** Promote sticky notes to architecture cards (same id and place; title → title, body → description). */
  convertNotesToCards(ids: ElementId[]): void;
  /** Align or distribute the selected box elements (frames carry their contents). */
  alignSelection(mode: AlignMode | "distributeX" | "distributeY"): void;
  duplicateSelection(): void;
  bringToFront(ids: ElementId[]): void;
  sendToBack(ids: ElementId[]): void;
  nudgeSelection(dx: number, dy: number): void;

  // history
  pushHistory(snapshot?: Elements): void;
  undo(): void;
  redo(): void;

  // export
  toDocument(): CanvasDocument;
}

export type CanvasStore = StoreApi<CanvasState>;

export interface CreateCanvasStoreOptions {
  boardId: string;
  workspaceId: string;
  document: CanvasDocument;
  scrollMode?: ScrollMode;
}

export function nextZ(elements: Elements): number {
  let max = 0;
  for (const el of Object.values(elements)) max = Math.max(max, el.z);
  return max + 1;
}

/** Elements that move together with a frame: those whose centre lies inside it. */
export function frameChildren(frameId: ElementId, elements: Elements): ElementId[] {
  const frame = elements[frameId];
  if (!frame || frame.type !== "frame") return [];
  const out: ElementId[] = [];
  for (const el of Object.values(elements)) {
    if (el.id === frameId || !isBoxElement(el) || el.type === "frame") continue;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    if (cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h) out.push(el.id);
  }
  return out;
}

/** Selection + children of any selected frames (for moving). */
export function expandSelectionForMove(selection: ElementId[], elements: Elements): ElementId[] {
  const set = new Set(selection);
  for (const id of selection) for (const child of frameChildren(id, elements)) set.add(child);
  return [...set];
}

/** Frames in reading order (rows top to bottom, then left to right) — the slides of a presentation. */
export function presentationFrames(elements: Elements): BoxElement[] {
  const frames = Object.values(elements).filter((el): el is BoxElement => el.type === "frame");
  return frames.sort((a, b) => (Math.abs(a.y - b.y) > 80 ? a.y - b.y : a.x - b.x));
}

/**
 * The document for a new board made from one frame: the frame's contents (and connectors between
 * them), translated so the frame sits at the origin. The frame itself is not copied — the new
 * board *is* the frame.
 */
export function documentFromFrame(frameId: ElementId, elements: Elements): CanvasDocument | null {
  const frame = elements[frameId];
  if (!frame || frame.type !== "frame") return null;
  const ids = new Set(frameChildren(frameId, elements));
  const out: Elements = {};
  for (const id of ids) {
    const el = elements[id];
    if (!el || !isBoxElement(el)) continue;
    out[id] = { ...el, x: el.x - frame.x, y: el.y - frame.y };
  }
  for (const el of Object.values(elements)) {
    if (el.type !== "connector") continue;
    const from = "elementId" in el.from ? el.from.elementId : null;
    const to = "elementId" in el.to ? el.to.elementId : null;
    if (from && to && ids.has(from) && ids.has(to)) out[el.id] = el;
  }
  return { version: DOCUMENT_VERSION, elements: out };
}

/** Screen-space area hidden by the floating chrome (command bar, panels, map card). */
export function fitInsets(s: Pick<CanvasState, "panels" | "viewport" | "presenting">, extra = 40): Insets {
  if (s.presenting) return { top: extra, bottom: extra, left: extra, right: extra };
  const narrow = s.viewport.w < 1100;
  return {
    top: 140 + extra,
    bottom: 80 + extra,
    left: (s.panels.inventory && !narrow ? 370 : 80) + extra,
    right: (s.panels.inspector && !narrow ? 300 : 80) + extra,
  };
}

export function selectionBounds(selection: ElementId[], elements: Elements): Box | null {
  const boxes: Box[] = [];
  for (const id of selection) {
    const el = elements[id];
    if (!el) continue;
    const b = elementBounds(el, elements);
    if (b) boxes.push(b);
  }
  return unionBoxes(boxes);
}

export function createCanvasStore({ boardId, workspaceId, document, scrollMode = "pan" }: CreateCanvasStoreOptions): CanvasStore {
  const store = createStore<CanvasState>((set, get) => {
    const mutate = (next: Elements, history: boolean, extra: Partial<CanvasState> = {}) => {
      const s = get();
      set({
        elements: next,
        revision: s.revision + 1,
        saveState: "dirty",
        ...(history ? { past: [...s.past.slice(-HISTORY_LIMIT + 1), s.elements], future: [] } : {}),
        ...extra,
      });
    };

    return {
      boardId,
      workspaceId,
      elements: { ...document.elements },
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { w: 1, h: 1 },
      tool: "select",
      selection: [],
      editingId: null,
      hoverId: null,
      pendingConnector: null,
      marquee: null,
      past: [],
      future: [],
      saveState: "saved",
      revision: 0,
      scrollMode,
      spaceDown: false,
      connectorPreset: "arrow",
      panels: { inspector: true, map: true, shapePicker: false, help: false, inventory: true, history: false },
      isDragging: false,
      hiddenKinds: [],
      graphTab: "inventory",
      guides: { x: [], y: [] },
      snapEnabled: true,
      contextMenu: null,
      lens: NO_LENS,
      lensResult: null,
      presenting: false,
      presentIndex: null,
      proposals: [],
      proposalsByEntity: {},
      viewpoints: document.viewpoints ?? [],

      // ---- camera ----
      setViewport: (w, h) => set({ viewport: { w: Math.max(1, w), h: Math.max(1, h) } }),
      setCamera: (camera) => set({ camera: { ...camera, zoom: clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM) } }),
      panBy: (dx, dy) => set((s) => ({ camera: { ...s.camera, x: s.camera.x + dx, y: s.camera.y + dy } })),
      zoomAt: (anchor, factor) => set((s) => ({ camera: zoomCameraAt(s.camera, anchor, factor) })),
      zoomTo: (zoom, anchor) =>
        set((s) => ({ camera: zoomCameraTo(s.camera, anchor ?? { x: s.viewport.w / 2, y: s.viewport.h / 2 }, zoom) })),
      zoomToFit: () => {
        const s = get();
        const bounds = contentBounds(s.elements) ?? { x: -400, y: -300, w: 800, h: 600 };
        set({ camera: cameraToFitInsets(bounds, s.viewport.w, s.viewport.h, fitInsets(s), 1.5) });
      },
      zoomToSelection: () => {
        const s = get();
        const bounds = selectionBounds(s.selection, s.elements);
        if (!bounds) return;
        set({ camera: cameraToFitInsets(bounds, s.viewport.w, s.viewport.h, fitInsets(s, 60), 2) });
      },
      centerOn: (world) =>
        set((s) => ({ camera: { ...s.camera, x: s.viewport.w / 2 - world.x * s.camera.zoom, y: s.viewport.h / 2 - world.y * s.camera.zoom } })),

      // ---- ui ----
      setTool: (tool) => set((s) => ({ tool, editingId: null, pendingConnector: null, panels: { ...s.panels, shapePicker: s.panels.shapePicker && ["rect", "ellipse", "diamond", "connector"].includes(tool) } })),
      setScrollMode: (scrollMode) => set({ scrollMode }),
      setSpaceDown: (spaceDown) => set({ spaceDown }),
      setHover: (hoverId) => set((s) => (s.hoverId === hoverId ? s : { hoverId })),
      setMarquee: (marquee) => set({ marquee }),
      setPendingConnector: (pendingConnector) => set({ pendingConnector }),
      setSaveState: (saveState) => set({ saveState }),
      setConnectorPreset: (connectorPreset) => set({ connectorPreset }),
      togglePanel: (name, value) => set((s) => ({ panels: { ...s.panels, [name]: value ?? !s.panels[name] } })),
      setDragging: (isDragging) => set((s) => (s.isDragging === isDragging ? s : { isDragging })),
      toggleKind: (kind) => set((s) => ({ hiddenKinds: s.hiddenKinds.includes(kind) ? s.hiddenKinds.filter((k) => k !== kind) : [...s.hiddenKinds, kind] })),
      clearHiddenKinds: () => set({ hiddenKinds: [] }),
      setGraphTab: (graphTab) => set((s) => ({ graphTab, panels: { ...s.panels, inventory: true } })),
      setGuides: (guides) => set((s) => (s.guides.x.length === 0 && s.guides.y.length === 0 && guides.x.length === 0 && guides.y.length === 0 ? s : { guides })),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      setContextMenu: (contextMenu) => set({ contextMenu }),
      setLens: (lens) => set({ lens }),
      setProposals: (proposals) => {
        const proposalsByEntity: Record<string, Proposal[]> = {};
        for (const p of proposals) for (const id of p.entityIds) (proposalsByEntity[id] ??= []).push(p);
        set({ proposals, proposalsByEntity });
      },
      presentStep: (delta) => {
        const s = get();
        const frames = presentationFrames(s.elements);
        if (frames.length === 0) return;
        const next = s.presentIndex === null ? (delta > 0 ? 0 : frames.length - 1) : (s.presentIndex + delta + frames.length) % frames.length;
        const f = frames[next]!;
        set({ presentIndex: next, camera: cameraToFitInsets({ x: f.x, y: f.y - 40, w: f.w, h: f.h + 40 }, s.viewport.w, s.viewport.h, { top: 40, bottom: 40, left: 40, right: 40 }, 2) });
      },
      setPresenting: (presenting) => {
        set({ presenting, presentIndex: null, selection: presenting ? [] : get().selection, editingId: null, contextMenu: null });
        // re-fit with the chrome gone (or back)
        requestAnimationFrame(() => get().zoomToFit());
      },
      saveViewpoint: (name) => {
        const s = get();
        const vp: SavedViewpoint = { id: `vp_${nanoid(8)}`, name: name.trim() || `View ${s.viewpoints.length + 1}`, hiddenKinds: [...s.hiddenKinds], camera: { ...s.camera }, createdAt: new Date().toISOString(), ...(s.lens.type !== "none" ? { lens: s.lens } : {}) };
        set({ viewpoints: [...s.viewpoints, vp], revision: s.revision + 1, saveState: "dirty" });
      },
      applyViewpoint: (id) => {
        const s = get();
        const vp = s.viewpoints.find((v) => v.id === id);
        if (!vp) return;
        set({ hiddenKinds: [...vp.hiddenKinds], lens: vp.lens ?? NO_LENS, ...(vp.camera ? { camera: { ...vp.camera } } : {}) });
      },
      deleteViewpoint: (id) => set((s) => ({ viewpoints: s.viewpoints.filter((v) => v.id !== id), revision: s.revision + 1, saveState: "dirty" })),
      focusElement: (id) => {
        const s = get();
        if (!s.elements[id]) return;
        const bounds = selectionBounds([id], s.elements);
        if (!bounds) return;
        set({ selection: [id], editingId: null, camera: cameraToFitInsets(bounds, s.viewport.w, s.viewport.h, fitInsets(s, 80), Math.max(1, s.camera.zoom)) });
      },

      // ---- selection ----
      select: (ids, additive = false) =>
        set((s) => ({ selection: additive ? [...new Set([...s.selection, ...ids])] : ids, editingId: null })),
      toggleSelect: (id) =>
        set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
      clearSelection: () => set({ selection: [], editingId: null }),
      selectAll: () => set((s) => ({ selection: Object.keys(s.elements) })),
      startEditing: (editingId) => {
        if (editingId) get().pushHistory();
        set({ editingId });
      },

      // ---- document ----
      addElements: (els, opts = {}) => {
        const s = get();
        const next = { ...s.elements };
        let z = nextZ(next);
        for (const el of els) next[el.id] = { ...el, z: el.z || z++ };
        mutate(next, opts.history ?? true, opts.select ? { selection: els.map((e) => e.id) } : {});
      },
      updateElements: (patch, opts = {}) => {
        const s = get();
        const next = { ...s.elements };
        let changed = false;
        for (const [id, p] of Object.entries(patch)) {
          const el = next[id];
          if (!el) continue;
          next[id] = { ...el, ...p } as CanvasElement;
          changed = true;
        }
        if (changed) mutate(next, opts.history ?? false);
      },
      replaceElements: (next, opts = {}) => mutate(next, opts.history ?? false),
      deleteElements: (ids, opts = {}) => {
        const s = get();
        const doomed = new Set(ids);
        // connectors attached to deleted elements go too
        for (const el of Object.values(s.elements)) {
          if (el.type !== "connector") continue;
          if (("elementId" in el.from && doomed.has(el.from.elementId)) || ("elementId" in el.to && doomed.has(el.to.elementId))) doomed.add(el.id);
        }
        if (doomed.size === 0) return;
        const next: Elements = {};
        for (const el of Object.values(s.elements)) if (!doomed.has(el.id)) next[el.id] = el;
        mutate(next, opts.history ?? true, { selection: s.selection.filter((id) => !doomed.has(id)), editingId: null });
      },
      convertNotesToCards: (ids) => {
        const s = get();
        const next: Elements = { ...s.elements };
        let changed = false;
        for (const id of ids) {
          const el = next[id];
          if (!el || el.type !== "sticky") continue;
          const [firstLine, ...rest] = el.text.split(/\r?\n/);
          const title = el.title.trim() || (firstLine ?? "").trim();
          const description = el.title.trim() ? el.text.trim() : rest.join("\n").trim();
          next[id] = { id, type: "card", x: el.x, y: el.y, w: Math.max(236, el.w), h: Math.max(124, el.h), z: el.z, kind: "", color: "#1376d4", title, description, meta: { ...(el.meta ?? {}), entityId: `ent_${nanoid(12)}` }, ...(el.locked ? { locked: true } : {}) };
          changed = true;
        }
        if (changed) mutate(next, true);
      },
      alignSelection: (mode) => {
        const s = get();
        const items = s.selection.map((id) => s.elements[id]).filter((el): el is BoxElement => !!el && isBoxElement(el) && !el.locked);
        const moves = mode === "distributeX" || mode === "distributeY" ? distributeBoxes(items, mode === "distributeX" ? "x" : "y") : alignBoxes(items, mode);
        if (Object.keys(moves).length === 0) return;
        const patch: Record<ElementId, Partial<CanvasElement>> = {};
        for (const [id, d] of Object.entries(moves)) {
          const carried = expandSelectionForMove([id], s.elements);
          for (const cid of carried) {
            const el = s.elements[cid];
            if (!el || !isBoxElement(el) || patch[cid]) continue;
            patch[cid] = { x: el.x + d.dx, y: el.y + d.dy };
          }
        }
        s.updateElements(patch, { history: true });
      },
      duplicateSelection: () => {
        const s = get();
        if (s.selection.length === 0) return;
        const idMap = new Map<ElementId, ElementId>();
        for (const id of s.selection) idMap.set(id, nanoid(10));
        const offset = 24;
        const clones: CanvasElement[] = [];
        let z = nextZ(s.elements);
        for (const id of s.selection) {
          const el = s.elements[id];
          if (!el) continue;
          const newId = idMap.get(id)!;
          if (isBoxElement(el)) {
            clones.push({ ...el, id: newId, x: el.x + offset, y: el.y + offset, z: z++ });
          } else {
            const remap = (end: ConnectorEnd): ConnectorEnd => {
              if ("elementId" in end) {
                const mapped = idMap.get(end.elementId);
                return mapped ? { elementId: mapped } : end;
              }
              return { point: { x: end.point.x + offset, y: end.point.y + offset } };
            };
            clones.push({ ...el, id: newId, from: remap(el.from), to: remap(el.to), z: z++ });
          }
        }
        const next = { ...s.elements };
        for (const c of clones) next[c.id] = c;
        mutate(next, true, { selection: clones.map((c) => c.id) });
      },
      bringToFront: (ids) => {
        const s = get();
        let z = nextZ(s.elements);
        const patch: Record<ElementId, Partial<CanvasElement>> = {};
        for (const id of ids) if (s.elements[id]) patch[id] = { z: z++ };
        s.updateElements(patch, { history: true });
      },
      sendToBack: (ids) => {
        const s = get();
        const others = Object.values(s.elements).filter((e) => !ids.includes(e.id));
        const min = others.length ? Math.min(...others.map((e) => e.z)) : 1;
        const patch: Record<ElementId, Partial<CanvasElement>> = {};
        let z = min - ids.length;
        for (const id of ids) if (s.elements[id]) patch[id] = { z: z++ };
        s.updateElements(patch, { history: true });
      },
      nudgeSelection: (dx, dy) => {
        const s = get();
        const ids = expandSelectionForMove(s.selection, s.elements);
        const patch: Record<ElementId, Partial<CanvasElement>> = {};
        for (const id of ids) {
          const el = s.elements[id];
          if (el && isBoxElement(el)) patch[id] = { x: el.x + dx, y: el.y + dy };
        }
        s.updateElements(patch, { history: true });
      },

      // ---- history ----
      pushHistory: (snapshot) => {
        const s = get();
        set({ past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot ?? s.elements], future: [] });
      },
      undo: () => {
        const s = get();
        const prev = s.past[s.past.length - 1];
        if (!prev) return;
        set({
          elements: prev,
          past: s.past.slice(0, -1),
          future: [s.elements, ...s.future],
          selection: s.selection.filter((id) => prev[id]),
          editingId: null,
          revision: s.revision + 1,
          saveState: "dirty",
        });
      },
      redo: () => {
        const s = get();
        const next = s.future[0];
        if (!next) return;
        set({
          elements: next,
          past: [...s.past, s.elements],
          future: s.future.slice(1),
          selection: s.selection.filter((id) => next[id]),
          editingId: null,
          revision: s.revision + 1,
          saveState: "dirty",
        });
      },

      toDocument: () => {
        const s = get();
        return s.viewpoints.length ? { version: DOCUMENT_VERSION, elements: s.elements, viewpoints: s.viewpoints } : { version: DOCUMENT_VERSION, elements: s.elements };
      },
    };
  });
  // The lens result is derived state: recompute it once whenever its inputs change, so every
  // card / connector can read a cheap per-id slice instead of running a graph walk itself.
  store.subscribe((s, prev) => {
    if (s.lens === prev.lens && s.elements === prev.elements && s.selection === prev.selection) return;
    if (s.lens.type === "none" && s.lensResult === null) return;
    store.setState({ lensResult: computeLens(s.lens, s.elements, s.selection) });
  });
  return store;
}

// ---- React binding -----------------------------------------------------------

export const CanvasStoreContext = createContext<CanvasStore | null>(null);

export function useCanvasStore(): CanvasStore {
  const store = useContext(CanvasStoreContext);
  if (!store) throw new Error("useCanvasStore must be used inside <CanvasStoreContext.Provider>");
  return store;
}

export function useCanvas<T>(selector: (s: CanvasState) => T): T {
  return useStore(useCanvasStore(), selector);
}
