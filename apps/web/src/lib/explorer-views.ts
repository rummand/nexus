import type { Adjacency, Path } from "./graph-algo";

/**
 * Ways to navigate a graph (§5.68).
 *
 * The explorer used to offer exactly one: the whole workspace as a force-directed cloud, which
 * answers no question anybody actually asks. Nobody wants "show me all 1,400 things at once";
 * they want *what does this touch*, *what breaks if it goes*, *how are these two connected*, and
 * *what is not connected to anything at all*. Each of those is a different view of the same
 * edges, and each is computed here — pure, deterministic and testable, with no canvas in sight.
 *
 * Two ideas run through the whole module:
 *
 * - **Direction is the question.** Relations are directed and the old explorer threw that away,
 *   so "what depends on the CRM" and "what the CRM depends on" produced the same picture. They
 *   are not the same picture and confusing them is how you decommission the wrong system.
 * - **Layout is information.** A force simulation places nodes by an accident of physics. A
 *   radial layout places them by *distance from the thing you asked about*, which is the fact
 *   you came for, and it cannot overlap itself.
 */

export type Direction = "out" | "in" | "both";

export interface DirectedEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
}

/* -------------------------------------------------------------------------------------------- */
/* What is attached to one thing                                                                  */
/* -------------------------------------------------------------------------------------------- */

/** One connection seen from a subject: which way it points, what it is called, what is at the far end. */
export interface Connection {
  edgeId: string;
  other: string;
  kind: string;
  direction: "out" | "in";
}

/**
 * Every connection touching `id`, from that entity's point of view.
 *
 * Self-relations are dropped: an entity that "depends on" itself tells the reader nothing and
 * would appear in both directions at once.
 */
export function connectionsOf(edges: DirectedEdge[], id: string): Connection[] {
  const out: Connection[] = [];
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (e.from === id) out.push({ edgeId: e.id, other: e.to, kind: e.kind, direction: "out" });
    else if (e.to === id) out.push({ edgeId: e.id, other: e.from, kind: e.kind, direction: "in" });
  }
  return out;
}

export interface RelationGroup {
  kind: string;
  /** Connections pointing away from the subject — what it depends on, calls, owns. */
  out: Connection[];
  /** Connections pointing at it — what depends on it. */
  in: Connection[];
  total: number;
}

/**
 * Connections grouped by relationship type, heaviest group first.
 *
 * A flat list of forty neighbours is a wall. The same forty under "uses (12) · used by (9) ·
 * hosted on (3)" is a description of the thing.
 */
export function groupConnections(list: Connection[]): RelationGroup[] {
  const groups = new Map<string, RelationGroup>();
  for (const c of list) {
    let g = groups.get(c.kind);
    if (!g) {
      g = { kind: c.kind, out: [], in: [], total: 0 };
      groups.set(c.kind, g);
    }
    (c.direction === "out" ? g.out : g.in).push(c);
    g.total++;
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.kind.localeCompare(b.kind));
}

/* -------------------------------------------------------------------------------------------- */
/* The neighbourhood, laid out                                                                    */
/* -------------------------------------------------------------------------------------------- */

export interface Placed {
  id: string;
  x: number;
  y: number;
  /** Hops from the subject. 0 is the subject itself. */
  ring: number;
  /** Radians, so the caller can draw a leader line or sort a list the same way. */
  angle: number;
}

export interface RadialOptions {
  /** Minimum distance between consecutive rings. */
  ringGap?: number;
  /** Minimum arc length each node gets on its ring; rings grow to honour it. */
  minArc?: number;
  /** Tie-break within a ring, lower first. The explorer passes `-degree`, so hubs come first. */
  rank?: (id: string) => number;
  /**
   * Most nodes to place on any one ring. A hub with four hundred neighbours would otherwise put
   * four hundred on ring 1, which is the hairball again in polar coordinates. The best-ranked
   * survive and the rest are neither drawn nor expanded — the caller compares the placed count
   * against the real neighbourhood and says how many it left out.
   */
  maxPerRing?: number;
}

const RADIAL_DEFAULTS = { ringGap: 190, minArc: 118 };

