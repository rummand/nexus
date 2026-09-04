"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { nanoid } from "nanoid";
import type { Box, CanvasElement, ElementId, Point } from "../document";
import { isBoxElement, NOTE_COLORS, TEXT_COLORS, cardColorForKind } from "../document";
import { boxesIntersect, boxContainsBox, elementBounds, type HandleId, normalizeBox, resizeBox, screenToWorld, snapToBoxes, unionBoxes } from "../geometry";
import { expandSelectionForMove, useCanvasStore, type CanvasState, type Tool } from "../store";
import { ENTITY_ID_PREFIX, isEntityId, RELATION_ID_PREFIX } from "@/lib/graph-types";

type Elements = CanvasState["elements"];

type Session =
  | { kind: "pan"; last: Point }
  | { kind: "marquee"; start: Point; additive: boolean; base: ElementId[] }
  | { kind: "move"; start: Point; ids: ElementId[]; origins: Record<ElementId, Point>; before: Elements; moved: boolean; clickedId: ElementId }
  | { kind: "resize"; id: ElementId; handle: HandleId; start: Point; startBox: Box; before: Elements }
  | { kind: "draw"; id: ElementId; tool: Tool; start: Point; before: Elements }
  | { kind: "connect"; fromId: ElementId; before: Elements };

const DRAG_THRESHOLD = 3; // screen px before a click becomes a drag

export const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  card: { w: 236, h: 124 },
  sticky: { w: 300, h: 150 },
  text: { w: 300, h: 140 },
  section: { w: 480, h: 110 },
  rect: { w: 200, h: 110 },
  ellipse: { w: 180, h: 120 },
  diamond: { w: 180, h: 140 },
  frame: { w: 640, h: 420 },
};

export function elementIdFromTarget(target: EventTarget | null): ElementId | null {
  if (!(target instanceof Element)) return null;
  const hit = target.closest<HTMLElement>("[data-element-id]");
  return hit?.dataset.elementId ?? null;
}

function elementIdAtPoint(clientX: number, clientY: number, exclude?: ElementId): ElementId | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    const hit = node.closest<HTMLElement>("[data-element-id]");
    if (hit?.dataset.elementId && hit.dataset.elementId !== exclude && hit.dataset.connectable !== "false") return hit.dataset.elementId;
  }
  return null;
}

export interface CanvasInteraction {
  onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerUp(e: ReactPointerEvent<HTMLDivElement>): void;
  onDoubleClick(e: ReactPointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>): void;
  onContextMenu(e: React.MouseEvent<HTMLDivElement>): void;
  /** Called by the selection overlay's resize handles. */
  beginResize(id: ElementId, handle: HandleId, e: ReactPointerEvent): void;
  cursor: string;
}

