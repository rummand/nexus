"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crosshair, GitBranch, GitCommitHorizontal, GitMerge, Maximize2, Minus, Plus, Scissors, Tag } from "lucide-react";
import type { BranchTree, Box, TreeNode } from "@/lib/change/tree";
import { fitBox, nodeAt, openingView, treeBounds, zoomAround } from "@/lib/change/tree";
import { switchRefAction } from "@/lib/change/actions";
import { whenWords } from "@/lib/history/events";

/**
 * The revision explorer (§5.86).
 *
 * Rev 126 drew the tree as a gutter beside a list, which is a diagram you *read*. The owner
 * wanted the explorer treatment: a canvas you move through, the way the graph explorer (§5.68)
 * is moved through — so this wears the explorer's own shell, and the three columns mean the same
 * things they mean there. Branches on the left instead of entities, the drawing in the middle,
 * and the subject on the right.
 *
 * The camera is a viewBox over a world in lane/row coordinates: drag to pan, wheel to zoom
 * about the pointer, and a fit that frames everything. The arithmetic lives in `tree.ts` with
 * tests, because "does zoom-to-fit actually frame everything" has a right answer that does not
 * need a browser to establish.
 */

const LANE_COLOURS = ["#1376d4", "#c2790a", "#7c3aed", "#0f9d58", "#d1493a", "#0891b2", "#b45309"];
const colourOf = (lane: number) => (lane === 0 ? LANE_COLOURS[0]! : LANE_COLOURS[1 + ((lane - 1) % (LANE_COLOURS.length - 1))]!);

const ICON: Record<TreeNode["kind"], React.ReactNode> = {
  commit: <GitCommitHorizontal size={13} />,
  open: <GitBranch size={13} />,
  cut: <Scissors size={12} />,
  merge: <GitMerge size={13} />,
  tag: <Tag size={12} />,
};

const RADIUS: Record<TreeNode["kind"], number> = { commit: 9, open: 13, merge: 12, cut: 6, tag: 7 };

