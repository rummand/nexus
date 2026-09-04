"use client";

import { NO_LENS } from "./lens";
import { useCanvas, useCanvasStore } from "./store";

/** Small screen-space card (bottom-left) that shows the active lens and its legend. */
export function LensLegend() {
  const store = useCanvasStore();
  const result = useCanvas((s) => s.lensResult);
  if (!result) return null;
  const lens = result.lens;
  const title = lens.type === "impact" ? `Impact · ${lens.direction === "both" ? "both ways" : lens.direction === "out" ? "downstream" : "upstream"} · ${lens.depth} hop${lens.depth === 1 ? "" : "s"}` : lens.type === "attribute" ? `Colour by ${lens.key}` : "Relation types";
  const onEntry = (entry: { value: string; ids: string[] }) => {
    const s = store.getState();
    if (lens.type === "relation") s.setLens({ type: "relation", hidden: lens.hidden.includes(entry.value) ? lens.hidden.filter((h) => h !== entry.value) : [...lens.hidden, entry.value] });
    else s.select(entry.ids);
  };
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
            <button key={entry.value} type="button" className={entry.hidden ? "hidden-entry" : ""} onClick={() => onEntry(entry)} title={lens.type === "relation" ? (entry.hidden ? "Show this relation type" : "Hide this relation type") : "Select these cards"}>
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