/**
 * Concentric layout around one subject: ring 0 is the subject, ring *d* everything exactly *d*
 * hops away.
 *
 * Three properties a force layout cannot give you:
 *
 * - **Distance means something.** Radius is hop count, so "two steps away" is visible rather
 *   than inferred from how the springs happened to settle.
 * - **Nothing overlaps.** Each ring's radius grows until every node on it has `minArc` of
 *   circumference to itself, so the picture is legible at any size and labels have room.
 * - **It is deterministic and instant.** No simulation, no cooling, no "wait for it to settle";
 *   the same subject always produces the same picture, which is what makes it a *reference*.
 *
 * Nodes on a ring are ordered by their parent's angle, so children sit under the neighbour they
 * arrived through and edges mostly stop crossing. That single sort is the difference between a
 * readable ring and a cat's cradle.
 */
export function radialLayout(adj: Adjacency, subject: string, depth: number, opts: RadialOptions = {}): Placed[] {
  const { ringGap, minArc } = { ...RADIAL_DEFAULTS, ...opts };
  const rank = opts.rank ?? (() => 0);

  const placed: Placed[] = [{ id: subject, x: 0, y: 0, ring: 0, angle: 0 }];
  const angleOf = new Map<string, number>([[subject, 0]]);
  const seen = new Set<string>([subject]);
  let frontier = [subject];

  for (let d = 1; d <= depth && frontier.length; d++) {
    // Collect this ring, remembering which node we arrived through so siblings can stay together.
    const arrivals: Array<{ id: string; parent: string }> = [];
    for (const current of frontier) {
      for (const step of adj.neighbours.get(current) ?? []) {
        if (seen.has(step.node)) continue;
        seen.add(step.node);
        arrivals.push({ id: step.node, parent: current });
      }
    }
    if (arrivals.length === 0) break;

    /*
     * Cap by rank first, so a crowded ring keeps its most important members rather than an
     * arbitrary slice of whatever the traversal reached first. Nodes that miss the cut stay in
     * `seen` and are simply never drawn: forgetting them would let a later ring place them
     * further out than they really are, and misreported distance is worse than absence in a
     * layout whose entire claim is that radius means hops.
     */
    const ring =
      opts.maxPerRing !== undefined && arrivals.length > opts.maxPerRing
        ? [...arrivals].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id)).slice(0, opts.maxPerRing)
        : arrivals;

    ring.sort(
      (a, b) =>
        (angleOf.get(a.parent) ?? 0) - (angleOf.get(b.parent) ?? 0) ||
        rank(a.id) - rank(b.id) ||
        a.id.localeCompare(b.id),
    );

    const radius = Math.max(d * ringGap, (ring.length * minArc) / (2 * Math.PI));
    for (const [i, a] of ring.entries()) {
      const angle = (2 * Math.PI * i) / ring.length;
      angleOf.set(a.id, angle);
      placed.push({ id: a.id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, ring: d, angle });
    }
    frontier = ring.map((a) => a.id);
  }

  return placed;
}

/**
 * Where a ring's label can go without landing on one of its nodes.
 *
 * Nodes are evenly spaced from angle 0, so "the top" is occupied whenever the count divides
 * four. Putting the caption in the *widest gap* instead is a one-line rule that is right for
 * every ring, and beats the alternative of a text halo painted over a node.
 */
