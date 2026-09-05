/**
 * Force-directed layout for the graph explorer.
 *
 * A deliberately small Fruchterman–Reingold: every pair repels, edges pull, and a cooling
 * schedule shrinks the maximum step so the graph settles instead of oscillating. It is pure and
 * seeded, so the same graph always lays out the same way — reloading the explorer does not
 * reshuffle the picture, and the behaviour can be unit-tested.
 *
 * O(n²) per tick is fine at the explorer's node cap; if that cap rises, this wants a quadtree.
 */

export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pinned nodes are dragged by the user and are not moved by the simulation. */
  fixed?: boolean;
}

export interface ForceEdge {
  from: string;
  to: string;
}

export interface ForceOptions {
  /** Ideal edge length. Repulsion strength is derived from it. */
  distance?: number;
  /** Multiplier on the repulsion term; raise to spread dense clusters. */
  repulsion?: number;
  /** Fraction of the remaining energy lost each tick. */
  cooling?: number;
}

const DEFAULTS = { distance: 120, repulsion: 1, cooling: 0.02 };

/** Deterministic [0,1) PRNG (mulberry32) so a given graph always starts from the same positions. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Initial positions on a phyllotaxis spiral, jittered by the seeded PRNG. A spiral spreads nodes
 * evenly from the centre, which converges far faster than uniform random placement.
 */
export function initialLayout(ids: string[], seed = 1): ForceNode[] {
  const rnd = seededRandom(seed);
  const step = 12;
  return ids.map((id, i) => {
    const angle = i * 2.399963229728653; // golden angle
    const radius = step * Math.sqrt(i + 1);
    return {
      id,
      x: Math.cos(angle) * radius + (rnd() - 0.5) * 4,
      y: Math.sin(angle) * radius + (rnd() - 0.5) * 4,
      vx: 0,
      vy: 0,
    };
  });
}

/**
 * Advance the simulation one tick, in place. `alpha` (1 → 0) scales how far nodes may move, so
 * callers can cool the layout over successive frames.
 */
export function tick(nodes: ForceNode[], edges: ForceEdge[], alpha: number, options: ForceOptions = {}): void {
  const { distance, repulsion, cooling } = { ...DEFAULTS, ...options };
  const k = distance;
  const index = new Map<string, ForceNode>();
  for (const n of nodes) index.set(n.id, n);

  for (const n of nodes) {
    n.vx = 0;
    n.vy = 0;
  }

  // Repulsion between every pair.
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        // Coincident nodes would divide by zero; nudge them apart deterministically.
        dx = (i - j) * 0.01 + 0.01;
        dy = (j - i) * 0.01 + 0.01;
        d2 = dx * dx + dy * dy;
      }
      const force = (repulsion * k * k) / d2;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Attraction along edges.
  for (const e of edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (!a || !b || a === b) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const force = (d * d) / k;
    const fx = (dx / d) * force;
    const fy = (dy / d) * force;
    a.vx -= fx;
    a.vy -= fy;
    b.vx += fx;
    b.vy += fy;
  }

  // Gentle pull to the origin so disconnected components do not drift away for ever.
  for (const n of nodes) {
    n.vx -= n.x * 0.012 * k * 0.01;
    n.vy -= n.y * 0.012 * k * 0.01;
  }

  const maxStep = k * alpha;
  for (const n of nodes) {
    if (n.fixed) continue;
    const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1;
    const limited = Math.min(speed, maxStep);
    n.x += (n.vx / speed) * limited * (1 - cooling);
    n.y += (n.vy / speed) * limited * (1 - cooling);
  }
}

/** Run a layout to completion. Used by tests and by any non-animated caller. */
export function layout(ids: string[], edges: ForceEdge[], ticks = 300, options: ForceOptions = {}): ForceNode[] {
  const nodes = initialLayout(ids, 1);
  for (let i = 0; i < ticks; i++) tick(nodes, edges, 1 - i / ticks, options);
  return nodes;
}

/** Bounding box of a laid-out graph, for zoom-to-fit. */
export function layoutBounds(nodes: ForceNode[]): { x: number; y: number; w: number; h: number } {
  if (nodes.length === 0) return { x: -100, y: -100, w: 200, h: 200 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}
