"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "./store";

/**
 * Background grid drawn on a <canvas>, redrawn at most once per animation frame straight from
 * the store (no React re-render). Major lines every 4 minor steps; the minor step adapts to
 * zoom so lines stay between ~14 and ~56 screen px apart.
 */
export function GridCanvas() {
  const store = useCanvasStore();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      raf = 0;
      const { camera, viewport } = store.getState();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(viewport.w));
      const h = Math.max(1, Math.round(viewport.h));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      let step = 20;
      while (step * camera.zoom < 14) step *= 2;
      while (step * camera.zoom > 56) step /= 2;
      const minor = step * camera.zoom;
      const major = minor * 4;
      const drawLines = (spacing: number, color: string) => {
        ctx.beginPath();
        const ox = ((camera.x % spacing) + spacing) % spacing;
        const oy = ((camera.y % spacing) + spacing) % spacing;
        for (let x = ox; x <= w; x += spacing) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
        for (let y = oy; y <= h; y += spacing) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      };
      drawLines(minor, "#f1f4f8");
      drawLines(major, "#e6ecf4");
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    schedule();
    const unsub = store.subscribe((s, prev) => { if (s.camera !== prev.camera || s.viewport !== prev.viewport) schedule(); });
    return () => { unsub(); if (raf) cancelAnimationFrame(raf); };
  }, [store]);

  return <canvas ref={ref} className="grid-canvas" aria-hidden />;
}
