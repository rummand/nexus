import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { filterRepository, NO_FILTERS, type RepoFilters, type RepoItem } from "@/lib/repository";
import { metaModel } from "@/lib/metamodel";
import { burnDown, parseChecks, standing, type BurnDown, type Standing, type StateRow } from "./state";

/**
 * Reading a campaign and the objects in its scope (§5.85).
 *
 * The scope is a *query*, not a list, so it stays true as objects arrive — and it is the very
 * filter shape the objects list already speaks (§5.78), so a campaign can be described in the
 * same words somebody would use to find the objects by hand, and the resolver is code that is
 * already tested.
 */

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  scope: RepoFilters;
  checks: string[];
  status: "open" | "closed";
  changeSetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignObject {
  item: RepoItem;
  standing: Standing;
}

export interface CampaignDetail {
  campaign: Campaign;
  objects: CampaignObject[];
  burn: BurnDown;
}

function parseScope(raw: string): RepoFilters {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return NO_FILTERS;
    const p = parsed as Partial<RepoFilters>;
    return {
      query: typeof p.query === "string" ? p.query : "",
      kinds: Array.isArray(p.kinds) ? p.kinds.filter((k): k is string => typeof k === "string") : [],
      place: p.place === "top" || p.place === "inside" ? p.place : "",
      links: p.links === "connected" || p.links === "orphan" ? p.links : "",
      boards: p.boards === "on" || p.boards === "off" ? p.boards : "",
      declared: p.declared === "yes" || p.declared === "no" ? p.declared : "",
    };
  } catch {
    return NO_FILTERS;
  }
}

export function toCampaign(row: s.CampaignRow): Campaign {
  return {
    id: row.id, workspaceId: row.workspaceId, name: row.name, description: row.description,
    scope: parseScope(row.scope), checks: parseChecks(row.checks), status: row.status,
    changeSetId: row.changeSetId, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

/** Every object in the workspace, in the shape the scope filter works on. */
async function repoItems(db: Db, workspaceId: string): Promise<RepoItem[]> {
  const [entities, relations, boards, model] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select({ from: s.relations_.fromEntityId, to: s.relations_.toEntityId }).from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    db.select({ entityId: s.boardEntities.entityId }).from(s.boardEntities),
    metaModel(db, workspaceId),
  ]);
  const declared = new Set(model.nodeTypes.filter((t) => t.id).map((t) => t.name.trim().toLowerCase()));
  const nameOf = new Map(entities.map((e) => [e.id, e.name]));
  const rel = new Map<string, number>();
  for (const r of relations) {
    rel.set(r.from, (rel.get(r.from) ?? 0) + 1);
    rel.set(r.to, (rel.get(r.to) ?? 0) + 1);
  }
  const onBoard = new Map<string, number>();
  for (const b of boards) onBoard.set(b.entityId, (onBoard.get(b.entityId) ?? 0) + 1);

  return entities.map((e) => ({
    id: e.id, name: e.name, kind: e.kind, description: e.description,
    parent: (e.parentId && nameOf.get(e.parentId)) || "",
    relationCount: rel.get(e.id) ?? 0,
    boardCount: onBoard.get(e.id) ?? 0,
    updatedAt: e.updatedAt,
    declared: declared.has(e.kind.trim().toLowerCase()),
  }));
}

export async function listCampaigns(db: Db, workspaceId: string): Promise<Array<Campaign & { burn: BurnDown }>> {
  const rows = await db.select().from(s.campaigns).where(eq(s.campaigns.workspaceId, workspaceId));
  if (!rows.length) return [];
  const [items, states] = await Promise.all([
    repoItems(db, workspaceId),
    db.select().from(s.campaignObjects),
  ]);
  const now = Date.now();
  return rows.map((row) => {
    const campaign = toCampaign(row);
    const inScope = filterRepository(items, campaign.scope);
    const mine = new Map(states.filter((x) => x.campaignId === row.id).map((x) => [x.entityId, x as StateRow]));
    const standings = inScope.map((item) => ({ ...standing(mine.get(item.id), item.updatedAt, now), entityId: item.id }));
    return { ...campaign, burn: burnDown(standings) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCampaign(db: Db, campaignId: string): Promise<CampaignDetail | null> {
  const row = await db.query.campaigns.findFirst({ where: eq(s.campaigns.id, campaignId) });
  if (!row) return null;
  const campaign = toCampaign(row);

  const [items, states] = await Promise.all([
    repoItems(db, campaign.workspaceId),
    db.select().from(s.campaignObjects).where(eq(s.campaignObjects.campaignId, campaignId)),
  ]);
  const now = Date.now();
  const mine = new Map(states.map((x) => [x.entityId, x as StateRow]));
  const inScope = filterRepository(items, campaign.scope);

  const objects: CampaignObject[] = inScope.map((item) => ({
    item,
    standing: { ...standing(mine.get(item.id), item.updatedAt, now), entityId: item.id },
  }));

  return { campaign, objects, burn: burnDown(objects.map((o) => o.standing)) };
}

/** Which campaigns an object is in, for its own page. */
export async function campaignsFor(db: Db, workspaceId: string, entityId: string): Promise<Array<{ campaign: Campaign; standing: Standing }>> {
  const rows = await db.select().from(s.campaigns).where(and(eq(s.campaigns.workspaceId, workspaceId), eq(s.campaigns.status, "open")));
  if (!rows.length) return [];
  const entity = await db.query.entities.findFirst({ where: eq(s.entities.id, entityId) });
  if (!entity) return [];

  const items = await repoItems(db, workspaceId);
  const me = items.find((i) => i.id === entityId);
  if (!me) return [];

  const states = await db.select().from(s.campaignObjects).where(eq(s.campaignObjects.entityId, entityId));
  const now = Date.now();
  const out: Array<{ campaign: Campaign; standing: Standing }> = [];
  for (const row of rows) {
    const campaign = toCampaign(row);
    if (!filterRepository([me], campaign.scope).length) continue;
    const mine = states.find((x) => x.campaignId === campaign.id) as StateRow | undefined;
    out.push({ campaign, standing: { ...standing(mine, me.updatedAt, now), entityId } });
  }
  return out;
}

export { parseAttributes };
