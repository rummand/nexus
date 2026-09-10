import { count, eq, max, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { isRole, type Role } from "@/lib/auth/roles";
import { isPlatformRole, type Account, type Tenant } from "./platform";

/**
 * What the console reads (§5.64).
 *
 * Grouped aggregates rather than a query per tenant: a deployment with two hundred tenants would
 * otherwise open the console with eight hundred round trips. Five grouped counts and two joins is
 * the whole page, and it stays that shape as the platform grows.
 */

const map = <T>(rows: Array<{ workspaceId: string; value: T }>) =>
  new Map(rows.map((r) => [r.workspaceId, r.value]));

export async function tenants(): Promise<Tenant[]> {
  const db = await getDb();
  const [spaces, people, owners, boards, entities, relations, touched] = await Promise.all([
    db.select({ id: s.workspaces.id, slug: s.workspaces.slug, name: s.workspaces.name, createdAt: s.workspaces.createdAt }).from(s.workspaces),
    db.select({ workspaceId: s.workspaceMembers.workspaceId, value: count() }).from(s.workspaceMembers).groupBy(s.workspaceMembers.workspaceId),
    db.select({ workspaceId: s.workspaceMembers.workspaceId, value: count() }).from(s.workspaceMembers)
      .where(eq(s.workspaceMembers.role, "owner")).groupBy(s.workspaceMembers.workspaceId),
    db.select({ workspaceId: s.boards.workspaceId, value: count() }).from(s.boards).groupBy(s.boards.workspaceId),
    db.select({ workspaceId: s.entities.workspaceId, value: count() }).from(s.entities).groupBy(s.entities.workspaceId),
    db.select({ workspaceId: s.relations_.workspaceId, value: count() }).from(s.relations_).groupBy(s.relations_.workspaceId),
    /*
     * "Last activity" is the newest board save in the tenant. Not the newest of everything: a
     * board is what somebody has to open and change by hand, so it is the honest signal that a
     * person was here — an agent run or an import would make an abandoned tenant look busy.
     */
    db.select({ workspaceId: s.boards.workspaceId, value: max(s.boards.updatedAt) }).from(s.boards).groupBy(s.boards.workspaceId),
  ]);

  const byPeople = map(people), byOwners = map(owners), byBoards = map(boards);
  const byEntities = map(entities), byRelations = map(relations), byTouched = map(touched);

  return spaces
    .map((w): Tenant => ({
      id: w.id,
      slug: w.slug,
      name: w.name,
      createdAt: w.createdAt,
      people: byPeople.get(w.id) ?? 0,
      owners: byOwners.get(w.id) ?? 0,
      boards: byBoards.get(w.id) ?? 0,
      entities: byEntities.get(w.id) ?? 0,
      relations: byRelations.get(w.id) ?? 0,
      lastActivityAt: byTouched.get(w.id) ?? null,
    }))
    .sort((a, b) => b.entities - a.entities || a.name.localeCompare(b.name));
}

export async function accounts(): Promise<Account[]> {
  const db = await getDb();
  const now = new Date().toISOString();
  const [rows, memberships, sessions] = await Promise.all([
    db.select({
      id: s.users.id, name: s.users.name, email: s.users.email,
      platformRole: s.users.platformRole, createdAt: s.users.createdAt,
      // The hash itself never leaves the database — only whether there is one.
      hasPassword: sql<number>`case when ${s.users.passwordHash} is null then 0 else 1 end`,
    }).from(s.users),
    db.select({
      userId: s.workspaceMembers.userId, role: s.workspaceMembers.role,
      workspaceId: s.workspaces.id, slug: s.workspaces.slug, name: s.workspaces.name,
    }).from(s.workspaceMembers).innerJoin(s.workspaces, eq(s.workspaces.id, s.workspaceMembers.workspaceId)),
    // Expired rows are still in the table until something prunes them; they are not sessions.
    db.select({ userId: s.sessions.userId, value: count() }).from(s.sessions)
      .where(sql`${s.sessions.expiresAt} > ${now}`).groupBy(s.sessions.userId),
  ]);

  const byUser = new Map<string, Account["memberships"]>();
  for (const m of memberships) {
    if (!isRole(m.role)) continue;
    const list = byUser.get(m.userId) ?? [];
    list.push({ workspaceId: m.workspaceId, slug: m.slug, name: m.name, role: m.role as Role });
    byUser.set(m.userId, list);
  }
  const bySessions = new Map(sessions.map((r) => [r.userId, r.value]));

  return rows
    .map((u): Account => ({
      id: u.id,
      name: u.name,
      email: u.email,
      platformRole: isPlatformRole(u.platformRole) ? u.platformRole : null,
      signsIn: Number(u.hasPassword) === 1,
      sessions: bySessions.get(u.id) ?? 0,
      createdAt: u.createdAt,
      memberships: (byUser.get(u.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => Number(Boolean(b.platformRole)) - Number(Boolean(a.platformRole)) || a.name.localeCompare(b.name));
}

/**
 * What this deployment *is* — the questions an operator asks before touching anything.
 *
 * No secrets, only whether one is configured: "is a model provider set up" is an operational fact
 * an operator needs, and the key itself is not.
 */
export interface Deployment {
  dialect: "sqlite" | "postgres";
  modelProvider: string | null;
  leanIxGateway: boolean;
  ownerBootstrap: string | null;
  node: string;
}

export function deployment(env: Record<string, string | undefined> = process.env): Deployment {
  const url = env.DATABASE_URL ?? "";
  return {
    dialect: /^postgres(ql)?:/.test(url) ? "postgres" : "sqlite",
    modelProvider: env.ANTHROPIC_API_KEY ? "Anthropic" : env.NEXUS_MODEL_BASE_URL ? "A configured endpoint" : null,
    leanIxGateway: Boolean(env.NEXUS_LEANIX_BASE_URL),
    ownerBootstrap: (env.NEXUS_OWNER_EMAIL ?? "").trim() || null,
    node: process.version,
  };
}
