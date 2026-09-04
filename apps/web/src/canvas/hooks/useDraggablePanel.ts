"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** Drag a floating panel by its title bar; position is clamped to the viewport root. */
export function useDraggablePanel(rootRef: RefObject<HTMLDivElement | null>, initial: { x?: number; y?: number; right?: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  // Resolve an initial right-anchored position once the root is measured.
  useEffect(() => {
    if (pos) return;
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const pw = panelRef.current?.offsetWidth ?? 270;
    setPos({ x: initial.right !== undefined ? Math.max(8, w - initial.right - pw) : initial.x ?? 12, y: initial.y ?? 76 });
  }, [pos, rootRef, initial.right, initial.x, initial.y]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest("button, input, select, textarea")) return;
      e.preventDefault();
      e.stopPropagation();
      const p = pos ?? { x: 0, y: 0 };
      drag.current = { dx: e.clientX - p.x, dy: e.clientY - p.y };
      const move = (ev: PointerEvent) => {
        if (!drag.current) return;
        const root = rootRef.current;
        const maxX = (root?.clientWidth ?? 1e9) - 60;
        const maxY = (root?.clientHeight ?? 1e9) - 40;
        setPos({ x: Math.min(maxX, Math.max(0, ev.clientX - drag.current.dx)), y: Math.min(maxY, Math.max(0, ev.clientY - drag.current.dy)) });
      };
      const up = () => {
        drag.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [pos, rootRef],
  );

  return { pos, onPointerDown, panelRef };
}
