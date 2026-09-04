"use client";

import { useEffect, type RefObject } from "react";
import { useCanvasStore } from "../store";

/**
 * Wheel navigation, attached natively (non-passive) so we can prevent browser zoom/scroll.
 *
 * - ctrl/⌘ + wheel, or trackpad pinch (browsers report pinch as ctrl+wheel) → zoom at cursor
 * - scroll mode "pan": wheel pans (two-finger scroll on trackpads); shift+wheel pans horizontally
 * - scroll mode "zoom": wheel zooms; shift+wheel pans horizontally
 */
export function useWheel(rootRef: RefObject<HTMLDivElement | null>) {
  const store = useCanvasStore();
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Wheel events arrive far faster than frames; accumulate and apply once per animation
    // frame so the store (and every subscriber) updates at most 60×/s.
    let pending = { dx: 0, dy: 0, zoom: 1, anchor: { x: 0, y: 0 } };
    let raf = 0;
    const flush = () => {
      raf = 0;
      const s = store.getState();
      const { dx, dy, zoom, anchor } = pending;
      pending = { dx: 0, dy: 0, zoom: 1, anchor };
      if (zoom !== 1) s.zoomAt(anchor, zoom);
      if (dx || dy) s.panBy(-dx, -dy);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = store.getState();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // normalise line/page deltas to pixels
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      let dx = e.deltaX * scale;
      let dy = e.deltaY * scale;

      const zoomGesture = e.ctrlKey || e.metaKey || (s.scrollMode === "zoom" && !e.shiftKey);
      if (zoomGesture) {
        // pinch deltas are small; mouse wheels are ±100 — exp keeps both smooth
        pending.zoom *= Math.exp(-dy * (e.ctrlKey && Math.abs(dy) < 50 ? 0.01 : 0.0025));
        pending.anchor = anchor;
      } else {
        if (e.shiftKey && dx === 0) {
          dx = dy;
          dy = 0;
        }
        pending.dx += dx;
        pending.dy += dy;
      }
      if (!raf) raf = requestAnimationFrame(flush);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef, store]);
}
