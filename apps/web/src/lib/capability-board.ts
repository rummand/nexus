import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { capabilityMapFrom, type CapabilityNode, type RealisingApplication } from "@/canvas/capability-map";
import type { CanvasDocument } from "@/canvas/document";

/**
 * Reading the estate for a capability map (§5.75).
 *
 * Which kind is "a capability" is a question about *this* workspace, not about Nexus: an
 * organisation that calls them Business Capabilities and one that calls them Capabilities are
 * both right, and a hard-coded kind name would work for exactly one of them. So the kind is
 * matched by name, and the relation between an application and a capability by its two ends
 * rather than by a verb, because LeanIX writes "application → business capability" and somebody
 * else writes "realises" and both mean the same thing.
 */

const CAPABILITY = /capabilit/i;
/** Anything that can realise one: applications first, but a workspace may use its own word. */
const REALISER = /^(application|system|solution|service|it component|platform)$/i;

export interface CapabilityEstate {
  capabilities: CapabilityNode[];
  applications: RealisingApplication[];
}

export async function capabilityEstate(db: Db, workspaceId: string): Promise<CapabilityEstate> {
  const entities = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const relations = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId));

  const capabilities = entities.filter((e) => CAPABILITY.test(e.kind));
  const capabilityIds = new Set(capabilities.map((e) => e.id));
  const realisers = entities.filter((e) => !capabilityIds.has(e.id) && REALISER.test(e.kind.trim()));
  const realiserById = new Map(realisers.map((e) => [e.id, e]));

  /*
   * Either end may be the capability — an import keeps whichever direction the source recorded,
   * and a person drawing on a board picks whichever way round they were thinking.
   */
  const realisedBy = new Map<string, Set<string>>();
  for (const r of relations) {
    const pairs: Array<[string, string]> = [[r.fromEntityId, r.toEntityId], [r.toEntityId, r.fromEntityId]];
    for (const [maybeApp, maybeCapability] of pairs) {
      if (!capabilityIds.has(maybeCapability) || !realiserById.has(maybeApp)) continue;
      const set = realisedBy.get(maybeApp) ?? new Set<string>();
      set.add(maybeCapability);
      realisedBy.set(maybeApp, set);
    }
  }

  return {
    capabilities: capabilities.map((e) => ({
      id: e.id,
      name: e.name,
      parentId: e.parentId ?? null,
      description: e.description,
      attributes: parseAttributes(e.attributes),
    })),
    applications: realisers
      .filter((e) => realisedBy.has(e.id))
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        description: e.description,
        capabilityIds: [...(realisedBy.get(e.id) ?? [])],
        attributes: parseAttributes(e.attributes),
      })),
  };
}

/**
 * The capability map for a workspace, or null when there is nothing to draw.
 *
 * Null rather than an empty board: a new tenant with no model yet is better served by the
 * illustrative starter, which shows what a capability map *is*, than by a blank rectangle.
 */
export async function capabilityBoard(db: Db, workspaceId: string, title?: string): Promise<CanvasDocument | null> {
  const estate = await capabilityEstate(db, workspaceId);
  if (!estate.capabilities.length) return null;
  return capabilityMapFrom({ ...estate, title });
}