export function ringLabelAngle(angles: number[]): number {
  if (angles.length === 0) return -Math.PI / 2;
  const sorted = [...angles].sort((a, b) => a - b);
  let best = -Math.PI / 2;
  let widest = -1;
  for (const [i, a] of sorted.entries()) {
    const next = i + 1 < sorted.length ? sorted[i + 1]! : sorted[0]! + 2 * Math.PI;
    const gap = next - a;
    if (gap > widest) {
      widest = gap;
      best = a + gap / 2;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------------------------- */
/* Packing what the physics flings apart                                                          */
/* -------------------------------------------------------------------------------------------- */

/**
 * Offsets that gather separately-connected clumps back into one picture.
 *
 * A force simulation has no attraction between components, so two clusters that share no edge
 * repel each other forever: at rest they sit at opposite corners with an ocean of nothing
 * between them, and "fit" then frames mostly ocean. This is the single biggest reason the old
 * map read as scattered confetti on any real estate, where dozens of small clusters are normal.
 *
 * Shelf-packing by bounding box, biggest first, into roughly a square. Deterministic, and it
 * only moves whole clusters — every edge keeps the shape the simulation gave it.
 */
export function packComponents(
  positions: Array<{ id: string; x: number; y: number }>,
  groups: string[][],
  gap = 90,
): Map<string, { dx: number; dy: number }> {
  const at = new Map(positions.map((p) => [p.id, p]));
  const boxes = groups
    .map((ids) => {
      const pts = ids.map((id) => at.get(id)).filter((p): p is { id: string; x: number; y: number } => !!p);
      if (pts.length === 0) return null;
      const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
      return { ids, minX, minY, w: maxX - minX, h: maxY - minY };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => b.w * b.h - a.w * a.h || b.ids.length - a.ids.length);

  if (boxes.length <= 1) return new Map();

  const totalArea = boxes.reduce((n, b) => n + (b.w + gap) * (b.h + gap), 0);
  const shelfWidth = Math.max(boxes[0]!.w + gap, Math.sqrt(totalArea) * 1.25);

  const out = new Map<string, { dx: number; dy: number }>();
  let cursorX = 0, cursorY = 0, rowHeight = 0;
  for (const b of boxes) {
    if (cursorX > 0 && cursorX + b.w > shelfWidth) {
      cursorX = 0;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }
    const dx = cursorX - b.minX;
    const dy = cursorY - b.minY;
    for (const id of b.ids) if (at.has(id)) out.set(id, { dx, dy });
    cursorX += b.w + gap;
    rowHeight = Math.max(rowHeight, b.h);
  }
  return out;
}

/* -------------------------------------------------------------------------------------------- */
/* Blast radius                                                                                   */
/* -------------------------------------------------------------------------------------------- */

/**
 * Everything reachable from the roots following edges one way, with the hop count for each.
 *
 * `"out"` is the downstream question — *if this goes away, what goes with it*. `"in"` is the
 * upstream one — *what would have to change for this to change*. `"both"` ignores direction and
 * is only honest for "how is this thing embedded", never for impact.
 *
 * The roots are excluded from the result: the answer to "what does removing X affect" should not
 * begin by telling you it affects X.
 */
export function reachable(
  edges: DirectedEdge[],
  roots: string[],
  direction: Direction,
  maxDepth = Number.POSITIVE_INFINITY,
): Map<string, number> {
  const forward = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = forward.get(a);
    if (list) list.push(b);
    else forward.set(a, [b]);
  };
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (direction === "out" || direction === "both") add(e.from, e.to);
    if (direction === "in" || direction === "both") add(e.to, e.from);
  }

  const hops = new Map<string, number>();
  const seen = new Set<string>(roots);
  let frontier = [...roots];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const other of forward.get(current) ?? []) {
        if (seen.has(other)) continue;
        seen.add(other);
        hops.set(other, d);
        next.push(other);
      }
    }
    frontier = next;
  }
  return hops;
}

/* -------------------------------------------------------------------------------------------- */
/* What is connected to nothing                                                                   */
/* -------------------------------------------------------------------------------------------- */

/**
 * Entities with no relations at all.
 *
 * The old explorer scattered these across the canvas as confetti, where they took up most of the
 * picture and read as structure. They are the opposite of structure, and they are a *finding*:
 * an entity nobody has connected to anything is either genuinely standalone, or — far more often
 * — imported and never modelled. A list is the right shape for that, not a starfield.
 */
export function isolated(nodeIds: string[], edges: DirectedEdge[]): string[] {
  const touched = new Set<string>();
  for (const e of edges) {
    if (e.from === e.to) continue;
    touched.add(e.from);
    touched.add(e.to);
  }
  return nodeIds.filter((id) => !touched.has(id));
}

/* -------------------------------------------------------------------------------------------- */
/* Every shortest route, not just one                                                             */
/* -------------------------------------------------------------------------------------------- */

