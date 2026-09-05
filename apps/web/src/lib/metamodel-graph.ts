import type { MetaModel, Presence } from "./metamodel";

/**
 * The meta-model as a graph *of types* — the abstraction, not the instances.
 *
 * The explorer draws entities and relations; this draws node types and the relation types that
 * join them. One edge per (relation type, from type, to type) triple, carrying where it came
 * from:
 *
 *   rule      — declared in the meta-model. Present whether or not any data uses it.
 *   observed  — the data contains such edges and no rule forbids them.
 *   violation — the data contains such edges but the relation type's rules do not allow them.
 *
 * Pure, so the diagram's structure is unit-tested rather than eyeballed.
 */

export interface TypeNode {
  name: string;
  color: string;
  instances: number;
  presence: Presence;
  fieldCount: number;
}

export type EdgeOrigin = "rule" | "observed" | "violation";

export interface TypeEdge {
  id: string;
  relation: string;
  from: string;
  to: string;
  origin: EdgeOrigin;
  /** Edges in the data matching this triple; 0 for a rule nothing uses yet. */
  count: number;
  /** A relation type joining a type to itself, which needs a loop rather than a line. */
  selfLoop: boolean;
}

export interface TypeGraph {
  nodes: TypeNode[];
  edges: TypeEdge[];
}

const norm = (v: string) => v.trim().toLowerCase();

export function typeGraph(model: MetaModel): TypeGraph {
  const nodes: TypeNode[] = model.nodeTypes.map((t) => ({
    name: t.name,
    color: t.color,
    instances: t.instances,
    presence: t.presence,
    fieldCount: t.fields.length,
  }));
  const known = new Set(nodes.map((n) => norm(n.name)));

  const edges: TypeEdge[] = [];
  const seen = new Set<string>();
  const add = (relation: string, from: string, to: string, origin: EdgeOrigin, count: number) => {
    const key = `${norm(relation)}|${norm(from)}|${norm(to)}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: key, relation, from, to, origin, count, selfLoop: norm(from) === norm(to) });
  };

  for (const rel of model.relationTypes) {
    // Rules first: a declared connection belongs on the diagram even with no data behind it.
    for (const rule of rel.rules) {
      const used = rel.observedPairs.find((p) => norm(p.fromType) === norm(rule.fromType) && norm(p.toType) === norm(rule.toType));
      add(rel.name, rule.fromType, rule.toType, "rule", used?.count ?? 0);
    }
    for (const pair of rel.observedPairs) {
      // `declared` is false when rules exist and this pair is not among them.
      const origin: EdgeOrigin = rel.rules.length > 0 && !pair.declared ? "violation" : "observed";
      add(rel.name, pair.fromType, pair.toType, origin, pair.count);
    }
  }

  // A rule may name a type that has no instances and was never declared; draw it so the edge
  // does not dangle.
  for (const e of edges) {
    for (const end of [e.from, e.to]) {
      if (known.has(norm(end))) continue;
      known.add(norm(end));
      nodes.push({ name: end, color: "#94a3b8", instances: 0, presence: "unused", fieldCount: 0 });
    }
  }

  return { nodes, edges };
}

/** Counts for the diagram's legend and header. */
export function typeGraphSummary(graph: TypeGraph) {
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    rules: graph.edges.filter((e) => e.origin === "rule").length,
    observed: graph.edges.filter((e) => e.origin === "observed").length,
    violations: graph.edges.filter((e) => e.origin === "violation").length,
  };
}
