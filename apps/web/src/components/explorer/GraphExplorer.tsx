"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Network, Route, Target } from "lucide-react";
import type { ExplorerGraph } from "@/lib/explorer";
import { buildAdjacency, withinHops } from "@/lib/graph-algo";
import {
  connectionsOf, groupConnections, isolated, radialLayout, reachable, walkTo,
  type Direction, type DirectedEdge,
} from "@/lib/explorer-views";
import { EntityRail } from "./EntityRail";
import { FocusView } from "./FocusView";
import { MapView } from "./MapView";
import { PathsView } from "./PathsView";
import { SubjectPanel } from "./SubjectPanel";

/**
 * The graph explorer (§5.68).
 *
 * It used to be one view — the whole workspace as a force-directed cloud — and one view is the
 * problem. A cloud of everything answers no question anybody asks. The questions are *what does
 * this touch*, *what breaks if it goes*, *how are these two connected*, and *what is connected
 * to nothing at all*; a single layout cannot be the best answer to all four, and a force layout
 * is the best answer to none.
 *
 * So: three views over one graph, and the default is **Focus** — one entity in the middle, its
 * neighbourhood in concentric hop rings. Overview-first was the wrong default. You always come
 * to a graph with something in mind, and the tool should start where you are looking.
 *
 * Everything the old version hid in a line of grey text at the bottom of the canvas is now
 * something you can see: the entity directory is a permanent rail, tracing is two named pickers
 * instead of a modifier key, hop depth and blast-radius direction are buttons on the panel, and
 * the walk you have taken is a breadcrumb you can step back into.
 */

const VIEWS = [
  { key: "focus", label: "Focus", icon: Target, hint: "One entity and its neighbourhood, in hop rings" },
  { key: "map", label: "Map", icon: Network, hint: "Everything that is connected, at once" },
  { key: "paths", label: "Paths", icon: Route, hint: "Every shortest route between two entities" },
] as const;

type View = (typeof VIEWS)[number]["key"];

/** Most nodes on one ring of the focus view before it stops being readable. */
const MAX_PER_RING = 42;

