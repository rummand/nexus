import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { KEY_ATTRIBUTE } from "@/lib/import/match";
import { defaultTrust, type SourceTrust, type Standing } from "./trust";

/**
 * A source's standing, from the database (§5.90).
 *
 * The rules in `trust.ts` are pure; this is the half that knows what the workspace has actually
 * agreed to. Two things it answers: what this source owns, and which objects are reconciled
 * enough for rule two to apply to them.
 */

const now = () => new Date().toISOString();

/** A stable id for a source across reads, so its standing survives the next sync. */
export function sourceKeyFor(origin: string, detail: string): string {
  const slug = detail.trim().toLowerCase().replace(/[^a-z0-9.:-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (origin === "EA repository") return `leanix:${slug || "unknown"}`;
  if (origin === "connected system") return `system:${slug || "unknown"}`;
  return origin === "paste" ? "paste" : "files";
}

/**
 * What this source is trusted with, writing the conservative default the first time it is seen.
 *
 * Written rather than computed so the matrix fills itself in as an estate connects things: an
 * empty screen asking somebody to declare ownership for eleven systems is a screen nobody
 * completes, and the defaults are then the thing that was actually agreed to.
 */
export async function trustFor(db: Db, workspaceId: string, input: { origin: string; detail: string; name: string }): Promise<SourceTrust> {
  const sourceKey = sourceKeyFor(input.origin, input.detail);
  const row = await db.query.sourceTrust.findFirst({
    where: and(eq(s.sourceTrust.workspaceId, workspaceId), eq(s.sourceTrust.sourceKey, sourceKey)),
  });
  if (row) {
    return {
      id: row.sourceKey,
      name: row.name || input.name,
      owns: parseOwns(row.owns),
      ownsKind: row.ownsKind,
      ownsPlace: row.ownsPlace,
    };
  }

  const fresh = defaultTrust(input.origin, sourceKey, input.name);
  await db.insert(s.sourceTrust).values({
    id: `src_${nanoid(10)}`,
    workspaceId,
    sourceKey,
    name: input.name.slice(0, 120),
    origin: input.origin,
    owns: JSON.stringify(fresh.owns),
    ownsKind: Boolean(fresh.ownsKind),
    ownsPlace: Boolean(fresh.ownsPlace),
    createdAt: now(),
    updatedAt: now(),
  }).onConflictDoNothing();
  return fresh;
}

/** Defensive: these rows outlive the code that wrote them. */
function parseOwns(raw: string): string[] {
  try {
    const body: unknown = JSON.parse(raw);
    return Array.isArray(body) ? body.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** Every source this workspace has seen, for the screen that shows the matrix. */
export async function listSourceTrust(db: Db, workspaceId: string) {
  const rows = await db.select().from(s.sourceTrust).where(eq(s.sourceTrust.workspaceId, workspaceId));
  return rows
    .map((row) => ({ ...row, owns: parseOwns(row.owns) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Which objects a source may write to unseen, and which values are sealed.
 *
 * **Reconciled** is deliberately narrow: an object carries a source key, meaning a system wrote
 * it or matched it on a previous read, or somebody has taken it through a campaign (§5.85). A
 * name that merely matched is *not* reconciliation — that is exactly the assumption that fills
 * an estate with two of everything.
 *
 * The seal is a validated campaign object. Breaking one is allowed for a field's owner and is
 * never silent: it is counted before the write and puts the object back in the queue after it.
 */
export async function standingFor(db: Db, workspaceId: string, entityIds: string[]): Promise<Standing> {
  const ids = [...new Set(entityIds)].filter(Boolean);
  if (!ids.length) return { reconciled: () => false };

  const [rows, seen] = await Promise.all([
    db.select({ id: s.entities.id, attributes: s.entities.attributes })
      .from(s.entities).where(and(eq(s.entities.workspaceId, workspaceId), inArray(s.entities.id, ids))),
    db.select({ entityId: s.campaignObjects.entityId, state: s.campaignObjects.state })
      .from(s.campaignObjects).where(inArray(s.campaignObjects.entityId, ids)),
  ]);

  const keyed = new Set(rows.filter((r) => (parseAttributes(r.attributes)[KEY_ATTRIBUTE] ?? "").trim()).map((r) => r.id));
  for (const row of seen) keyed.add(row.entityId);
  const sealed = new Set(seen.filter((r) => r.state === "validated").map((r) => r.entityId));

  return {
    reconciled: (entityId) => keyed.has(entityId),
    // Field-level seals are not modelled yet: a validated object is validated whole, which is
    // what the campaign queue actually asks somebody. Narrowing it to the field is #134's to do.
    sealed: (entityId) => sealed.has(entityId),
  };
}