/**
 * All the shortest routes between two entities, up to `cap`.
 *
 * `shortestPath` returns one, which quietly implies it is *the* one. When three equally short
 * routes exist, "these two are connected through the ESB" and "these two are connected three
 * different ways, one of which is the ESB" are different findings, and the second is the one
 * that matters when somebody is about to retire the ESB.
 *
 * Breadth-first to find the distance, then walk back along edges that decrease it — which is
 * exactly the set of edges on some shortest path.
 */
export function allShortestPaths(adj: Adjacency, from: string, to: string, cap = 6): Path[] {
  if (from === to) return [{ nodes: [from], edges: [] }];

  const dist = new Map<string, number>([[from, 0]]);
  let frontier = [from];
  let found = false;
  for (let d = 1; frontier.length && !found; d++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const step of adj.neighbours.get(current) ?? []) {
        if (dist.has(step.node)) continue;
        dist.set(step.node, d);
        if (step.node === to) found = true;
        next.push(step.node);
      }
    }
    frontier = next;
  }
  if (!dist.has(to)) return [];

  const out: Path[] = [];
  // Walk backwards from the target; every step must move one hop closer to the source.
  const walk = (node: string, nodes: string[], edges: string[]) => {
    if (out.length >= cap) return;
    if (node === from) {
      out.push({ nodes: [...nodes].reverse(), edges: [...edges].reverse() });
      return;
    }
    const here = dist.get(node)!;
    const back = (adj.neighbours.get(node) ?? [])
      .filter((s) => dist.get(s.node) === here - 1)
      .sort((a, b) => a.node.localeCompare(b.node));
    for (const step of back) {
      nodes.push(step.node);
      edges.push(step.edge);
      walk(step.node, nodes, edges);
      nodes.pop();
      edges.pop();
    }
  };
  walk(to, [to], []);
  return out;
}

/* -------------------------------------------------------------------------------------------- */
/* Labels that do not collide                                                                     */
/* -------------------------------------------------------------------------------------------- */

export interface LabelCandidate {
  id: string;
  /** Centre of the label box, in the same space the caller will draw in. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Higher wins a collision. The explorer uses degree, so hubs keep their names. */
  priority: number;
}

/**
 * Which labels can be drawn without overlapping, most important first.
 *
 * The old explorer drew every label it thought was big enough and let them pile into each other,
 * producing "CustomerCRMCloud" and "Asset RegisterAsset Register" — text that is not merely
 * ugly but *wrong*, since it reads as an entity name that does not exist. Dropping a label is
 * honest; overprinting one is not.
 *
 * Greedy against the boxes already kept. O(n²) in the number of candidates, which is fine
 * because the caller only offers labels for nodes currently on screen.
 */
export function placeLabels(candidates: LabelCandidate[]): Set<string> {
  const kept: LabelCandidate[] = [];
  const ids = new Set<string>();
  const ordered = [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const c of ordered) {
    const clashes = kept.some(
      (k) => Math.abs(k.x - c.x) * 2 < k.w + c.w && Math.abs(k.y - c.y) * 2 < k.h + c.h,
    );
    if (clashes) continue;
    kept.push(c);
    ids.add(c.id);
  }
  return ids;
}

/* -------------------------------------------------------------------------------------------- */
/* Where you have been                                                                            */
/* -------------------------------------------------------------------------------------------- */

/** How many steps of a walk are worth keeping before the trail is itself clutter. */
export const TRAIL_LIMIT = 8;

/**
 * Add a step to the walk.
 *
 * Reading a graph is a sequence of hops, and the thing that makes it navigation rather than
 * wandering is being able to see the sequence and step back into it. Revisiting somewhere you
 * have already been *truncates* to that point rather than appending — otherwise going back two
 * steps and branching leaves a trail that records a journey nobody took.
 */
export function walkTo(trail: string[], id: string): string[] {
  const at = trail.indexOf(id);
  if (at >= 0) return trail.slice(0, at + 1);
  const next = [...trail, id];
  return next.length > TRAIL_LIMIT ? next.slice(next.length - TRAIL_LIMIT) : next;
}
