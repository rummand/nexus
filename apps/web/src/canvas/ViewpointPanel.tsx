"use client";

import { useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import type { QueryResponse } from "@/lib/graph-types";
import { cardColorForKind, isBoxElement } from "./document";
import { attributeKeysOnBoard, NO_LENS, relationKindsOnBoard } from "./lens";
import { useCanvas, useCanvasStore } from "./store";
import { useGraphActions } from "./hooks/useGraphActions";
import { isEntityId } from "@/lib/graph-types";

/** Viewpoint tab (LeanFlow "Graph viewpoint"): expand, relations, layout, kind lens. */
export function ViewpointPanel() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const hiddenKinds = useCanvas((s) => s.hiddenKinds);
  const saved = useCanvas((s) => s.viewpoints);
  const lens = useCanvas((s) => s.lens);
  const lensResult = useCanvas((s) => s.lensResult);
  const attributeKeys = useMemo(() => attributeKeysOnBoard(elements), [elements]);
  const [viewName, setViewName] = useState("");
  const { busy, showRelations, expandSelection, arrangeByKind, arrangeByAttribute, distributeSelection } = useGraphActions();
  const [groupKey, setGroupKey] = useState("");
  const [queryText, setQueryText] = useState(lens.type === "query" ? lens.q : "");
  const [queryHits, setQueryHits] = useState<QueryResponse["entities"] | null>(null);
  const workspaceId = useCanvas((s) => s.workspaceId);
  const lensQuery = lens.type === "query" ? lens.q : null;
  // Living query: (re)run whenever the query lens's text changes — including when a saved view applies it.
  useEffect(() => {
    if (lensQuery === null) return;
    let cancelled = false;
    fetch("/api/graph/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, q: lensQuery }) })
      .then((r) => (r.ok ? (r.json() as Promise<QueryResponse>) : null))
      .then((res) => {
        if (cancelled || !res) return;
        setQueryHits(res.entities);
        const st = store.getState();
        const ids = res.entities.map((e) => e.id);
        if (st.lens.type === "query" && st.lens.q === lensQuery && (st.lens.entityIds.length !== ids.length || st.lens.entityIds.some((id, i) => id !== ids[i]))) st.setLens({ type: "query", q: lensQuery, entityIds: ids });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [lensQuery, workspaceId, store]);
  const runQueryLens = () => { const q = queryText.trim(); if (q) store.getState().setLens({ type: "query", q, entityIds: lens.type === "query" && lens.q === q ? lens.entityIds : [] }); };
  const placeMissing = () => {
    if (!queryHits || lens.type !== "query") return;
    const s = store.getState();
    const onBoard = new Set(Object.values(s.elements).map((el) => (el.type === "card" ? el.meta?.entityId : undefined)));
    const fresh = queryHits.filter((e) => !onBoard.has(e.id));
    if (!fresh.length) return;
    const centre = { x: (s.viewport.w / 2 - s.camera.x) / s.camera.zoom, y: (s.viewport.h / 2 - s.camera.y) / s.camera.zoom };
    const perRow = Math.max(1, Math.ceil(Math.sqrt(fresh.length)));
    const w = 236, h = 124, gap = 24;
    const totalW = perRow * w + (perRow - 1) * gap, totalH = Math.ceil(fresh.length / perRow) * h + (Math.ceil(fresh.length / perRow) - 1) * gap;
    s.addElements(fresh.map((e, i) => ({ id: nanoid(10), type: "card" as const, x: centre.x - totalW / 2 + (i % perRow) * (w + gap), y: centre.y - totalH / 2 + Math.floor(i / perRow) * (h + gap), w, h, kind: e.kind, color: cardColorForKind(e.kind), title: e.name, description: e.description, attributes: e.attributes, z: 0, meta: { entityId: e.id } })), { select: true });
    setStatus(`Placed ${fresh.length}`);
  };
  const relationKinds = useMemo(() => relationKindsOnBoard(elements), [elements]);
  const [depth, setDepthState] = useState(1);
  const [direction, setDirectionState] = useState<"both" | "out" | "in">("both");
  const setDepth = (d: number) => { setDepthState(d); if (lens.type === "impact") store.getState().setLens({ ...lens, depth: d }); };
  const setDirection = (d: "both" | "out" | "in") => { setDirectionState(d); if (lens.type === "impact") store.getState().setLens({ ...lens, direction: d }); };
  const [status, setStatus] = useState<string | null>(null);

  /**
   * Which state of the model this board is showing (§5.21).
   *
   * As-is is the document as saved; a change set tints the cards it touches. Nothing here edits
   * the board — except "Place them", which says so, because putting a planned system on a board
   * really is an edit and pretending otherwise would be worse than asking.
   */
  const overlay = useCanvas((s2) => s2.changeOverlay);
  const [changeSets, setChangeSets] = useState<Array<{ id: string; name: string; status: string; targetDate: string }>>([]);
  const [plateaus, setPlateaus] = useState<Array<{ id: string; name: string; targetDate: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/change-sets?workspaceId=${encodeURIComponent(workspaceId)}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ changeSets: Array<{ id: string; name: string; status: string; targetDate: string }> }>) : null))
        .then((res) => { if (!cancelled && res) setChangeSets(res.changeSets); }),
      fetch(`/api/plateaus?workspaceId=${encodeURIComponent(workspaceId)}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ plateaus: Array<{ id: string; name: string; targetDate: string }> }>) : null))
        .then((res) => { if (!cancelled && res) setPlateaus(res.plateaus); }),
    ]).catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId]);

  /** `value` is "" for as-is, "chg:<id>" for one plan, or "plt:<id>" for a named state. */
  const showState = async (value: string) => {
    const s2 = store.getState();
    if (!value) { s2.setChangeOverlay(null); setStatus("Showing the estate as it is"); return; }
    const [kind, id] = value.split(":");
    const res = await fetch(kind === "plt" ? `/api/plateaus/${id}/overlay` : `/api/change-sets/${id}/overlay`).catch(() => null);
    if (!res?.ok) { setStatus("Could not load that change set"); return; }
    const data = (await res.json()) as { id: string; name: string; targetDate: string; retired: string[]; changed: string[]; added: Array<{ id: string; name: string; kind: string; description: string }>; impact: string };
    s2.setChangeOverlay({ id: value, name: data.name, targetDate: data.targetDate, retired: new Set(data.retired), changed: new Set(data.changed), added: data.added, impact: data.impact });
    setStatus(`Showing “${data.name}”`);
  };

  const onBoardEntityIds = useMemo(
    () => new Set(Object.values(elements).map((el) => (el.type === "card" && typeof el.meta?.entityId === "string" ? el.meta.entityId : "")).filter(Boolean)),
    [elements],
  );
  const missing = overlay ? overlay.added.filter((a) => !onBoardEntityIds.has(a.id)) : [];
  const placePlanned = () => {
    if (!missing.length) return;
    const s2 = store.getState();
    // Below what is already there, not in the middle of it: a planned card dropped on top of the
    // current landscape reads as an edit to the landscape.
    const boxes = Object.values(s2.elements).filter(isBoxElement);
    const bottom = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) : 0;
    const left = boxes.length ? Math.min(...boxes.map((b) => b.x)) : 0;
    const w = 236, h = 124, gap = 24;
    const perRow = Math.max(1, Math.min(4, missing.length));
    s2.addElements(
      missing.map((e, i) => ({
        id: nanoid(10), type: "card" as const,
        x: left + (i % perRow) * (w + gap), y: bottom + 90 + Math.floor(i / perRow) * (h + gap),
        w, h, kind: e.kind, color: cardColorForKind(e.kind), title: e.name, description: e.description, z: 0,
        // `planned` keeps the graph out of it: the sync skips these cards, so drawing an
        // intention cannot create the system. The mark clears itself when the plan is delivered.
        meta: { entityId: e.id, planned: overlay?.id ?? true },
      })),
      { select: true },
    );
    setStatus(`Placed ${missing.length} planned object${missing.length === 1 ? "" : "s"} — not in the graph until the change set is delivered`);
  };

  const stats = useMemo(() => {
    const cards = Object.values(elements).filter((e) => e.type === "card");
    const linked = cards.filter((c) => isEntityId(c.meta?.entityId)).length;
    const kinds = new Map<string, number>();
    for (const c of cards) if (c.type === "card") kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    const connectors = Object.values(elements).filter((e) => e.type === "connector").length;
    const relLinked = Object.values(elements).filter((e) => e.type === "connector" && typeof e.meta?.relationId === "string").length;
    return { cards: cards.length, linked, kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]), connectors, relLinked };
  }, [elements]);
  const selectedCards = selection.filter((id) => elements[id]?.type === "card").length;

  const run = async (label: string, fn: () => Promise<number> | number | void) => {
    try {
      const n = await fn();
      setStatus(typeof n === "number" ? `${label}: ${n}` : label);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="viewpoint-body">
      <div className="viewpoint-summary">
        <strong>{stats.cards} cards · {stats.connectors} connectors</strong>
        <small>{stats.linked} linked to the graph · {stats.relLinked} connectors are relations</small>
      </div>

      {(changeSets.length > 0 || plateaus.length > 0) && (
        <div className="viewpoint-group viewpoint-state" data-state-picker>
          <span>State of the model</span>
          <select
            value={overlay?.id ?? ""}
            aria-label="Which state of the model to show"
            onChange={(e) => void showState(e.target.value)}
          >
            <option value="">As-is — the estate as it is</option>
            {plateaus.length > 0 && (
              <optgroup label="Named states">
                {plateaus.map((p) => (
                  <option key={p.id} value={`plt:${p.id}`}>At “{p.name}”{p.targetDate ? ` · ${p.targetDate}` : ""}</option>
                ))}
              </optgroup>
            )}
            {changeSets.length > 0 && (
              <optgroup label="One change set">
                {changeSets.map((c) => (
                  <option key={c.id} value={`chg:${c.id}`}>As of “{c.name}”{c.targetDate ? ` · ${c.targetDate}` : ""}</option>
                ))}
              </optgroup>
            )}
          </select>
          {overlay && (
            <>
              {overlay.impact && <p className="viewpoint-state-detail">{overlay.impact}</p>}
              {missing.length > 0 && (
                <div className="viewpoint-state-missing">
                  <span>{missing.length} planned object{missing.length === 1 ? "" : "s"} not on this board</span>
                  <button type="button" onClick={placePlanned}>Place them</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="viewpoint-group">
        <span>Expand selection</span>
        <div className="viewpoint-row">
          <em>Hop depth</em>
          {[1, 2, 3].map((d) => <button key={d} type="button" className={depth === d ? "active" : ""} onClick={() => setDepth(d)}>{d}</button>)}
        </div>
        <div className="viewpoint-row">
          <em>Direction</em>
          {(["both", "out", "in"] as const).map((d) => <button key={d} type="button" className={direction === d ? "active" : ""} onClick={() => setDirection(d)}>{d === "both" ? "Both" : d === "out" ? "Outbound" : "Inbound"}</button>)}
        </div>
        <button type="button" className="viewpoint-primary" disabled={busy || selectedCards === 0} onClick={() => run("Neighbours placed", () => expandSelection(depth, direction))}>
          {selectedCards === 0 ? "Select a card to expand" : `Expand ${selectedCards} card${selectedCards === 1 ? "" : "s"}`}
        </button>
      </div>

      <div className="viewpoint-group">
        <span>Relations</span>
        <div className="viewpoint-buttons">
          <button type="button" disabled={busy || stats.linked < 2} onClick={() => run("Connectors added", showRelations)}>Show all relations</button>
          <button type="button" disabled={stats.connectors === 0} onClick={() => { const s = store.getState(); s.deleteElements(Object.values(s.elements).filter((e) => e.type === "connector" && typeof e.meta?.relationId === "string").map((e) => e.id)); setStatus("Relation connectors hidden"); }}>Hide relations</button>
        </div>
      </div>

      <div className="viewpoint-group">
        <span>Cleanup</span>
        <div className="viewpoint-buttons">
          <button type="button" disabled={stats.cards === 0} onClick={() => run("Arranged by kind", arrangeByKind)}>Group by kind</button>
          <select className="viewpoint-select" value={groupKey} disabled={attributeKeys.length === 0} aria-label="Group cards by attribute" onChange={(e) => { const key = e.target.value; setGroupKey(""); if (key) run(`Grouped by ${key}`, () => arrangeByAttribute(key)); }}>
            <option value="">{attributeKeys.length === 0 ? "Group by attribute…" : "Group by attribute…"}</option>
            {attributeKeys.map((k) => <option key={k.key} value={k.key}>{k.key} ({k.count})</option>)}
          </select>
          <button type="button" disabled={selection.length < 2} onClick={() => run("Distributed", distributeSelection)}>Distribute</button>
          <button type="button" onClick={() => store.getState().zoomToFit()}>Fit board</button>
        </div>
      </div>

      <div className="viewpoint-group">
        <span>Lens {lens.type !== "none" && <button type="button" className="viewpoint-link" onClick={() => store.getState().setLens(NO_LENS)}>clear</button>}</span>
        <div className="viewpoint-row">
          <button type="button" className={lens.type === "none" ? "active" : ""} onClick={() => store.getState().setLens(NO_LENS)}>Off</button>
          <button type="button" className={lens.type === "impact" ? "active" : ""} onClick={() => store.getState().setLens({ type: "impact", direction, depth })} title="Dim everything not connected to the selected cards">Impact</button>
          <button type="button" className={lens.type === "attribute" ? "active" : ""} disabled={attributeKeys.length === 0} onClick={() => store.getState().setLens({ type: "attribute", key: attributeKeys[0]!.key })} title={attributeKeys.length === 0 ? "No card on this board has attributes yet" : "Colour cards by an attribute value"}>Attribute</button>
          <button type="button" className={lens.type === "relation" ? "active" : ""} disabled={relationKinds.length === 0} onClick={() => store.getState().setLens({ type: "relation", hidden: [] })} title={relationKinds.length === 0 ? "No connectors on this board yet" : "Colour connectors by relation type; click a type to hide it"}>Relations</button>
          <button type="button" className={lens.type === "query" ? "active" : ""} onClick={() => { if (lens.type !== "query") { if (queryText.trim()) runQueryLens(); else setQueryText("kind:"); } }} title="Fade everything that does not match a graph query">Query</button>
        </div>
        {(lens.type === "query" || (queryText && lens.type === "none")) && (
          <div className="viewpoint-row" style={{ gap: 6 }} data-query-lens>
            <input className="viewpoint-input" value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="kind:Application missing:owner" aria-label="Query lens" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") runQueryLens(); }} />
            <button type="button" onClick={runQueryLens} disabled={!queryText.trim()}>Run</button>
            {lens.type === "query" && queryHits && queryHits.length > (lensResult?.legend[0]?.count ?? 0) && <button type="button" onClick={placeMissing} title="Add cards for results that are not on this board">Place missing {queryHits.length - (lensResult?.legend[0]?.count ?? 0)}</button>}
          </div>
        )}
        {lens.type === "impact" && (
          <small className="viewpoint-hint">Uses the hop depth and direction above. Select cards to trace what they touch; everything else fades.</small>
        )}
        {lens.type === "attribute" && (
          <div className="viewpoint-row">
            <em>Colour by</em>
            <select className="viewpoint-select" value={lens.key} onChange={(e) => store.getState().setLens({ type: "attribute", key: e.target.value })} aria-label="Attribute to colour by">
              {attributeKeys.map((k) => <option key={k.key} value={k.key}>{k.key} ({k.count})</option>)}
            </select>
          </div>
        )}
        {lensResult && (
          <div className="viewpoint-legend">
            <small>{lensResult.summary}</small>
            {lensResult.legend.map((entry) => (
              <button key={entry.value} type="button" className={entry.hidden ? "hidden-entry" : ""} onClick={() => { if (lens.type === "relation") store.getState().setLens({ type: "relation", hidden: lens.hidden.includes(entry.value) ? lens.hidden.filter((h) => h !== entry.value) : [...lens.hidden, entry.value] }); else store.getState().select(entry.ids); }} title={lens.type === "relation" ? (entry.hidden ? "Show this relation type" : "Hide this relation type") : "Select these cards"}>
                <i style={{ background: entry.color }} />
                <b>{entry.value}</b>
                <small>{entry.count}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="viewpoint-group">
        <span>Kinds on this board {hiddenKinds.length > 0 && <button type="button" className="viewpoint-link" onClick={() => store.getState().clearHiddenKinds()}>show all</button>}</span>
        <div className="viewpoint-kinds">
          {stats.kinds.map(([kind, n]) => (
            <button key={kind} type="button" className={hiddenKinds.includes(kind) ? "dimmed" : ""} onClick={() => store.getState().toggleKind(kind)} title={hiddenKinds.includes(kind) ? "Show this kind" : "Dim this kind"}>
              <i style={{ background: cardColorForKind(kind) }} />
              <b>{kind || "Untyped"}</b>
              <small>{n}</small>
            </button>
          ))}
          {stats.kinds.length === 0 && <small className="viewpoint-empty">No cards yet. Place entities from the Inventory tab or press C.</small>}
        </div>
      </div>

      <div className="viewpoint-group">
        <span>Saved views</span>
        <div className="viewpoint-row" style={{ gap: 6 }}>
          <input className="viewpoint-input" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Name this view" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { store.getState().saveViewpoint(viewName); setViewName(""); setStatus("View saved"); } }} />
          <button type="button" onClick={() => { store.getState().saveViewpoint(viewName); setViewName(""); setStatus("View saved"); }}>Save</button>
        </div>
        <div className="viewpoint-saved">
          {saved.map((v) => (
            <div key={v.id} className="viewpoint-saved-item">
              <button type="button" className="viewpoint-saved-apply" onClick={() => { store.getState().applyViewpoint(v.id); setStatus(`Applied “${v.name}”`); }} title={`${v.hiddenKinds.length ? `dims ${v.hiddenKinds.join(", ")}` : "all kinds visible"}${v.camera ? ` · ${Math.round(v.camera.zoom * 100)}%` : ""}`}>
                <strong>{v.name}</strong>
                <small>{v.hiddenKinds.length ? `${v.hiddenKinds.length} kind${v.hiddenKinds.length === 1 ? "" : "s"} dimmed` : "all kinds"}{v.lens ? ` · ${v.lens.type === "impact" ? "impact lens" : v.lens.type === "attribute" ? `by ${v.lens.key}` : v.lens.type === "query" ? `query ${v.lens.q}` : v.lens.type === "relation" ? "relation lens" : ""}` : ""}{v.camera ? ` · ${Math.round(v.camera.zoom * 100)}%` : ""}</small>
              </button>
              <button type="button" className="viewpoint-saved-delete" onClick={() => store.getState().deleteViewpoint(v.id)} aria-label={`Delete view ${v.name}`}>×</button>
            </div>
          ))}
          {saved.length === 0 && <small className="viewpoint-empty">Dim kinds and frame the board, then save the view to come back to it later.</small>}
        </div>
      </div>

      {status && <div className="viewpoint-status">{status}</div>}
    </div>
  );
}
