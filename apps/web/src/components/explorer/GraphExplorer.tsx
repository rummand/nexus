"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Crosshair, Maximize2, Pause, Play, Route, Search, X } from "lucide-react";
import type { ExplorerGraph, ExplorerNode } from "@/lib/explorer";
import { initialLayout, layoutBounds, tick, type ForceNode } from "@/lib/force";
import { buildAdjacency, components, shortestPath, withinHops } from "@/lib/graph-algo";

/**
 * Whole-graph explorer. Rendered on a <canvas>: at several hundred nodes a DOM element each is
 * far too slow (the same lesson as the board's grid and minimap, see docs/BRIEF.md §5.3).
 *
 * The layout runs live — one simulation tick per animation frame, cooling to a stop — so the
 * structure visibly settles instead of appearing pre-arranged.
 */

const NODE_MIN = 5;
const NODE_MAX = 20;

export function GraphExplorer({ graph }: { graph: ExplorerGraph; workspaceId: string; slug: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  /**
   * Mutable simulation state. It is seeded in an effect (never during render) because a ref
   * cannot be initialised from props at render time, and the React compiler forbids mutating a
   * memo's result — which this must do on every frame.
   */
  const simRef = useRef<{ nodes: ForceNode[]; alpha: number; ready: boolean } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string | null; startX: number; startY: number; camX: number; camY: number; moved: boolean } | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hiddenKinds, setHiddenKinds] = useState<string[]>([]);
  const [running, setRunning] = useState(true);
  /** Path tracing: pick a source, then a target, and the shortest route between them lights up. */
  const [pathFrom, setPathFrom] = useState<string | null>(null);
  const [pathTo, setPathTo] = useState<string | null>(null);
  /** Hop-limited focus: show only what is within N hops of the selection. 0 = show everything. */
  const [focusHops, setFocusHops] = useState(0);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      (m.get(e.from) ?? m.set(e.from, new Set()).get(e.from)!).add(e.to);
      (m.get(e.to) ?? m.set(e.to, new Set()).get(e.to)!).add(e.from);
    }
    return m;
  }, [graph.edges]);

  const algoAdj = useMemo(() => buildAdjacency(graph.edges.map((e) => ({ id: e.id, from: e.from, to: e.to }))), [graph.edges]);

  /** Shortest route between the two picked entities — the "how are these connected?" question. */
  const path = useMemo(() => {
    if (!pathFrom || !pathTo) return null;
    return shortestPath(algoAdj, pathFrom, pathTo);
  }, [algoAdj, pathFrom, pathTo]);
  const pathNodes = useMemo(() => new Set(path?.nodes ?? []), [path]);
  const pathEdges = useMemo(() => new Set(path?.edges ?? []), [path]);

  /** Nodes within `focusHops` of the selection; null when the limit is off. */
  const focusSet = useMemo(() => {
    if (!selected || focusHops === 0) return null;
    return withinHops(algoAdj, [selected], focusHops);
  }, [algoAdj, selected, focusHops]);

  /** How fragmented the graph is — a portfolio of isolated islands is itself a finding. */
  const fragments = useMemo(() => components(algoAdj, graph.nodes.map((n) => n.id)), [algoAdj, graph.nodes]);

  const hidden = useMemo(() => new Set(hiddenKinds), [hiddenKinds]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(graph.nodes.filter((n) => `${n.name} ${n.kind}`.toLowerCase().includes(q)).map((n) => n.id));
  }, [query, graph.nodes]);

  const maxDegree = useMemo(() => Math.max(1, ...graph.nodes.map((n) => n.degree)), [graph.nodes]);
  const radiusOf = useCallback((n: ExplorerNode) => NODE_MIN + (NODE_MAX - NODE_MIN) * Math.sqrt(n.degree / maxDegree), [maxDegree]);

  /** A node is off the view when its kind is hidden or a hop limit excludes it. */
  const isHiddenNode = useCallback((id: string, kind: string) => hidden.has(kind) || (focusSet ? !focusSet.has(id) : false), [hidden, focusSet]);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = simRef.current;
    if (!sim) return;
    const b = layoutBounds(sim.nodes);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pad = 90;
    const zoom = Math.min(4, Math.max(0.05, Math.min((w - pad * 2) / b.w, (h - pad * 2) / b.h)));
    cameraRef.current = { zoom, x: w / 2 - (b.x + b.w / 2) * zoom, y: h / 2 - (b.y + b.h / 2) * zoom };
  }, []);

  // Seed (and re-seed) the layout whenever the graph itself changes.
  useEffect(() => {
    simRef.current = { nodes: initialLayout(graph.nodes.map((n) => n.id), 1), alpha: 1, ready: false };
  }, [graph.nodes]);

  // Simulation + render loop.
  useEffect(() => {
    let raf = 0;
    const edges = graph.edges.map((e) => ({ from: e.from, to: e.to }));

    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const sim = simRef.current;
      if (!canvas || !ctx || !sim) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cam = cameraRef.current;
      const pos = new Map(sim.nodes.map((n) => [n.id, n]));
      const sx = (x: number) => x * cam.zoom + cam.x;
      const sy = (y: number) => y * cam.zoom + cam.y;

      const focus = selected ?? hoverRef.current;
      const near = focus ? adjacency.get(focus) ?? new Set<string>() : null;

      // Edges first, so nodes sit on top.
      ctx.lineWidth = Math.max(1, cam.zoom * 1.2);
      for (const e of graph.edges) {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) continue;
        const na = byId.get(e.from), nb = byId.get(e.to);
        if (!na || !nb || isHiddenNode(e.from, na.kind) || isHiddenNode(e.to, nb.kind)) continue;
        const onPath = pathEdges.has(e.id);
        const lit = onPath || (focus ? e.from === focus || e.to === focus : false);
        ctx.lineWidth = onPath ? Math.max(3, cam.zoom * 3) : Math.max(1, cam.zoom * 1.2);
        ctx.strokeStyle = onPath
          ? "rgba(217,119,6,0.95)"
          : lit ? "rgba(19,118,212,0.9)"
          : (focus || path) ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.6)";
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
        ctx.stroke();
      }

      for (const n of sim.nodes) {
        const meta = byId.get(n.id);
        if (!meta || isHiddenNode(n.id, meta.kind)) continue;
        const r = radiusOf(meta) * Math.max(0.55, Math.min(1.6, cam.zoom));
        const onPath = pathNodes.has(n.id);
        const dim = !onPath && (
          (matches && !matches.has(n.id)) ||
          (path ? true : false) ||
          (focus && n.id !== focus && !near?.has(n.id))
        );
        ctx.globalAlpha = dim ? 0.16 : 1;
        ctx.beginPath();
        ctx.arc(sx(n.x), sy(n.y), r, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();
        if (onPath || n.id === selected || n.id === hoverRef.current) {
          ctx.lineWidth = onPath ? 3 : 2.5;
          ctx.strokeStyle = onPath ? "#d97706" : "#1376d4";
          ctx.stroke();
        }
        // Labels only where they will be readable, or the view becomes a wall of text.
        if (!dim && (cam.zoom > 0.55 || r > 11 || n.id === selected || onPath)) {
          ctx.globalAlpha = dim ? 0.2 : 0.92;
          ctx.font = "600 11px Aptos, 'IBM Plex Sans', system-ui, sans-serif";
          ctx.fillStyle = "#334155";
          ctx.textAlign = "center";
          ctx.fillText(meta.name.length > 26 ? meta.name.slice(0, 25) + "…" : meta.name, sx(n.x), sy(n.y) + r + 12);
        }
        ctx.globalAlpha = 1;
      }
    };

    const loop = () => {
      const sim = simRef.current;
      if (sim && running && sim.alpha > 0.02) {
        tick(sim.nodes, edges, sim.alpha);
        sim.alpha *= 0.985;
        if (!sim.ready && sim.alpha < 0.55) { fit(); sim.ready = true; }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [graph.edges, byId, adjacency, isHiddenNode, matches, selected, radiusOf, running, fit, path, pathNodes, pathEdges]);

  // Fit once the first layout has cooled, and on resize.
  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fit]);

  const nodeAt = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const x = (clientX - rect.left - cam.x) / cam.zoom;
    const y = (clientY - rect.top - cam.y) / cam.zoom;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const n of sim.nodes) {
      const meta = byId.get(n.id);
      if (!meta || isHiddenNode(n.id, meta.kind)) continue;
      const r = radiusOf(meta) / cam.zoom + 4 / cam.zoom;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d <= r && d < bestDist) { best = n.id; bestDist = d; }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const id = nodeAt(e.clientX, e.clientY);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y, moved: false };
    if (id) {
      const n = simRef.current?.nodes.find((x) => x.id === id);
      if (n) n.fixed = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      const id = nodeAt(e.clientX, e.clientY);
      if (id !== hoverRef.current) hoverRef.current = id;
      return;
    }
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    if (drag.id) {
      const n = simRef.current?.nodes.find((x) => x.id === drag.id);
      if (n) {
        const cam = cameraRef.current;
        n.x += (e.movementX || 0) / cam.zoom;
        n.y += (e.movementY || 0) / cam.zoom;
      }
      if (simRef.current) simRef.current.alpha = Math.max(simRef.current.alpha, 0.25); // let neighbours react
    } else {
      cameraRef.current.x = drag.camX + dx;
      cameraRef.current.y = drag.camY + dy;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      if (e.shiftKey && drag.id) {
        // shift-click: first pick starts a trace, second completes it
        if (!pathFrom || (pathFrom && pathTo)) { setPathFrom(drag.id); setPathTo(null); }
        else setPathTo(drag.id);
      } else {
        setSelected(drag.id);
      }
    }
    if (drag?.id) {
      const n = simRef.current?.nodes.find((x) => x.id === drag.id);
      if (n) n.fixed = false;
    }
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const zoom = Math.min(4, Math.max(0.05, cam.zoom * factor));
    // keep the point under the cursor stationary
    cameraRef.current = { zoom, x: px - ((px - cam.x) / cam.zoom) * zoom, y: py - ((py - cam.y) / cam.zoom) * zoom };
  };

  const focusNode = (id: string) => {
    const n = simRef.current?.nodes.find((x) => x.id === id);
    const canvas = canvasRef.current;
    if (!n || !canvas) return;
    const zoom = Math.max(cameraRef.current.zoom, 1.1);
    cameraRef.current = { zoom, x: canvas.clientWidth / 2 - n.x * zoom, y: canvas.clientHeight / 2 - n.y * zoom };
    setSelected(id);
  };

  const clearPath = () => { setPathFrom(null); setPathTo(null); };
  const detail = selected ? byId.get(selected) : null;
  const pathFromNode = pathFrom ? byId.get(pathFrom) : null;
  const pathToNode = pathTo ? byId.get(pathTo) : null;
  const neighbours = selected ? [...(adjacency.get(selected) ?? [])].map((id) => byId.get(id)).filter((n): n is ExplorerNode => !!n).sort((a, b) => b.degree - a.degree) : [];
  const searchHits = matches ? graph.nodes.filter((n) => matches.has(n.id)).slice(0, 12) : [];

  return (
    <div className="explorer-shell">
      <header className="explorer-topbar">
        <div className="explorer-title">
          <h1>Graph explorer</h1>
          <p>{graph.nodes.length} entities · {graph.edges.length} relations{graph.truncated ? ` · showing the ${graph.nodes.length} most connected of ${graph.totalNodes}` : ""}</p>
        </div>
        <label className="studio-home-search explorer-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an entity" aria-label="Find an entity" />
        </label>
        <button type="button" className="ghost-button" onClick={() => setRunning((r) => !r)} title={running ? "Pause the layout" : "Resume the layout"}>
          {running ? <Pause size={15} /> : <Play size={15} />} {running ? "Pause" : "Resume"}
        </button>
        <button type="button" className="ghost-button" onClick={fit} title="Fit the whole graph"><Maximize2 size={15} /> Fit</button>
        <button type="button" className={pathFrom ? "ghost-button active" : "ghost-button"} onClick={() => (pathFrom ? clearPath() : setPathFrom(selected))} disabled={!pathFrom && !selected} title={pathFrom ? "Clear the traced path" : "Trace from the selected entity — then shift-click a second one"}>
          <Route size={15} /> {pathFrom ? "Clear path" : "Trace from"}
        </button>
        <button type="button" className="ghost-button" onClick={() => { if (simRef.current) simRef.current.alpha = 1; setRunning(true); }} title="Re-run the layout"><Crosshair size={15} /> Relayout</button>
      </header>

      <div className="explorer-body" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="explorer-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { hoverRef.current = null; dragRef.current = null; }}
          onWheel={onWheel}
        />

        <aside className="explorer-legend" aria-label="Kinds">
          <span>Kinds · click to hide</span>
          {graph.kinds.map((k) => (
            <button key={k.kind} type="button" className={hidden.has(k.kind) ? "hidden-entry" : ""} onClick={() => setHiddenKinds((h) => (h.includes(k.kind) ? h.filter((x) => x !== k.kind) : [...h, k.kind]))}>
              <i style={{ background: k.color }} />
              <b>{k.kind || "Untyped"}</b>
              <small>{k.count}</small>
            </button>
          ))}
        </aside>

        {query.trim() && (
          <div className="explorer-results" aria-label="Search results">
            <span>{searchHits.length === 0 ? "No match" : `${matches?.size} match${matches?.size === 1 ? "" : "es"}`}</span>
            {searchHits.map((n) => (
              <button key={n.id} type="button" onClick={() => focusNode(n.id)}>
                <i style={{ background: n.color }} />
                <b>{n.name}</b>
                <small>{n.kind || "Untyped"}</small>
              </button>
            ))}
          </div>
        )}

        {detail && (
          <aside className="explorer-detail" aria-label="Selected entity">
            <header>
              <i style={{ background: detail.color }} />
              <div>
                <small>{detail.kind || "Untyped"}</small>
                <strong>{detail.name || "(unnamed)"}</strong>
              </div>
              <button type="button" onClick={() => { setSelected(null); setFocusHops(0); }} aria-label="Close">×</button>
            </header>
            {Object.keys(detail.attributes).length > 0 && (
              <div className="explorer-attrs">
                {Object.entries(detail.attributes).map(([k, v]) => <span key={k}><b>{k}</b> {v}</span>)}
              </div>
            )}
            <p className="explorer-degree">{detail.degree} relation{detail.degree === 1 ? "" : "s"}</p>
            <div className="explorer-hops" role="group" aria-label="Limit the view to hops from this entity">
              <em>Show within</em>
              {[0, 1, 2, 3].map((d) => (
                <button key={d} type="button" className={focusHops === d ? "active" : ""} onClick={() => setFocusHops(d)} title={d === 0 ? "Show the whole graph" : `Show only what is within ${d} hop${d === 1 ? "" : "s"}`}>
                  {d === 0 ? "All" : `${d}`}
                </button>
              ))}
              {focusHops > 0 && focusSet && <small>{focusSet.size} shown</small>}
            </div>
            <div className="explorer-neighbours">
              {neighbours.slice(0, 40).map((n) => (
                <button key={n.id} type="button" onClick={() => focusNode(n.id)}>
                  <i style={{ background: n.color }} />
                  <b>{n.name}</b>
                  <small>{n.kind || "Untyped"}</small>
                </button>
              ))}
              {neighbours.length > 40 && <em>+{neighbours.length - 40} more</em>}
            </div>
            <Link className="ghost-button explorer-open" href={`/e/${detail.id}`}>Open in graph →</Link>
          </aside>
        )}

        {pathFrom && (
          <div className="explorer-path" data-explorer-path>
            <Route size={14} />
            {!pathTo ? (
              <span>Tracing from <b>{pathFromNode?.name}</b> — shift-click another entity</span>
            ) : path ? (
              <span><b>{path.nodes.length - 1}</b> hop{path.nodes.length === 2 ? "" : "s"}: {path.nodes.map((id) => byId.get(id)?.name ?? "?").join(" → ")}</span>
            ) : (
              <span><b>{pathFromNode?.name}</b> and <b>{pathToNode?.name}</b> are not connected</span>
            )}
            <button type="button" onClick={clearPath} aria-label="Clear path"><X size={13} /></button>
          </div>
        )}

        <span className="explorer-hint">
          Drag to pan · scroll to zoom · drag a node to pull it · click to focus · shift-click two entities to trace a path
          {fragments.length > 1 ? ` · ${fragments.length} disconnected groups (largest ${fragments[0]!.length})` : ""}
        </span>
      </div>
    </div>
  );
}
