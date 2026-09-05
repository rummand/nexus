import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { cardColorForKind } from "@/canvas/document";
import { parseAttributes } from "./graph";

/**
 * Whole-graph payload for the explorer.
 *
 * Boards are curated views: you choose what goes on them. The explorer is the opposite — the
 * entire workspace graph as a node-link diagram you navigate. It therefore needs the individual
 * relations, which `graphSnapshot` only returns aggregated by type.
 */

export interface ExplorerNode {
  id: string;
  name: string;
  kind: string;
  color: string;
  /** Degree — drives node size and the "most connected" ordering. */
  degree: number;
  attributes: Record<string, string>;
}

export interface ExplorerEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export interface ExplorerGraph {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  kinds: Array<{ kind: string; count: number; color: string }>;
  relationKinds: Array<{ kind: string; count: number }>;
  /** Total entities in the workspace, so the UI can say what it left out when capped. */
  totalNodes: number;
  truncated: boolean;
}

/** A whole graph is sent in one response; this bounds it so a huge workspace cannot stall the page. */
export const MAX_EXPLORER_NODES = 1500;

export async function explorerGraph(db: Db, workspaceId: string, limit = MAX_EXPLORER_NODES): Promise<ExplorerGraph> {
  const [entities, relations] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
  ]);

  const degree = new Map<string, number>();
  for (const r of relations) {
    degree.set(r.fromEntityId, (degree.get(r.fromEntityId) ?? 0) + 1);
    degree.set(r.toEntityId, (degree.get(r.toEntityId) ?? 0) + 1);
  }

  // When capping, keep the most connected entities — they are the ones that carry the structure.
  const ordered = [...entities].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const kept = ordered.slice(0, limit);
  const keptIds = new Set(kept.map((e) => e.id));

  const nodes: ExplorerNode[] = kept.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    color: cardColorForKind(e.kind),
    degree: degree.get(e.id) ?? 0,
    attributes: parseAttributes(e.attributes),
  }));

  // Only edges whose both ends survived the cap, or the layout would reference missing nodes.
  const edges: ExplorerEdge[] = relations
    .filter((r) => keptIds.has(r.fromEntityId) && keptIds.has(r.toEntityId))
    .map((r) => ({ id: r.id, from: r.fromEntityId, to: r.toEntityId, kind: r.kind }));

  const kindCounts = new Map<string, number>();
  for (const n of nodes) kindCounts.set(n.kind, (kindCounts.get(n.kind) ?? 0) + 1);
  const relCounts = new Map<string, number>();
  for (const e of edges) relCounts.set(e.kind, (relCounts.get(e.kind) ?? 0) + 1);

  return {
    nodes,
    edges,
    kinds: [...kindCounts.entries()].map(([kind, count]) => ({ kind, count, color: cardColorForKind(kind) })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
    relationKinds: [...relCounts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
    totalNodes: entities.length,
    truncated: entities.length > kept.length,
  };
}
