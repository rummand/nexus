"use client";

import { worldToScreen } from "./geometry";
import { useCanvas } from "./store";

/** Smart alignment guides shown while dragging (screen space). */
export function GuidesOverlay() {
  const guides = useCanvas((s) => s.guides);
  const camera = useCanvas((s) => s.camera);
  if (guides.x.length === 0 && guides.y.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9 }}>
      {guides.x.map((x) => <div key={`x${x}`} className="snap-guide vertical" style={{ left: worldToScreen({ x, y: 0 }, camera).x }} />)}
      {guides.y.map((y) => <div key={`y${y}`} className="snap-guide horizontal" style={{ top: worldToScreen({ x: 0, y }, camera).y }} />)}
    </div>
  );
}
