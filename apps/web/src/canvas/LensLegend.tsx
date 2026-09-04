"use client";

import { NO_LENS } from "./lens";
import { useCanvas, useCanvasStore } from "./store";

/** Small screen-space card (bottom-left) that shows the active lens and its legend. */
export function LensLegend() {
  const store = useCanvasStore();
  const result = useCanvas((s) => s.lensResult);
  if (!result) return null;
  const title = result.lens.type === "impact" ? `Impact · ${result.lens.direction === "both" ? "both ways" : result.lens.direction === "out" ? "downstream" : "upstream"} · ${result.lens.depth} hop${result.lens.depth === 1 ? "" : "s"}` : `Colour by ${result.lens.key}`;
  return (
    <aside className="lens-legend" data-lens-legend onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={() => store.getState().setLens(NO_LENS)} aria-label="Clear lens">×</button>
      </header>
      <small>{result.summary}</small>
      {result.legend.length > 0 && (
        <div className="lens-legend-items">
          {result.legend.slice(0, 12).map((entry) => (
            <button key={entry.value} type="button" onClick={() => store.getState().select(entry.ids)} title="Select these cards">
              <i style={{ background: entry.color }} />
              <span>{entry.value}</span>
              <b>{entry.count}</b>
            </button>
          ))}
          {result.legend.length > 12 && <em>+{result.legend.length - 12} more</em>}
        </div>
      )}
    </aside>
  );
}
