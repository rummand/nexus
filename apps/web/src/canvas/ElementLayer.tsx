"use client";

import { memo, useMemo } from "react";
import { isBoxElement } from "./document";
import { boxesIntersect, visibleWorldRect } from "./geometry";
import { useCanvas } from "./store";
import { ElementView } from "./elements/ElementView";

const CULL_MARGIN = 300; // screen px
const QUANTUM = 240; // screen px — the culling rect only changes when the camera moves this far

/**
 * Renders box elements that intersect the (generously padded) viewport; frames first, then by
 * z. The culling rectangle is quantised so small pans/zooms do not re-render the layer at all.
 */
export const ElementLayer = memo(function ElementLayer() {
  const elements = useCanvas((s) => s.elements);
  const cullKey = useCanvas((s) => {
    const vis = visibleWorldRect(s.camera, s.viewport.w, s.viewport.h);
    const q = QUANTUM / s.camera.zoom;
    const x = Math.floor((vis.x - CULL_MARGIN / s.camera.zoom) / q) * q;
    const y = Math.floor((vis.y - CULL_MARGIN / s.camera.zoom) / q) * q;
    const w = Math.ceil((vis.w + (2 * CULL_MARGIN) / s.camera.zoom) / q + 1) * q;
    const h = Math.ceil((vis.h + (2 * CULL_MARGIN) / s.camera.zoom) / q + 1) * q;
    return `${x}|${y}|${w}|${h}`;
  });
  const editingId = useCanvas((s) => s.editingId);

  const ids = useMemo(() => {
    const [x, y, w, h] = cullKey.split("|").map(Number) as [number, number, number, number];
    const rect = { x, y, w, h };
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
    return [...frames.map((f) => f.id), ...others.map((o) => o.id)].join("\n");
  }, [elements, cullKey, editingId]);

  // The children array is memoised on the *list of ids*, so moving an object (which changes
  // `elements` on every pointer move) does not recreate 400 React elements per frame — React sees
  // the same element references and bails out of the whole subtree.
  const children = useMemo(() => (ids ? ids.split("\n") : []).map((id) => <ElementView key={id} id={id} />), [ids]);

  return <>{children}</>;
});