export function RevisionExplorer({
  slug, workspaceId, tree, names, currentRef,
}: {
  slug: string;
  workspaceId: string;
  tree: BranchTree;
  names: Record<string, string>;
  currentRef: string;
}) {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(tree.nodes[0]?.id ?? null);
  const [view, setView] = useState<Box | null>(null);
  /*
   * The stage's size in state rather than read off the ref at render time. A ref read during
   * render is the rule React's compiler enforces, and it is right here for a real reason: the
   * label threshold below depends on the size, so a resize that did not re-render would leave
   * the labels wrong until something else happened to.
   */
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [, start] = useTransition();
  /** Which lanes are drawn. Everything, until somebody narrows it. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const shown = useMemo(() => tree.nodes.filter((n) => !hidden.has(n.ref)), [tree.nodes, hidden]);
  const byId = useMemo(() => new Map(tree.nodes.map((n) => [n.id, n])), [tree.nodes]);
  const node = selected ? byId.get(selected) ?? null : null;
  const world = useMemo(() => treeBounds(shown), [shown]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    /*
     * No synchronous first measure: ResizeObserver delivers one the moment it observes, and a
     * setState in an effect body is a cascading render — the lint rule that says so is right.
     * Same state is not set twice, so a resize that changes nothing costs nothing.
     */
    const ro = new ResizeObserver(() => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setSize((now) => (now.width === next.width && now.height === next.height ? now : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * The camera, derived rather than initialised.
   *
   * `view` is null until somebody moves it, and the frame-everything shot is computed during
   * render from the world and the stage's size. Setting the opening view from an effect would be
   * a setState in an effect body — a cascading render, and the lint rule that refuses it is
   * right. Deriving it also means the first paint is already framed rather than jumping.
   */
  const active = view ?? openingView(world, size);

  /** Frame everything again, on demand. An event, so this one may set state. */
  const fit = useCallback(() => {
    if (size.width > 0) setView(fitBox(world, size));
  }, [world, size]);

  const at = useRef({ x: 0, y: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    at.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !size.width) return;
    const perPixel = active.width / size.width;
    setView({ ...active, x: active.x - (e.clientX - at.current.x) * perPixel, y: active.y - (e.clientY - at.current.y) * perPixel });
    at.current = { x: e.clientX, y: e.clientY };
  };
  const stopDrag = (e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const zoom = (factor: number, around?: { clientX: number; clientY: number }) => {
    const el = stage.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = around ? around.clientX - rect.left : rect.width / 2;
    const py = around ? around.clientY - rect.top : rect.height / 2;
    const point = { x: active.x + (px / rect.width) * active.width, y: active.y + (py / rect.height) * active.height };
    setView(zoomAround(active, point, factor));
  };

  /*
   * Wheel is bound imperatively and non-passively: React's onWheel is passive, so
   * preventDefault() inside it is ignored and the page scrolls behind the drawing.
   */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  /** How big a world unit is on screen, which decides whether a label is worth drawing. */
  const scale = size.width ? size.width / active.width : 1;
  const labels = scale > 0.34;

  const stand = (ref: string) => {
    start(async () => {
      await switchRefAction(workspaceId, ref === "main" ? null : ref);
      router.refresh();
    });
  };

  const focus = (n: TreeNode) => {
    setSelected(n.id);
    const p = nodeAt(n);
    setView({ ...active, x: p.x - active.width / 2, y: p.y - active.height / 2 });
  };

  return (
    <div className="explorer-shell revisions" data-revision-explorer>
      <div className="explorer-topbar">
        <div className="explorer-title">
          <h1>The tree</h1>
          <p>{tree.lanes.length - 1} branch{tree.lanes.length === 2 ? "" : "es"} · {tree.rows} commits · drag to move, scroll to zoom</p>
        </div>
        <div className="revisions-zoom">
          <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Zoom out"><Minus size={14} /></button>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in"><Plus size={14} /></button>
          <button type="button" onClick={fit} aria-label="Fit everything" data-revision-fit><Maximize2 size={13} /> Fit</button>
        </div>
      </div>

      <div className="explorer-body">
        <aside className="entity-rail revisions-rail">
          <div className="rail-filters">
            <span>Branches</span>
          </div>
          <ul className="revisions-lanes">
            {tree.lanes.map((l) => {
              const off = hidden.has(l.ref);
              return (
                <li key={l.ref} className={off ? "off" : ""}>
                  <button
                    type="button"
                    className="revisions-lane-toggle"
                    onClick={() => setHidden((h) => { const next = new Set(h); if (off) next.delete(l.ref); else next.add(l.ref); return next; })}
                    title={off ? "Show this branch" : "Hide this branch"}
                    data-lane-toggle={l.ref}
                  >
                    <span className="tree-lane-dot" style={{ background: colourOf(l.lane) }} />
                    <span className="tree-lane-name">
                      <b>{l.name}</b>
                      <em>{l.status === "main" ? "the estate as we believe it is" : `${l.status} · ${l.commits} change${l.commits === 1 ? "" : "s"}`}</em>
                    </span>
                  </button>
                  {(l.status === "main" || l.status === "open") && (
                    l.ref === currentRef
                      ? <span className="tree-here">here</span>
                      : <button type="button" className="revisions-stand" onClick={() => stand(l.ref)} data-tree-stand={l.ref}>stand</button>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <div
          className={`explorer-stage revisions-stage${dragging ? " dragging" : ""}`}
          ref={stage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          {size.width > 0 && (
            <svg className="revisions-canvas" viewBox={`${active.x} ${active.y} ${active.width} ${active.height}`} role="img" aria-label="Every branch and every commit">
              {tree.edges.map((e) => {
                const from = byId.get(e.from); const to = byId.get(e.to);
                if (!from || !to || hidden.has(from.ref) || hidden.has(to.ref)) return null;
                const a = nodeAt(from); const b = nodeAt(to);
                const colour = colourOf(from.lane === 0 ? to.lane : from.lane);
                if (e.kind === "line") {
                  return <line key={`${e.from}->${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colour} strokeWidth={4} strokeLinecap="round" />;
                }
                const mid = (a.y + b.y) / 2;
                return (
                  <path
                    key={`${e.from}->${e.to}`}
                    d={`M${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`}
                    fill="none" stroke={colour} strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={e.kind === "cut" ? "8 8" : undefined}
                  />
                );
              })}

              {shown.map((n) => {
                const p = nodeAt(n);
                const colour = colourOf(n.lane);
                const on = n.id === selected;
                return (
                  <g key={n.id} className="revisions-node" onPointerDown={(e) => { e.stopPropagation(); focus(n); }} data-tree-node={n.kind} data-tree-ref={n.ref}>
                    {on && <circle cx={p.x} cy={p.y} r={RADIUS[n.kind] + 9} fill="none" stroke={colour} strokeWidth={2} opacity={0.4} />}
                    <circle
                      cx={p.x} cy={p.y} r={RADIUS[n.kind]}
                      fill={n.kind === "open" || n.kind === "merge" ? colour : "#fff"}
                      stroke={colour} strokeWidth={4}
                    />
                    {labels && (
                      /*
                       * Under the node, centred, not beside it. Lanes are one label's width
                       * apart, so a label to the right of a commit lands on top of the next
                       * branch — which is exactly what the first cut did. Under it, a label
                       * belongs to its own lane and nothing else. The full text is in the
                       * subject panel, which is what the panel is for.
                       */
                      <text x={p.x} y={p.y + RADIUS[n.kind] + 19} textAnchor="middle" className={`revisions-label${on ? " on" : ""}`}>
                        {n.title.length > 22 ? `${n.title.slice(0, 21)}…` : n.title}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
          {shown.length === 0 && <p className="explorer-blank">Every branch is hidden. Turn one back on in the rail.</p>}
        </div>

        <aside className="explorer-subject revisions-subject">
          {node ? (
            <>
              <header>
                <i style={{ color: colourOf(node.lane) }}>{ICON[node.kind]}</i>
                <div>
                  <h2>{node.title}</h2>
                  <p>{node.detail} · {whenWords(node.at, now)}</p>
                </div>
              </header>
              <p className="revisions-on">
                on <b style={{ color: colourOf(node.lane) }}>{tree.lanes.find((l) => l.ref === node.ref)?.name ?? node.ref}</b>
              </p>
              {node.entityIds.length > 0 ? (
                <>
                  <h3>What it touched</h3>
                  <ul className="tree-touched">
                    {node.entityIds.slice(0, 18).map((id) => (
                      <li key={id}><Link href={`/w/${slug}/fs/${id}`}>{names[id] || id}</Link></li>
                    ))}
                  </ul>
                  {node.entityIds.length > 18 && <p className="tree-more">…and {node.entityIds.length - 18} more.</p>}
                </>
              ) : (
                <p className="tree-more">Nothing to open from here — this marks where a branch starts.</p>
              )}
              <button type="button" className="revisions-centre" onClick={() => focus(node)}>
                <Crosshair size={13} /> Centre on this
              </button>
            </>
          ) : (
            <p className="tree-more">Click anything in the drawing.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
