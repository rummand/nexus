import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import type { Change } from "@/lib/change/types";
import { approvalsRequired, standingOf, type Approval, type OwnerRule, type Standing, type Touched } from "./owners";

/**
 * The governance rules, from the database (#141, §5.93).
 *
 * `owners.ts` decides; this knows what the workspace has agreed and what a branch actually
 * touches. Kept apart so the deciding stays pure.
 */

/** Every object a branch would change, which is what the rules are asked about. */
export function touchedBy(changes: Change[], named: Map<string, { name: string; kind: string }>): Touched[] {
  const ids = new Set<string>();
  for (const change of changes) {
    if (change.entityId) ids.add(change.entityId);
    // A relation's ends are both touched: connecting something to your subtree is a change to it.
    const payload = change.payload as { fromEntityId?: string; toEntityId?: string };
    for (const end of [payload.fromEntityId, payload.toEntityId]) if (typeof end === "string" && end) ids.add(end);
  }
  return [...ids].map((entityId) => ({
    entityId,
    name: named.get(entityId)?.name ?? "",
    kind: named.get(entityId)?.kind ?? "",
  }));
}

/** The rules as the screen and the gate both need them: with the names filled in. */
export async function ownerRules(db: Db, workspaceId: string): Promise<OwnerRule[]> {
  const rows = await db.select().from(s.modelOwners).where(eq(s.modelOwners.workspaceId, workspaceId));
  if (!rows.length) return [];

  const userIds = rows.map((r) => r.userId).filter((id): id is string => Boolean(id));
  const teamIds = rows.map((r) => r.teamId).filter((id): id is string => Boolean(id));
  const rootIds = rows.filter((r) => r.scope === "subtree").map((r) => r.scopeValue).filter(Boolean);

  const [people, teams, roots] = await Promise.all([
    userIds.length ? db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, userIds)) : [],
    teamIds.length ? db.select({ id: s.teams.id, name: s.teams.name }).from(s.teams).where(inArray(s.teams.id, teamIds)) : [],
    rootIds.length ? db.select({ id: s.entities.id, name: s.entities.name }).from(s.entities).where(inArray(s.entities.id, rootIds)) : [],
  ]);
  const nameOf = (list: Array<{ id: string; name: string }>, id: string) => list.find((r) => r.id === id)?.name ?? "";

  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    scopeValue: row.scopeValue,
    userId: row.userId,
    teamId: row.teamId,
    scopeLabel:
      row.scope === "everything" ? "the whole model"
        : row.scope === "kind" ? `every ${row.scopeValue}`
          : nameOf(roots, row.scopeValue) || "a part of the model that is no longer there",
    ownerLabel: row.userId ? nameOf(people, row.userId) || "somebody who has left" : nameOf(teams, row.teamId ?? "") || "a team that is gone",
  }));
}

/** What a branch needs, what it has, and whether that is enough. */
export async function standingFor(db: Db, workspaceId: string, changeSetId: string, changes: Change[]): Promise<Standing> {
  const rules = await ownerRules(db, workspaceId);
  if (!rules.length) return standingOf([], []);

  const [entities, signed] = await Promise.all([
    db.select({ id: s.entities.id, name: s.entities.name, kind: s.entities.kind, parentId: s.entities.parentId })
      .from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.changeSetApprovals).where(eq(s.changeSetApprovals.changeSetId, changeSetId)),
  ]);

  const named = new Map(entities.map((e) => [e.id, { name: e.name, kind: e.kind }]));
  /*
   * Objects a branch *introduces* are not in the graph yet, so they carry the name and kind the
   * change itself gives them — otherwise a rule over a type would never see anything new, which
   * is precisely the case where an owner most wants to be asked.
   */
  for (const change of changes) {
    if (change.op !== "addEntity" || !change.entityId) continue;
    const payload = change.payload as { name?: string; kind?: string };
    named.set(change.entityId, { name: payload.name ?? "", kind: payload.kind ?? "" });
  }

  const tree = entities.map((e) => ({ id: e.id, parentId: e.parentId ?? null }));
  const given: Approval[] = signed.map((row) => ({ ruleId: row.ruleId, byName: row.byName, at: row.createdAt }));
  return standingOf(approvalsRequired(touchedBy(changes, named), rules, tree), given);
}