export function useCanvasInteraction(rootRef: RefObject<HTMLDivElement | null>): CanvasInteraction {
  const store = useCanvasStore();
  const session = useRef<Session | null>(null);
  const downScreen = useRef<Point>({ x: 0, y: 0 });

  const toScreen = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = rootRef.current?.getBoundingClientRect();
      return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
    },
    [rootRef],
  );
  const toWorld = useCallback((e: { clientX: number; clientY: number }) => screenToWorld(toScreen(e), store.getState().camera), [store, toScreen]);

  const capture = useCallback(
    (e: ReactPointerEvent) => {
      try {
        rootRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [rootRef],
  );

  const createForTool = (tool: Tool, at: Point): CanvasElement | null => {
    const id = nanoid(10);
    const size = DEFAULT_SIZES[tool] ?? { w: 100, h: 100 };
    const centred = { x: at.x - size.w / 2, y: at.y - size.h / 2, w: size.w, h: size.h };
    switch (tool) {
      case "card":
        return { id, type: "card", ...centred, kind: "Application", color: cardColorForKind("Application"), title: "", description: "", z: 0, meta: { entityId: `${ENTITY_ID_PREFIX}${nanoid(12)}` } };
      case "sticky":
        return { id, type: "sticky", ...centred, title: "", text: "", color: NOTE_COLORS[0], z: 0 };
      case "text":
        return { id, type: "text", variant: "text", ...centred, title: "", text: "", color: TEXT_COLORS[0], z: 0 };
      case "section":
        return { id, type: "text", variant: "section", ...centred, title: "", text: "", color: TEXT_COLORS[0], z: 0 };
      case "rect":
      case "ellipse":
      case "diamond":
        return { id, type: "shape", shape: tool, x: at.x, y: at.y, w: 0, h: 0, text: "", fill: "#FFFFFF", stroke: "#475569", z: 0 };
      case "frame":
        return { id, type: "frame", x: at.x, y: at.y, w: 0, h: 0, title: "Frame", color: "#1376d4", z: 0 };
      default:
        return null;
    }
  };

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = store.getState();
      if (s.contextMenu) s.setContextMenu(null);
      if (e.button === 2) return; // handled by onContextMenu
      const screen = toScreen(e);
      const world = screenToWorld(screen, s.camera);
      downScreen.current = screen;
      const hitId = elementIdFromTarget(e.target);

      // Leave text editing when clicking anywhere outside the edited element.
      if (s.editingId && hitId !== s.editingId) {
        s.startEditing(null);
      }
      if (s.editingId && hitId === s.editingId) return; // let the textarea handle it

      const wantsPan = e.button === 1 || s.spaceDown || s.tool === "hand";
      if (wantsPan) {
        e.preventDefault();
        capture(e);
        session.current = { kind: "pan", last: screen };
        s.setDragging(true);
        return;
      }
      if (e.button !== 0) return;

      // Pointer down inside a live text field: select the owning object, let the field work.
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        if (hitId && s.elements[hitId] && !s.selection.includes(hitId)) s.select([hitId]);
        return;
      }

      switch (s.tool) {
        case "select": {
          capture(e);
          if (hitId && s.elements[hitId]) {
            const el = s.elements[hitId]!;
            if (el.locked) {
              s.select([hitId]);
              return;
            }
            if (e.shiftKey) s.toggleSelect(hitId);
            else if (!s.selection.includes(hitId)) s.select([hitId]);
            const sel = store.getState().selection;
            const ids = expandSelectionForMove(sel, s.elements);
            const origins: Record<ElementId, Point> = {};
            for (const id of ids) {
              const target = s.elements[id];
              if (target && isBoxElement(target)) origins[id] = { x: target.x, y: target.y };
              else if (target && target.type === "connector") {
                // free endpoints move with the selection
                if ("point" in target.from) origins[`${id}:from`] = target.from.point;
                if ("point" in target.to) origins[`${id}:to`] = target.to.point;
              }
            }
            session.current = { kind: "move", start: world, ids, origins, before: s.elements, moved: false, clickedId: hitId };
          } else {
            const additive = e.shiftKey;
            if (!additive) s.clearSelection();
            session.current = { kind: "marquee", start: world, additive, base: additive ? s.selection : [] };
          }
          return;
        }
        case "card":
        case "sticky":
        case "text":
        case "section": {
          const el = createForTool(s.tool, world);
          if (!el) return;
          s.addElements([el], { select: true });
          s.setTool("select");
          // mark as freshly created so the title field takes focus
          store.getState().startEditing(el.id);
          return;
        }
        case "rect":
        case "ellipse":
        case "diamond":
        case "frame": {
          const el = createForTool(s.tool, world);
          if (!el) return;
          capture(e);
          const before = s.elements;
          s.addElements([el], { select: false, history: false });
          session.current = { kind: "draw", id: el.id, tool: s.tool, start: world, before };
          return;
        }
        case "connector": {
          if (!hitId || !s.elements[hitId] || !isBoxElement(s.elements[hitId]!)) return;
          capture(e);
          s.setPendingConnector({ from: hitId, to: world });
          session.current = { kind: "connect", fromId: hitId, before: s.elements };
          return;
        }
      }
    },
    [store, toScreen, capture],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = store.getState();
      const ses = session.current;
      if (!ses) {
        // hover tracking
        const id = elementIdFromTarget(e.target);
        s.setHover(id);
        return;
      }
      const screen = toScreen(e);
      const world = screenToWorld(screen, s.camera);

      switch (ses.kind) {
        case "pan": {
          s.panBy(screen.x - ses.last.x, screen.y - ses.last.y);
          ses.last = screen;
          return;
        }
        case "marquee": {
          const box = normalizeBox(ses.start, world);
          s.setMarquee(box);
          const picked: ElementId[] = [];
          for (const el of Object.values(s.elements)) {
            const b = elementBounds(el, s.elements);
            if (!b) continue;
            // frames must be fully enclosed; everything else just needs to intersect
            const ok = el.type === "frame" ? boxContainsBox(box, b) : boxesIntersect(box, b);
            if (ok) picked.push(el.id);
          }
          s.select([...new Set([...ses.base, ...picked])]);
          return;
        }
        case "move": {
          if (!ses.moved) {
            const d = Math.hypot(screen.x - downScreen.current.x, screen.y - downScreen.current.y);
            if (d < DRAG_THRESHOLD) return;
            ses.moved = true;
          }
          s.setDragging(true);
          let dx = world.x - ses.start.x;
          let dy = world.y - ses.start.y;
          // smart guides: snap the moving group's bounds to other objects (Alt disables)
          if (s.snapEnabled && !e.altKey) {
            const movingIds = new Set(ses.ids);
            const movingBoxes = ses.ids.map((id) => { const el = s.elements[id]; const o = ses.origins[id]; return el && isBoxElement(el) && o ? { x: o.x + dx, y: o.y + dy, w: el.w, h: el.h } : null; }).filter((b): b is { x: number; y: number; w: number; h: number } => !!b);
            const group = unionBoxes(movingBoxes);
            if (group) {
              const others = Object.values(s.elements).filter(isBoxElement).filter((el) => !movingIds.has(el.id) && el.type !== "frame").map((el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }));
              const snap = snapToBoxes(group, others, 6 / s.camera.zoom);
              dx += snap.dx;
              dy += snap.dy;
              s.setGuides({ x: snap.guidesX, y: snap.guidesY });
            }
          } else s.setGuides({ x: [], y: [] });
          const next: Elements = { ...s.elements };
          for (const id of ses.ids) {
            const el = next[id];
            if (!el) continue;
            if (isBoxElement(el)) {
              const o = ses.origins[id];
              if (o) next[id] = { ...el, x: o.x + dx, y: o.y + dy };
            } else {
              let c = el;
              const of = ses.origins[`${id}:from`];
              const ot = ses.origins[`${id}:to`];
              if (of) c = { ...c, from: { point: { x: of.x + dx, y: of.y + dy } } };
              if (ot) c = { ...c, to: { point: { x: ot.x + dx, y: ot.y + dy } } };
              next[id] = c;
            }
          }
          s.replaceElements(next);
          return;
        }
        case "resize": {
          const dx = world.x - ses.start.x;
          const dy = world.y - ses.start.y;
          const box = resizeBox(ses.startBox, ses.handle, dx, dy, e.shiftKey);
          s.updateElements({ [ses.id]: box });
          return;
        }
        case "draw": {
          const box = normalizeBox(ses.start, world);
          s.updateElements({ [ses.id]: box });
          return;
        }
        case "connect": {
          s.setPendingConnector({ from: ses.fromId, to: world });
          const over = elementIdAtPoint(e.clientX, e.clientY, ses.fromId);
          s.setHover(over);
          return;
        }
      }
    },
    [store, toScreen],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = store.getState();
      const ses = session.current;
      session.current = null;
      s.setDragging(false);
      s.setGuides({ x: [], y: [] });
      try {
        rootRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!ses) return;

      switch (ses.kind) {
        case "marquee":
          s.setMarquee(null);
          return;
        case "move": {
          if (ses.moved) s.pushHistory(ses.before);
          return;
        }
        case "resize": {
          s.pushHistory(ses.before);
          return;
        }
        case "draw": {
          const el = s.elements[ses.id];
          if (!el || !isBoxElement(el)) return;
          const size = DEFAULT_SIZES[ses.tool] ?? { w: 120, h: 80 };
          let final = el;
          if (el.w < 8 || el.h < 8) {
            // click without drag: default size centred on the click
            final = { ...el, x: ses.start.x - size.w / 2, y: ses.start.y - size.h / 2, w: size.w, h: size.h };
          }
          const next = { ...s.elements, [ses.id]: final };
          s.replaceElements(next);
          s.pushHistory(ses.before);
          s.select([ses.id]);
          s.setTool("select");
          return;
        }
        case "connect": {
          const world = toWorld(e);
          const toId = elementIdAtPoint(e.clientX, e.clientY, ses.fromId);
          s.setPendingConnector(null);
          s.setHover(null);
          const fromEl = s.elements[ses.fromId];
          if (!fromEl) return;
          const distance = Math.hypot(e.clientX - (downScreen.current.x + (rootRef.current?.getBoundingClientRect().left ?? 0)), e.clientY - (downScreen.current.y + (rootRef.current?.getBoundingClientRect().top ?? 0)));
          if (!toId && distance < DRAG_THRESHOLD * 3) return; // a plain click on an element: nothing to connect
          const toEl = toId ? s.elements[toId] : undefined;
          const graphBacked = fromEl.type === "card" && isEntityId(fromEl.meta?.entityId) && toEl?.type === "card" && isEntityId(toEl.meta?.entityId);
          const connector: CanvasElement = {
            id: nanoid(10),
            type: "connector",
            ...(graphBacked ? { meta: { relationId: `${RELATION_ID_PREFIX}${nanoid(12)}` } } : {}),
            from: { elementId: ses.fromId },
            to: toId && s.elements[toId] && isBoxElement(s.elements[toId]!) ? { elementId: toId } : { point: world },
            label: "",
            stroke: "#475569",
            style: s.connectorPreset === "dashed" ? "dashed" : "solid",
            arrowEnd: s.connectorPreset !== "line",
            arrowStart: false,
            z: 0,
          };
          s.addElements([connector], { select: true });
          return;
        }
        case "pan":
          return;
      }
    },
    [rootRef, store, toWorld],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const s = store.getState();
      const hitId = elementIdFromTarget(e.target);
      if (hitId && s.elements[hitId] && s.tool === "select") {
        const el = s.elements[hitId]!;
        if (el.locked || el.type !== "shape") return;
        s.select([hitId]);
        s.startEditing(hitId);
      } else if (!hitId && s.tool === "select") {
        // double-click on empty canvas: quick sticky
        const world = toWorld(e);
        const el = createForTool("sticky", world);
        if (el) {
          s.addElements([el], { select: true });
          store.getState().startEditing(el.id);
        }
      }
    },
    [store, toWorld],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const s = store.getState();
      const hitId = elementIdFromTarget(e.target);
      const screen = toScreen(e);
      if (hitId && s.elements[hitId] && !s.selection.includes(hitId)) s.select([hitId]);
      s.setContextMenu({ x: screen.x, y: screen.y, targetId: hitId, world: screenToWorld(screen, s.camera) });
    },
    [store, toScreen],
  );

  const beginResize = useCallback(
    (id: ElementId, handle: HandleId, e: ReactPointerEvent) => {
      const s = store.getState();
      const el = s.elements[id];
      if (!el || !isBoxElement(el)) return;
      e.stopPropagation();
      e.preventDefault();
      capture(e);
      session.current = { kind: "resize", id, handle, start: toWorld(e), startBox: { x: el.x, y: el.y, w: el.w, h: el.h }, before: s.elements };
    },
    [store, toWorld, capture],
  );

  // Cancel any session on window blur / escape.
  useEffect(() => {
    const cancel = () => {
      const ses = session.current;
      session.current = null;
      const s = store.getState();
      s.setMarquee(null);
      s.setPendingConnector(null);
      if (ses && (ses.kind === "move" || ses.kind === "resize" || ses.kind === "draw")) s.replaceElements(ses.before);
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [store]);

  const tool = store.getState().tool;
  const cursor = tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";
  void cursor;

  return { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onContextMenu, beginResize, cursor };
}
