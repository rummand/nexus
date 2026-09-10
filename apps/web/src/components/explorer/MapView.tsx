"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCw } from "lucide-react";
import type { ExplorerEdge, ExplorerNode } from "@/lib/explorer";
import { initialLayout, layoutBounds, tick, type ForceNode } from "@/lib/force";
import { buildAdjacency, components } from "@/lib/graph-algo";
import { packComponents, placeLabels, type LabelCandidate } from "@/lib/explorer-views";

/**
 * The whole connected graph at once, force-directed on a canvas (§5.68).
 *
 * This is the old explorer, demoted from the only view to one of three, and fixed in the two
 * ways that made it unreadable:
 *
 * - **Unconnected entities are not here.** They used to be laid out with everything else, where
 *   repulsion spread them evenly across the canvas and they became most of the picture — a
 *   starfield of things with no relationships, drawn with the same weight as the structure. They
 *   are a finding, and the rail lists them as one.
 * - **Labels no longer overprint.** Every name that would collide with a more connected one is
 *   dropped rather than drawn on top of it, so the view can no longer invent an entity called
 *   "CustomerCRMCloud" out of two real ones that happened to overlap.
 * - **Separately-connected clusters are packed rather than flung apart.** A force simulation has
 *   no attraction between components, so clusters that share no edge repel each other forever;
 *   at rest they sit in opposite corners and "fit" frames mostly emptiness. Once the layout
 *   settles the clusters are gathered back into one picture.
 * - **Selecting something no longer greys out the map.** The old view dimmed everything but the
 *   selection and its neighbours to 16%, in the one view whose entire job is to show the whole
 *   estate. Selection now brightens the edges that touch it and leaves the rest legible; only a
 *   deliberate question — a blast radius, a traced route — is allowed to dim.
 *
 * Canvas rather than DOM because this view is unbounded — at the 1,500-node cap an element each
 * is far too slow (the same lesson as the board's grid and minimap, §5.3).
 */

const NODE_MIN = 5;
const NODE_MAX = 20;
const LABEL_H = 15;
/** Rough width per character at 11px; only needs to be right enough to reserve a box. */
const CHAR_W = 6.1;