export function GraphExplorer({ graph, slug, title = "Graph explorer", subtitle, embedded = false }: {
  graph: ExplorerGraph;
  workspaceId?: string;
  slug?: string;
  /** Heading, so the same explorer can be shown scoped to a subject (intake, a space, a lens). */
  title?: string;
  subtitle?: string;
  /** Embedded in another screen: no page topbar, and the rail collapses. */
  embedded?: boolean;
}) {
  const [view, setView] = useState<View>("focus");
  const [trail, setTrail] = useState<string[]>([]);
  const [depth, setDepth] = useState(1);
  const [query, setQuery] = useState("");
  const [hiddenKinds, setHiddenKinds] = useState<string[]>([]);
  const [hiddenRelations, setHiddenRelations] = useState<string[]>([]);
  const [impact, setImpact] = useState<Direction | null>(null);
  const [pathFrom, setPathFrom] = useState<string | null>(null);
  const [pathTo, setPathTo] = useState<string | null>(null);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const hiddenKindSet = useMemo(() => new Set(hiddenKinds), [hiddenKinds]);
  const hiddenRelSet = useMemo(() => new Set(hiddenRelations), [hiddenRelations]);

  /** Filters apply to everything at once, so every view is looking at the same graph. */
  const nodes = useMemo(() => graph.nodes.filter((n) => !hiddenKindSet.has(n.kind)), [graph.nodes, hiddenKindSet]);
  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(
    () => graph.edges.filter((e) => !hiddenRelSet.has(e.kind) && visibleIds.has(e.from) && visibleIds.has(e.to)),
    [graph.edges, hiddenRelSet, visibleIds],
  );
  const directed: DirectedEdge[] = edges;

  const adjacency = useMemo(() => buildAdjacency(edges.map((e) => ({ id: e.id, from: e.from, to: e.to }))), [edges]);
  const isolatedIds = useMemo(() => new Set(isolated(nodes.map((n) => n.id), directed)), [nodes, directed]);

  /**
   * Where the walk starts. The most connected entity is the least arbitrary opening move: it is
   * the one whose neighbourhood explains the most of the estate, and on a landscape nobody has
   * seen before it is very often the right thing to look at first.
   */
  const busiest = useMemo(
    () => [...nodes].sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name))[0]?.id ?? null,
    [nodes],
  );
  const subject = trail.at(-1) ?? busiest;
  const subjectNode = subject ? byId.get(subject) : undefined;

  const pick = useCallback((id: string) => {
    setTrail((t) => walkTo(t, id));
    setView((v) => (v === "paths" ? "focus" : v));
  }, []);

  const rank = useCallback((id: string) => -(byId.get(id)?.degree ?? 0), [byId]);

  const placed = useMemo(
    () => (subject && subjectNode ? radialLayout(adjacency, subject, depth, { rank, maxPerRing: MAX_PER_RING }) : []),
    [adjacency, subject, subjectNode, depth, rank],
  );
  /** The real neighbourhood, so the view can admit what it left off the rings. */
  const omitted = useMemo(() => {
    if (!subject) return 0;
    return Math.max(0, withinHops(adjacency, [subject], depth).size - placed.length);
  }, [adjacency, subject, depth, placed.length]);

  const groups = useMemo(
    () => (subject ? groupConnections(connectionsOf(directed, subject)) : []),
    [directed, subject],
  );

  const impactSet = useMemo(
    () => (subject && impact ? reachable(directed, [subject], impact) : null),
    [directed, subject, impact],
  );

  const railNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes
      .filter((n) => !q || `${n.name} ${n.kind}`.toLowerCase().includes(q))
      .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name));
  }, [nodes, query]);

  const connectedNodes = useMemo(() => nodes.filter((n) => !isolatedIds.has(n.id)), [nodes, isolatedIds]);

  const startTrace = useCallback((id: string) => {
    setPathFrom(id);
    setPathTo(null);
    setView("paths");
  }, []);

  /** Memoised: a fresh Set each render would restart the map's animation loop every frame. */
  const highlight = useMemo(() => (impactSet ? new Set(impactSet.keys()) : undefined), [impactSet]);

  return (
    <div className={`explorer-shell ${embedded ? "embedded" : ""}`} data-explorer>
      <header className="explorer-topbar">
        <div className="explorer-title">
          {embedded ? <strong>{title}</strong> : <h1>{title}</h1>}
          <p>
            {subtitle ??
              `${graph.nodes.length} entities · ${graph.edges.length} relations · ${isolatedIds.size} connected to nothing${
                graph.truncated ? ` · showing the ${graph.nodes.length} most connected of ${graph.totalNodes}` : ""
              }`}
          </p>
        </div>

        <div className="explorer-views" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              className={view === v.key ? "on" : ""}
              onClick={() => setView(v.key)}
              title={v.hint}
              data-view={v.key}
            >
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
      </header>

      {trail.length > 0 && (
        <nav className="explorer-trail" aria-label="Where you have been" data-explorer-trail>
          <em>Walk</em>
          {trail.map((id, i) => (
            <span key={id}>
              {i > 0 && <ChevronRight size={12} />}
              <button
                type="button"
                className={id === subject ? "on" : ""}
                onClick={() => setTrail((t) => walkTo(t, id))}
                data-trail-step={id}
              >
                {byId.get(id)?.name ?? "(gone)"}
              </button>
            </span>
          ))}
          <button type="button" className="trail-clear" onClick={() => setTrail([])}>Clear</button>
        </nav>
      )}

      <div className="explorer-body">
        <EntityRail
          graph={graph}
          nodes={railNodes}
          isolatedIds={isolatedIds}
          subject={subject}
          query={query}
          onQuery={setQuery}
          hiddenKinds={hiddenKindSet}
          onToggleKind={(k) => setHiddenKinds((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))}
          hiddenRelations={hiddenRelSet}
          onToggleRelation={(k) => setHiddenRelations((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))}
          onPick={pick}
        />

        <main className="explorer-stage">
          {view === "focus" && (
            subjectNode ? (
              <FocusView
                placed={placed}
                byId={byId}
                edges={edges}
                subject={subjectNode.id}
                onPick={pick}
                highlight={highlight}
                highlightKind="impact"
                omitted={omitted}
                depth={depth}
              />
            ) : (
              <p className="explorer-blank">Nothing to explore yet. Import something, or draw a board.</p>
            )
          )}

          {view === "map" && (
            connectedNodes.length > 0 ? (
              <MapView
                nodes={connectedNodes}
                edges={edges}
                selected={subject}
                onPick={pick}
                highlight={highlight}
                dimOthers={Boolean(highlight)}
              />
            ) : (
              <p className="explorer-blank">
                Nothing here is connected to anything. The rail lists all {isolatedIds.size} of them.
              </p>
            )
          )}

          {view === "paths" && (
            <PathsView
              nodes={nodes}
              edges={edges}
              adjacency={adjacency}
              from={pathFrom}
              to={pathTo}
              onFrom={setPathFrom}
              onTo={setPathTo}
              onPick={pick}
            />
          )}
        </main>

        {subjectNode && view !== "paths" && (
          <SubjectPanel
            node={subjectNode}
            groups={groups}
            byId={byId}
            depth={depth}
            onDepth={setDepth}
            onPick={pick}
            onTrace={startTrace}
            impact={impact}
            onImpact={setImpact}
            impactSet={impactSet}
            slug={slug}
          />
        )}
      </div>
    </div>
  );
}
