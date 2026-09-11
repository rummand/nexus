"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, GitCommitHorizontal, GitMerge, Scissors, Tag } from "lucide-react";
import type { BranchTree, TreeNode } from "@/lib/change/tree";
import { switchRefAction } from "@/lib/change/actions";
import { whenWords } from "@/lib/history/events";

/**
 * The tree, drawn (§5.84).
 *
 * Hand-authored SVG over a lane-and-row grid, because that is what the layout already computes
 * and a graph library would be a dependency for two curves. Lanes are columns and rows are time,
 * newest at the top — the same direction as the history page.
 *
 * It is navigable in three ways, which is the point of drawing it at all: click a node to see
 * what it carries and follow it into the objects it touched, click a lane to stand on that ref,
 * and every object in the panel is a link to its page.
 */

const LANE_W = 26;
const ROW_H = 34;
const PAD = 18;

const ICON: Record<TreeNode["kind"], React.ReactNode> = {
  commit: <GitCommitHorizontal size={13} />,
  open: <GitBranch size={13} />,
  cut: <Scissors size={12} />,
  merge: <GitMerge size={13} />,
  tag: <Tag size={12} />,
};

/** One colour per lane, cycled. Main is always the blue. */
const LANE_COLOURS = ["#1376d4", "#c2790a", "#7c3aed", "#0f9d58", "#d1493a", "#0891b2", "#b45309"];
const colourOf = (lane: number) => (lane === 0 ? LANE_COLOURS[0]! : LANE_COLOURS[1 + ((lane - 1) % (LANE_COLOURS.length - 1))]!);

export function BranchTreeView({
  slug, workspaceId, tree, names, currentRef,
}: {
  slug: string;
  workspaceId: string;
  tree: BranchTree;
  /** Entity names, so a node can say what it touched rather than showing ids. */
  names: Record<string, string>;
  currentRef: string;
}) {
  const router = useRouter();
  /* One clock for the whole drawing, read once: forty rows must not disagree about "just now". */
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(tree.nodes[0]?.id ?? null);
  const [, start] = useTransition();

  const byId = useMemo(() => new Map(tree.nodes.map((n) => [n.id, n])), [tree.nodes]);
  const node = selected ? byId.get(selected) ?? null : null;

  const width = PAD * 2 + Math.max(1, tree.lanes.length) * LANE_W;
  const height = PAD * 2 + Math.max(1, tree.rows) * ROW_H;
  const x = (lane: number) => PAD + lane * LANE_W + LANE_W / 2;
  const y = (row: number) => PAD + row * ROW_H + ROW_H / 2;

  const stand = (ref: string) => {
    start(async () => {
      await switchRefAction(workspaceId, ref === "main" ? null : ref);
      router.refresh();
    });
  };

  return (
    <div className="tree-shell" data-branch-tree>
      <div className="tree-scroll">
        <div className="tree-grid" style={{ gridTemplateColumns: `${width}px minmax(0, 1fr)` }}>
          <svg width={width} height={height} className="tree-svg" role="img" aria-label="Every branch and every commit">
            {tree.edges.map((e) => {
              const from = byId.get(e.from); const to = byId.get(e.to);
              if (!from || !to) return null;
              const colour = colourOf(from.lane === 0 ? to.lane : from.lane);
              if (e.kind === "line") {
                return <line key={`${e.from}->${e.to}`} x1={x(from.lane)} y1={y(from.row)} x2={x(to.lane)} y2={y(to.row)} stroke={colour} strokeWidth={2} />;
              }
              /* A cut or a merge steps sideways: a curve, so the eye follows it across lanes. */
              const x1 = x(from.lane), y1 = y(from.row), x2 = x(to.lane), y2 = y(to.row);
              const mid = (y1 + y2) / 2;
              return (
                <path
                  key={`${e.from}->${e.to}`}
                  d={`M${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none"
                  stroke={colour}
                  strokeWidth={2}
                  strokeDasharray={e.kind === "cut" ? "3 3" : undefined}
                />
              );
            })}
            {tree.nodes.map((n) => (
              <circle
                key={n.id}
                cx={x(n.lane)}
                cy={y(n.row)}
                r={n.kind === "cut" || n.kind === "tag" ? 3.5 : n.id === selected ? 6.5 : 5}
                fill={n.kind === "open" || n.kind === "merge" ? colourOf(n.lane) : "#fff"}
                stroke={colourOf(n.lane)}
                strokeWidth={2}
              />
            ))}
          </svg>

          <ol className="tree-rows" style={{ height }}>
            {tree.nodes.map((n) => (
              <li key={n.id} style={{ height: ROW_H }}>
                <button
                  type="button"
                  className={`tree-row${n.id === selected ? " on" : ""} ${n.kind}`}
                  onClick={() => setSelected(n.id)}
                  data-tree-node={n.kind}
                  data-tree-ref={n.ref}
                >
                  <i style={{ color: colourOf(n.lane) }}>{ICON[n.kind]}</i>
                  <b>{n.title}</b>
                  <em>{n.detail}</em>
                  <time>{whenWords(n.at, now)}</time>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <aside className="tree-side">
        <section className="tree-lanes">
          <h2>Branches</h2>
          <ul>
            {tree.lanes.map((l) => (
              <li key={l.ref}>
                <span className="tree-lane-dot" style={{ background: colourOf(l.lane) }} />
                <span className="tree-lane-name">
                  <b>{l.name}</b>
                  <em>{l.status === "main" ? "the estate as we believe it is" : `${l.status} · ${l.commits} change${l.commits === 1 ? "" : "s"}`}</em>
                </span>
                {(l.status === "main" || l.status === "open") && (
                  l.ref === currentRef
                    ? <span className="tree-here">here</span>
                    : <button type="button" onClick={() => stand(l.ref)} data-tree-stand={l.ref}>stand here</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {node && (
          <section className="tree-node" data-tree-detail>
            <h2>{node.title}</h2>
            <p className="tree-node-meta">
              {node.detail} · <time>{whenWords(node.at, now)}</time>
            </p>
            {node.entityIds.length > 0 ? (
              <>
                <h3>What it touched</h3>
                <ul className="tree-touched">
                  {node.entityIds.slice(0, 14).map((id) => (
                    <li key={id}><Link href={`/w/${slug}/fs/${id}`}>{names[id] || id}</Link></li>
                  ))}
                </ul>
                {node.entityIds.length > 14 && <p className="tree-more">…and {node.entityIds.length - 14} more.</p>}
              </>
            ) : (
              <p className="tree-more">Nothing to open from here — this marks where a branch starts.</p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
