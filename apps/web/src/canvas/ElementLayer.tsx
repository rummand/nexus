"use client";

import { useMemo } from "react";
import { isBoxElement } from "./document";
import { boxesIntersect, visibleWorldRect } from "./geometry";
import { useCanvas } from "./store";
import { ElementView } from "./elements/ElementView";

const CULL_MARGIN = 200; // world units

/** Renders box elements that intersect the viewport; frames first, then by z. */
export function ElementLayer() {
  const elements = useCanvas((s) => s.elements);
  const camera = useCanvas((s) => s.camera);
  const viewport = useCanvas((s) => s.viewport);
  const editingId = useCanvas((s) => s.editingId);

  const ids = useMemo(() => {
    const vis = visibleWorldRect(camera, viewport.w, viewport.h);
    const rect = { x: vis.x - CULL_MARGIN / camera.zoom, y: vis.y - CULL_MARGIN / camera.zoom, w: vis.w + (2 * CULL_MARGIN) / camera.zoom, h: vis.h + (2 * CULL_MARGIN) / camera.zoom };
    const frames: Array<{ id: string; z: number }> = [];
    const others: Array<{ id: string; z: number }> = [];
    for (const el of Object.values(elements)) {
      if (!isBoxElement(el)) continue;
      // frame titles hang 30px above the box
      const bounds = el.type === "frame" ? { x: el.x, y: el.y - 40, w: el.w, h: el.h + 40 } : el;
      if (!boxesIntersect(rect, bounds) && el.id !== editingId) continue;
      (el.type === "frame" ? frames : others).push({ id: el.id, z: el.z });
    }
    frames.sort((a, b) => a.z - b.z);
    others.sort((a, b) => a.z - b.z);
    return [...frames.map((f) => f.id), ...others.map((o) => o.id)];
  }, [elements, camera, viewport, editingId]);

  return (
    <>
      {ids.map((id) => (
        <ElementView key={id} id={id} />
      ))}
    </>
  );
}
