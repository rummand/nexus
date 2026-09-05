import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { cardColorForKind } from "@/canvas/document";
import { parseAttributes } from "../graph";
import type { ExplorerGraph, ExplorerNode } from "../explorer";

/**
 * The intake landscape: what has been taken in, as a graph.
 *
 * Not the whole workspace — the sources themselves and the neighbourhood they created. This is
 * the view that answers questions the workbench cannot: which meetings was I in, what did they
 * all touch, which subjects keep coming back, which systems are being discussed by people who
 * never talk to each other. Sixteen meetings with your name on them is a shape, not a list.
 *
 * It reuses the explorer's payload so it also reuses the explorer's navigation — search, focus,
 * path tracing — rather than growing a second, weaker viewer.
 */

/** How far out from a source to walk. 1 = people, subjects and what was mentioned. */
export const DEFAULT_LANDSCAPE_HOPS = 2;

export async function intakeLandscape(db: Db, workspaceId: string, hops = DEFAULT_LANDSCAPE_HOPS): Promise<ExplorerGraph> {
  const [sourceRows, entities, relations] = await Promise.all([
    db.select({ entityId: s.sources.entityId }).from(s.sources).where(eq(s.sources.workspaceId, workspaceId)),
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
  ]);

  const byId = new Map(entities.map((e) => [e.id, e]));
  const seeds = sourceRows.map((r) => r.entityId).filter((id): id is string => !!id && byId.has(id));

  // Walk out from the sources. Undirected: a person points *at* the meeting they attended.
  const adjacency = new Map<string, string[]>();
  for (const r of relations) {
    adjacency.set(r.fromEntityId, [...(adjacency.get(r.fromEntityId) ?? []), r.toEntityId]);
    adjacency.set(r.toEntityId, [...(adjacency.get(r.toEntityId) ?? []), r.fromEntityId]);
  }
  const kept = new Set(seeds);
  let frontier = seeds;
  for (let i = 0; i < hops; i++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const other of adjacency.get(id) ?? []) {
        if (kept.has(other)) continue;
        kept.add(other);
        next.push(other);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  const nodeRows = kept.size ? await db.select().from(s.entities).where(inArray(s.entities.id, [...kept])) : [];
  const degree = new Map<string, number>();
  const edges = relations.filter((r) => kept.has(r.fromEntityId) && kept.has(r.toEntityId));
  for (const r of edges) {
    degree.set(r.fromEntityId, (degree.get(r.fromEntityId) ?? 0) + 1);
    degree.set(r.toEntityId, (degree.get(r.toEntityId) ?? 0) + 1);
  }

  const nodes: ExplorerNode[] = nodeRows.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind || "(untyped)",
    color: cardColorForKind(e.kind),
    degree: degree.get(e.id) ?? 0,
    attributes: parseAttributes(e.attributes),
  }));

  const kindCounts = new Map<string, number>();
  for (const n of nodes) kindCounts.set(n.kind, (kindCounts.get(n.kind) ?? 0) + 1);
  const relationCounts = new Map<string, number>();
  for (const r of edges) relationCounts.set(r.kind || "(untyped)", (relationCounts.get(r.kind || "(untyped)") ?? 0) + 1);

  return {
    nodes,
    edges: edges.map((r) => ({ id: r.id, from: r.fromEntityId, to: r.toEntityId, kind: r.kind })),
    kinds: [...kindCounts.entries()]
      .map(([kind, count]) => ({ kind, count, color: cardColorForKind(kind === "(untyped)" ? "" : kind) }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
    relationKinds: [...relationCounts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    totalNodes: entities.length,
    truncated: false,
  };
}
