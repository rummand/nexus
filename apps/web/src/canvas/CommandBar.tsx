"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Box, Database, Frame, Plus, Search, Shapes, Spline, StickyNote, Type } from "lucide-react";
import { cardColorForKind, elementName, elementTypeLabel, type CanvasElement } from "./document";
import { useCanvas, useCanvasStore } from "./store";
import { isEntityId, type GraphSnapshot, type QueryResponse } from "@/lib/graph-types";
import { completeQuery } from "@/lib/query-complete";

function iconFor(el: CanvasElement) {
  switch (el.type) {
    case "card": return <Box size={13} />;
    case "sticky": return <StickyNote size={13} />;
    case "text": return <Type size={13} />;
    case "frame": return <Frame size={13} />;
    case "shape": return <Shapes size={13} />;
    case "connector": return <Spline size={13} />;
  }
}

function searchText(el: CanvasElement) {
  switch (el.type) {
    case "card": return `${el.kind} ${el.title} ${el.description} ${Object.entries(el.attributes ?? {}).map(([k, v]) => `${k} ${v}`).join(" ")}`;
    case "sticky": return `${el.title} ${el.text}`;
    case "text": return `${el.title} ${el.text}`;
    case "shape": return el.text;
    case "frame": return el.title;
    case "connector": return el.label;
  }
}

const EXAMPLES = ["kind:Application criticality:high", 'lifecycle:"end of life"', "related:Maximo", "missing:owner", "has:lifecycle on:landscape"];

/**
 * Command bar: finds objects on this board and queries the workspace graph with a small
 * structured language (kind:, attribute:, related:/from:/to:, rel:, free text). Results can
 * be placed on the board. ⌘K focuses it. Natural-language questions arrive with the agents.
 */