export function MapView({ nodes, edges, selected, onPick, highlight, dimOthers }: {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  selected: string | null;
  onPick: (id: string) => void;
  /** Nodes to keep bright — a traced route or a blast radius. */
  highlight?: Set<string>;
  dimOthers?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  /**
   * Mutable simulation state. Seeded in an effect rather than during render: a ref cannot be
   * initialised from props at render time, and the React compiler forbids mutating a memo's
   * result — which this must do on every frame.
   */
  const simRef = useRef<{ nodes: ForceNode[]; alpha: number; ready: boolean; settled: boolean } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string | null; startX: number; startY: number; camX: number; camY: number; moved: boolean } | null>(null);
  const [running, setRunning] = useState(true);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  /**
   * Which nodes belong to which separately-connected clump, so the settled layout can be
   * gathered. Computed from the graph rather than the positions, so it never changes mid-run.
   */
  const groups = useMemo(
    () => components(buildAdjacency(edges.map((e) => ({ id: e.id, from: e.from, to: e.to }))), nodes.map((n) => n.id)),
    [edges, nodes],
  );

  const maxDegree = useMemo(() => Math.max(1, ...nodes.map((n) => n.degree)), [nodes]);
  const radiusOf = useCallback(
    (n: ExplorerNode) => NODE_MIN + (NODE_MAX - NODE_MIN) * Math.sqrt(n.degree / maxDegree),
    [maxDegree],
  );

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim || sim.nodes.length === 0) return;
    const b = layoutBounds(sim.nodes);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pad = 80;
    const zoom = Math.min(3, Math.max(0.05, Math.min((w - pad * 2) / b.w, (h - pad * 2) / b.h)));
    cameraRef.current = { zoom, x: w / 2 - (b.x + b.w / 2) * zoom, y: h / 2 - (b.y + b.h / 2) * zoom };
  }, []);

  useEffect(() => {
    simRef.current = { nodes: initialLayout(nodes.map((n) => n.id), 1), alpha: 1, ready: false, settled: false };
  }, [nodes]);

  useEffect(() => {
    let raf = 0;
    const links = edges.map((e) => ({ from: e.from, to: e.to }));

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

      for (const e of edges) {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) continue;
        const lit = focus ? e.from === focus || e.to === focus : false;
        const quiet = !lit && (Boolean(focus) || Boolean(dimOthers));
        ctx.lineWidth = lit ? Math.max(2, cam.zoom * 2.2) : Math.max(1, cam.zoom * 1.2);
        ctx.strokeStyle = lit ? "rgba(19,118,212,0.9)" : quiet ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.55)";
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
        ctx.stroke();
      }

      const visible: Array<{ n: ForceNode; meta: ExplorerNode; r: number; dim: boolean }> = [];
      for (const n of sim.nodes) {
        const meta = byId.get(n.id);
        if (!meta) continue;
        const r = radiusOf(meta) * Math.max(0.55, Math.min(1.6, cam.zoom));
        const x = sx(n.x), y = sy(n.y);
        if (x < -60 || y < -60 || x > w + 60 || y > h + 60) continue;
        // Only an explicit question dims a node. Selection is not a question.
        const dim = highlight ? !highlight.has(n.id) && n.id !== selected : false;
        visible.push({ n, meta, r, dim });
      }

      for (const v of visible) {
        ctx.globalAlpha = v.dim ? 0.18 : 1;
        ctx.beginPath();
        ctx.arc(sx(v.n.x), sy(v.n.y), v.r, 0, Math.PI * 2);
        ctx.fillStyle = v.meta.color;
        ctx.fill();
        if (v.n.id === selected || v.n.id === hoverRef.current) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#1376d4";
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      /*
       * Labels last, and only where they fit. The old view drew every name it thought was big
       * enough and let them pile up; two overlapping names read as one name that does not exist.
       */
      const candidates: LabelCandidate[] = visible
        .filter((v) => !v.dim)
        .map((v) => {
          const text = v.meta.name.length > 24 ? `${v.meta.name.slice(0, 23)}…` : v.meta.name;
          return {
            id: v.n.id,
            x: sx(v.n.x),
            y: sy(v.n.y) + v.r + LABEL_H / 2 + 3,
            w: text.length * CHAR_W + 6,
            h: LABEL_H,
            priority: (v.n.id === selected ? 1e6 : 0) + v.meta.degree,
          };
        });
      const keep = placeLabels(candidates);
      ctx.font = "600 11px Aptos, 'IBM Plex Sans', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#334155";
      for (const c of candidates) {
        if (!keep.has(c.id)) continue;
        const meta = byId.get(c.id)!;
        ctx.fillText(meta.name.length > 24 ? `${meta.name.slice(0, 23)}…` : meta.name, c.x, c.y);
      }
    };

    const loop = () => {
      const sim = simRef.current;
      if (sim && running && sim.alpha > 0.02) {
        tick(sim.nodes, links, sim.alpha);
        sim.alpha *= 0.985;
        if (!sim.ready && sim.alpha < 0.55) { fit(); sim.ready = true; }
        if (!sim.settled && sim.alpha < 0.06) {
          /*
           * Gather the clumps, then stop. Continuing to tick after packing would let repulsion
           * shove the newly-adjacent clusters apart again — undoing the packing in front of the
           * reader and dragging the framing off with it. The layout is settled; say so.
           */
          const offsets = packComponents(sim.nodes, groups);
          for (const n of sim.nodes) {
            const off = offsets.get(n.id);
            if (off) { n.x += off.dx; n.y += off.dy; }
          }
          sim.alpha = 0;
          sim.settled = true;
          fit();
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [edges, byId, groups, radiusOf, running, fit, selected, highlight, dimOthers]);

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
      if (!meta) continue;
      const r = (radiusOf(meta) + 4) / cam.zoom;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d <= r && d < bestDist) { best = n.id; bestDist = d; }
    }
    return best;
  };

  return (
    <div className="map-view" data-map-view>
      <canvas
        ref={canvasRef}
        className="explorer-canvas"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const id = nodeAt(e.clientX, e.clientY);
          dragRef.current = { id, startX: e.clientX, startY: e.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y, moved: false };
          if (id) {
            const n = simRef.current?.nodes.find((x) => x.id === id);
            if (n) n.fixed = true;
          }
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) {
            hoverRef.current = nodeAt(e.clientX, e.clientY);
            return;
          }
          const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
          if (drag.id) {
            const n = simRef.current?.nodes.find((x) => x.id === drag.id);
            if (n) {
              const cam = cameraRef.current;
              n.x += (e.movementX || 0) / cam.zoom;
              n.y += (e.movementY || 0) / cam.zoom;
            }
            if (simRef.current) simRef.current.alpha = Math.max(simRef.current.alpha, 0.12);
          } else {
            cameraRef.current.x = drag.camX + dx;
            cameraRef.current.y = drag.camY + dy;
          }
        }}
        onPointerUp={() => {
          const drag = dragRef.current;
          if (drag && !drag.moved && drag.id) onPick(drag.id);
          if (drag?.id) {
            const n = simRef.current?.nodes.find((x) => x.id === drag.id);
            if (n) n.fixed = false;
          }
          dragRef.current = null;
        }}
        onPointerLeave={() => { hoverRef.current = null; dragRef.current = null; }}
        onWheel={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const cam = cameraRef.current;
          const px = e.clientX - rect.left, py = e.clientY - rect.top;
          const zoom = Math.min(3, Math.max(0.05, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
          cameraRef.current = { zoom, x: px - ((px - cam.x) / cam.zoom) * zoom, y: py - ((py - cam.y) / cam.zoom) * zoom };
        }}
      />
      <div className="map-tools">
        <button type="button" className="ghost-button" onClick={() => setRunning((r) => !r)} title={running ? "Pause the layout" : "Resume the layout"}>
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" className="ghost-button" onClick={fit} title="Fit the graph"><Maximize2 size={14} /></button>
        <button type="button" className="ghost-button" onClick={() => { if (simRef.current) simRef.current.alpha = 1; setRunning(true); }} title="Re-run the layout"><RotateCw size={14} /></button>
      </div>
      <p className="map-hint">Drag to pan · scroll to zoom · drag a node to pull it · click to stand on it</p>
    </div>
  );
}
