/**
 * Graph algorithms for the explorer. Pure and dependency-free so they can be unit-tested and
 * reused anywhere (the board's impact lens walks board connectors instead; this walks the graph).
 */

export interface Link {
  id: string;
  from: string;
  to: string;
}

export interface Adjacency {
  /** node id → neighbours, each with the edge that reaches them. */
  neighbours: Map<string, Array<{ node: string; edge: string }>>;
}

/** Undirected adjacency: relations are directed, but "how are these connected?" ignores direction. */
export function buildAdjacency(links: Link[]): Adjacency {
  const neighbours = new Map<string, Array<{ node: string; edge: string }>>();
  const push = (a: string, b: string, edge: string) => {
    const list = neighbours.get(a);
    if (list) list.push({ node: b, edge });
    else neighbours.set(a, [{ node: b, edge }]);
  };
  for (const l of links) {
    if (l.from === l.to) continue;
    push(l.from, l.to, l.id);
    push(l.to, l.from, l.id);
  }
  return { neighbours };
}

export interface Path {
  /** Node ids from source to target inclusive. */
  nodes: string[];
  /** Edge ids joining them; always `nodes.length - 1` long. */
  edges: string[];
}

/**
 * Shortest path by breadth-first search, so the result is the fewest hops. Neighbours are
 * visited in insertion order, which makes the chosen path deterministic when several are equally
 * short. Returns null when the two are in different components.
 */
export function shortestPath(adj: Adjacency, from: string, to: string): Path | null {
  if (from === to) return { nodes: [from], edges: [] };
  const cameFrom = new Map<string, { node: string; edge: string }>();
  const seen = new Set<string>([from]);
  let frontier = [from];
  while (frontier.length) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const step of adj.neighbours.get(current) ?? []) {
        if (seen.has(step.node)) continue;
        seen.add(step.node);
        cameFrom.set(step.node, { node: current, edge: step.edge });
        if (step.node === to) {
          const nodes = [to];
          const edges: string[] = [];
          let cursor = to;
          while (cursor !== from) {
            const prev = cameFrom.get(cursor)!;
            edges.push(prev.edge);
            nodes.push(prev.node);
            cursor = prev.node;
          }
          return { nodes: nodes.reverse(), edges: edges.reverse() };
        }
        next.push(step.node);
      }
    }
    frontier = next;
  }
  return null;
}

/** Every node within `depth` hops of the roots, with the hop count for each. */
export function withinHops(adj: Adjacency, roots: string[], depth: number): Map<string, number> {
  const hops = new Map<string, number>();
  for (const r of roots) hops.set(r, 0);
  let frontier = [...roots];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const step of adj.neighbours.get(current) ?? []) {
        if (hops.has(step.node)) continue;
        hops.set(step.node, d);
        next.push(step.node);
      }
    }
    frontier = next;
  }
  return hops;
}

/**
 * Connected components, largest first. Used to tell the user how fragmented the graph is —
 * a portfolio that is mostly isolated islands is itself a finding.
 */
export function components(adj: Adjacency, allNodes: string[]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of allNodes) {
    if (seen.has(start)) continue;
    const group: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const current = stack.pop()!;
      group.push(current);
      for (const step of adj.neighbours.get(current) ?? []) {
        if (seen.has(step.node)) continue;
        seen.add(step.node);
        stack.push(step.node);
      }
    }
    out.push(group);
  }
  return out.sort((a, b) => b.length - a.length);
}
