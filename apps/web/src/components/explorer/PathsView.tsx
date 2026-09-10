"use client";

import { useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import type { ExplorerEdge, ExplorerNode } from "@/lib/explorer";
import type { Adjacency, Path } from "@/lib/graph-algo";
import { allShortestPaths } from "@/lib/explorer-views";

/**
 * How two things are connected — all the ways, not one (§5.68).
 *
 * The old explorer answered this with shift-click, an affordance documented in a line of grey
 * text at the bottom of the canvas, and it lit up exactly one route. Two problems. Nobody found
 * it; and one route implies it is *the* route. When three equally short ones exist, "these are
 * connected through the ESB" and "these are connected three ways, one of which is the ESB" are
 * different findings, and the second is the one that matters when somebody is about to retire
 * the ESB.
 *
 * So: two named pickers instead of a modifier key, and every shortest route, written out as the
 * sentence it is. Text, not a canvas — a route is a sequence, and a sequence reads.
 */

function Picker({ label, value, nodes, onChange, exclude }: {
  label: string;
  value: string | null;
  nodes: ExplorerNode[];
  onChange: (id: string | null) => void;
  exclude: string | null;
}) {
  const [query, setQuery] = useState("");
  const chosen = value ? nodes.find((n) => n.id === value) ?? null : null;
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes
      .filter((n) => n.id !== exclude && (!q || `${n.name} ${n.kind}`.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [nodes, query, exclude]);

  if (chosen) {
    return (
      <div className="path-picker chosen" data-path-picker={label}>
        <span>{label}</span>
        <button type="button" className="path-chosen" onClick={() => { onChange(null); setQuery(""); }}>
          <i style={{ background: chosen.color }} />
          <b>{chosen.name}</b>
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="path-picker" data-path-picker={label}>
      <span>{label}</span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        aria-label={label}
        data-path-input={label}
      />
      <div className="path-options">
        {hits.map((n) => (
          <button key={n.id} type="button" onClick={() => onChange(n.id)} data-path-option={n.id}>
            <i style={{ background: n.color }} />
            <b>{n.name}</b>
            <small>{n.kind || "Untyped"}</small>
          </button>
        ))}
        {hits.length === 0 && <em>Nothing matches.</em>}
      </div>
    </div>
  );
}

export function PathsView({ nodes, edges, adjacency, from, to, onFrom, onTo, onPick }: {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  adjacency: Adjacency;
  from: string | null;
  to: string | null;
  onFrom: (id: string | null) => void;
  onTo: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edgeById = useMemo(() => new Map(edges.map((e) => [e.id, e])), [edges]);
  const routes: Path[] = useMemo(
    () => (from && to ? allShortestPaths(adjacency, from, to, 8) : []),
    [adjacency, from, to],
  );

  return (
    <div className="paths-view" data-paths-view>
      <div className="paths-pickers">
        <Picker label="From" value={from} nodes={nodes} onChange={onFrom} exclude={to} />
        <ArrowRight size={16} className="paths-arrow" />
        <Picker label="To" value={to} nodes={nodes} onChange={onTo} exclude={from} />
      </div>

      {!from || !to ? (
        <p className="paths-empty">Pick two entities and every shortest route between them appears here.</p>
      ) : routes.length === 0 ? (
        <p className="paths-empty" data-paths-none>
          <b>{byId.get(from)?.name}</b> and <b>{byId.get(to)?.name}</b> are not connected. Nothing in the
          estate joins them, at any distance.
        </p>
      ) : (
        <>
          <p className="paths-verdict" data-paths-verdict>
            {routes.length === 1
              ? `One route, ${routes[0]!.edges.length} hop${routes[0]!.edges.length === 1 ? "" : "s"} long.`
              : `${routes.length} equally short routes, ${routes[0]!.edges.length} hops each — retiring any one of them does not disconnect the two.`}
          </p>
          <ol className="paths-list">
            {routes.map((r) => (
              <li key={r.nodes.join(">")} data-path-route>
                {r.nodes.map((id, i) => (
                  <span key={id}>
                    <button type="button" onClick={() => onPick(id)} data-path-step={id}>
                      <i style={{ background: byId.get(id)?.color ?? "#94a3b8" }} />
                      {byId.get(id)?.name ?? "(gone)"}
                    </button>
                    {i < r.edges.length && (
                      <em title={`via ${edgeById.get(r.edges[i]!)?.kind ?? "a relation"}`}>
                        {edgeById.get(r.edges[i]!)?.kind || "→"}
                      </em>
                    )}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