export function CommandBar() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const workspaceId = useCanvas((s) => s.workspaceId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [graph, setGraph] = useState<QueryResponse | null>(null);
  const [vocab, setVocab] = useState<GraphSnapshot | null>(null);
  // vocabulary for autocomplete, loaded the first time the bar opens
  useEffect(() => {
    if (!open || vocab) return;
    let cancelled = false;
    fetch(`/api/workspaces/${workspaceId}/graph`).then((r) => (r.ok ? (r.json() as Promise<GraphSnapshot>) : null)).then((v) => { if (!cancelled && v) setVocab(v); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, vocab, workspaceId]);
  const completions = useMemo(() => (query.trim() ? completeQuery(query, vocab) : []), [query, vocab]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // graph query (debounced)
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      fetch("/api/graph/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, q }) })
        .then((r) => (r.ok ? (r.json() as Promise<QueryResponse>) : null))
        .then((data) => { if (!cancelled) { setGraph(data); setLoading(false); } })
        .catch(() => !cancelled && setLoading(false));
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, workspaceId]);
  const graphForQuery = query.trim() ? graph : null;

  const boardMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.replace(/\b\w+:"[^"]*"|\b\w+:\S+/g, "").split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return Object.values(elements)
      .map((el) => {
        const text = searchText(el).toLowerCase();
        const score = terms.reduce((acc, t) => acc + (text.includes(t) ? (elementName(el).toLowerCase().startsWith(t) ? 3 : 1) : 0), 0);
        return { el, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [elements, query]);

  const onBoard = useMemo(() => {
    const map = new Map<string, string>();
    for (const el of Object.values(elements)) if (el.type === "card" && isEntityId(el.meta?.entityId)) map.set(el.meta.entityId, el.id);
    return map;
  }, [elements]);

  const go = (el: CanvasElement) => { store.getState().focusElement(el.id); setOpen(false); };

  const place = (items: QueryResponse["entities"]) => {
    const fresh = items.filter((e) => !onBoard.has(e.id));
    if (fresh.length === 0) return;
    const s = store.getState();
    const centre = { x: (s.viewport.w / 2 - s.camera.x) / s.camera.zoom, y: (s.viewport.h / 2 - s.camera.y) / s.camera.zoom };
    const perRow = Math.max(1, Math.ceil(Math.sqrt(fresh.length)));
    const w = 236, h = 124, gap = 24;
    const totalW = perRow * w + (perRow - 1) * gap;
    const rows = Math.ceil(fresh.length / perRow);
    const totalH = rows * h + (rows - 1) * gap;
    s.addElements(fresh.map((e, i) => ({ id: nanoid(10), type: "card" as const, x: centre.x - totalW / 2 + (i % perRow) * (w + gap), y: centre.y - totalH / 2 + Math.floor(i / perRow) * (h + gap), w, h, kind: e.kind, color: cardColorForKind(e.kind), title: e.name, description: e.description, attributes: e.attributes, z: 0, meta: { entityId: e.id } })), { select: true });
    setOpen(false);
  };

  const highlight = (items: QueryResponse["entities"]) => {
    const ids = items.map((e) => onBoard.get(e.id)).filter((id): id is string => !!id);
    if (ids.length) { store.getState().select(ids); store.getState().zoomToSelection(); }
    setOpen(false);
  };

  const graphHits = graphForQuery?.entities ?? [];
  const placeable = graphHits.filter((e) => !onBoard.has(e.id));
  const highlightable = graphHits.filter((e) => onBoard.has(e.id));
  const structured = graphForQuery?.query.structured ?? false;

  return (
    <section className="command-bar" aria-label="Board search and graph query" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <Search size={24} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            if (structured && placeable.length) place(placeable);
            else if (boardMatches[0]) go(boardMatches[0].el);
            else if (placeable.length) place(placeable);
          }
          if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder="Search this board or query the graph — kind:Application criticality:high · related:Maximo"
        spellCheck={false}
      />
      <button className="run-button" type="button" disabled={placeable.length === 0} onClick={() => place(placeable)} title="Place all graph results that are not on this board yet">
        {placeable.length ? `Place ${placeable.length}` : "Place"}
      </button>
      <span className="keycap">⌘ K</span>
      {open && (
        <div className="search-suggestions" role="listbox">
          {!query.trim() && (
            <>
              <div className="suggestion-header"><span>Query the graph</span><small>kind: · attribute: · related: · from: · to: · rel:</small></div>
              <div className="query-shortcuts">
                {EXAMPLES.map((ex) => <button key={ex} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQuery(ex); inputRef.current?.focus(); }}>{ex}</button>)}
              </div>
            </>
          )}
          {completions.length > 0 && (
            <div className="query-shortcuts" data-completions>
              {completions.map((c) => <button key={c.query} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQuery(c.query); inputRef.current?.focus(); }}>{c.label}</button>)}
            </div>
          )}
          {boardMatches.length > 0 && (
            <>
              <div className="suggestion-header"><span>On this board</span><small>{boardMatches.length} match{boardMatches.length === 1 ? "" : "es"}</small></div>
              {boardMatches.map(({ el }) => (
                <button key={el.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(el)}>
                  <i>{iconFor(el)}</i>
                  <span><strong>{elementName(el)}</strong><small>{elementTypeLabel(el)}</small></span>
                </button>
              ))}
            </>
          )}
          {query.trim() && (
            <>
              <div className="suggestion-header">
                <span><Database size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} /> In the graph</span>
                <small>{loading ? "searching…" : graphForQuery ? `${graphForQuery.total} match${graphForQuery.total === 1 ? "" : "es"} · ${graphForQuery.explanation}` : ""}</small>
              </div>
              {graphHits.slice(0, 8).map((e) => {
                const here = onBoard.get(e.id);
                return (
                  <button key={e.id} type="button" className="graph-hit" onMouseDown={(ev) => ev.preventDefault()} onClick={() => (here ? go(elements[here]!) : place([e]))}>
                    <i style={{ background: cardColorForKind(e.kind) + "22", color: cardColorForKind(e.kind) }}>■</i>
                    <span>
                      <strong>{e.name}</strong>
                      <small>{e.kind || "untyped"}{e.why ? ` · ${e.why}` : ""}{e.boards.length ? ` · on ${e.boards.map((b) => b.name).join(", ")}` : " · not on a board"}</small>
                    </span>
                    <em>{here ? "focus" : <><Plus size={11} /> place</>}</em>
                  </button>
                );
              })}
              {graphForQuery && graphForQuery.total > 8 && <div className="suggestion-empty">{graphForQuery.total - 8} more — refine with kind: or an attribute, or press Place to add all {placeable.length} missing.</div>}
              {graphForQuery && graphForQuery.total === 0 && !loading && <div className="suggestion-empty">No entity matches. Try kind:Application, owner:…, related:…</div>}
              {(placeable.length > 1 || highlightable.length > 1) && (
                <div className="query-actions">
                  {placeable.length > 1 && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => place(placeable)}><Plus size={12} /> Place all {placeable.length} on this board</button>}
                  {highlightable.length > 1 && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(highlightable)}>Highlight {highlightable.length} on this board</button>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
