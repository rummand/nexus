"use client";

import { useEffect } from "react";
import { nanoid } from "nanoid";
import type { CanvasElement, ConnectorEnd } from "../document";
import { isBoxElement } from "../document";
import { useCanvasStore, type Tool } from "../store";

const TOOL_KEYS: Record<string, Tool> = { v: "select", h: "hand", f: "frame", c: "card", n: "sticky", t: "text", s: "section", r: "rect", o: "ellipse", d: "diamond", l: "connector" };

const CLIPBOARD_MIME = "application/x-nexus-elements";
let internalClipboard: CanvasElement[] | null = null;

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

export function useKeyboard(enabled = true) {
  const store = useCanvasStore();

  useEffect(() => {
    if (!enabled) return;

    const copySelection = (): CanvasElement[] => {
      const s = store.getState();
      const set = new Set(s.selection);
      const out: CanvasElement[] = [];
      for (const id of s.selection) {
        const el = s.elements[id];
        if (!el) continue;
        if (el.type === "connector") {
          const okFrom = "point" in el.from || set.has(el.from.elementId);
          const okTo = "point" in el.to || set.has(el.to.elementId);
          if (!okFrom || !okTo) continue;
        }
        out.push(el);
      }
      internalClipboard = out;
      try {
        void navigator.clipboard?.writeText(JSON.stringify({ [CLIPBOARD_MIME]: out }));
      } catch {
        /* clipboard unavailable */
      }
      return out;
    };

    const paste = (items: CanvasElement[]) => {
      if (items.length === 0) return;
      const s = store.getState();
      const idMap = new Map<string, string>();
      for (const el of items) idMap.set(el.id, nanoid(10));
      // paste centred in the viewport
      const boxes = items.filter(isBoxElement);
      const minX = Math.min(...boxes.map((b) => b.x));
      const minY = Math.min(...boxes.map((b) => b.y));
      const maxX = Math.max(...boxes.map((b) => b.x + b.w));
      const maxY = Math.max(...boxes.map((b) => b.y + b.h));
      const centre = { x: (s.viewport.w / 2 - s.camera.x) / s.camera.zoom, y: (s.viewport.h / 2 - s.camera.y) / s.camera.zoom };
      const dx = boxes.length ? centre.x - (minX + maxX) / 2 : 0;
      const dy = boxes.length ? centre.y - (minY + maxY) / 2 : 0;
      const remap = (end: ConnectorEnd): ConnectorEnd =>
        "elementId" in end ? { elementId: idMap.get(end.elementId) ?? end.elementId } : { point: { x: end.point.x + dx, y: end.point.y + dy } };
      const clones = items.map<CanvasElement>((el) =>
        isBoxElement(el) ? { ...el, id: idMap.get(el.id)!, x: el.x + dx, y: el.y + dy, z: 0 } : { ...el, id: idMap.get(el.id)!, from: remap(el.from), to: remap(el.to), z: 0 },
      );
      s.addElements(clones, { select: true });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const s = store.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (isTypingTarget(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (s.editingId) return;

      // navigation
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); s.zoomAt({ x: s.viewport.w / 2, y: s.viewport.h / 2 }, 1.25); return; }
      if (mod && e.key === "-") { e.preventDefault(); s.zoomAt({ x: s.viewport.w / 2, y: s.viewport.h / 2 }, 0.8); return; }
      if (mod && e.code === "Digit0") { e.preventDefault(); s.zoomTo(1); return; }
      if ((mod || e.shiftKey) && e.code === "Digit1") { e.preventDefault(); s.zoomToFit(); return; }
      if ((mod || e.shiftKey) && e.code === "Digit2") { e.preventDefault(); s.zoomToSelection(); return; }

      // history
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); s.redo(); return; }

      // selection / clipboard
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); s.selectAll(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); s.duplicateSelection(); return; }
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); copySelection(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); const items = copySelection(); s.deleteElements(items.map((i) => i.id)); return; }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (internalClipboard) paste(internalClipboard);
        else
          navigator.clipboard?.readText().then((text) => {
            try {
              const parsed = JSON.parse(text) as Record<string, CanvasElement[]>;
              if (parsed[CLIPBOARD_MIME]) paste(parsed[CLIPBOARD_MIME]);
            } catch {
              /* not ours */
            }
          }).catch(() => undefined);
        return;
      }
      if (mod && e.key === "]") { e.preventDefault(); s.bringToFront(s.selection); return; }
      if (mod && e.key === "[") { e.preventDefault(); s.sendToBack(s.selection); return; }

      if (mod) return;

      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); s.deleteElements(s.selection); return; }
      if (s.presenting) {
        if (e.key === "Escape") { s.setPresenting(false); return; }
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown" || e.key === "Enter") { e.preventDefault(); s.presentStep(1); return; }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Backspace") { e.preventDefault(); s.presentStep(-1); return; }
        if (e.key === "Home") { e.preventDefault(); s.zoomToFit(); return; }
        return;
      }
      if (e.key === "Escape") {
        if (s.selection.length) s.clearSelection();
        else s.setTool("select");
        s.setPendingConnector(null);
        return;
      }
      if (e.key === "Enter" && s.selection.length === 1) {
        const el = s.elements[s.selection[0]!];
        if (el && !el.locked) { e.preventDefault(); s.startEditing(el.id); }
        return;
      }
      if (e.key.startsWith("Arrow") && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.nudgeSelection(dx, dy);
        return;
      }
      if (e.key === " ") {
        if (!s.spaceDown) s.setSpaceDown(true);
        e.preventDefault();
        return;
      }
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.altKey) {
        s.setTool(tool);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") store.getState().setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled, store]);
}
