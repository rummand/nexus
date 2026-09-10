import type { Role } from "@/lib/auth/roles";

/**
 * The platform, as distinct from the workspace (§5.64).
 *
 * Everything in Nexus until now has been *inside* a workspace, and `workspace_members.role`
 * answers the only question that has: what may you do here. It cannot answer the operator's
 * questions — how many tenants are on this deployment, is one of them empty, who has an account
 * at all, whose password has to be set because they cannot sign in — because none of those are
 * about a workspace, and an owner of one tenant must not be able to see another.
 *
 * So a second, thinner level: one platform role, and a small module of pure functions the console
 * is built from. Pure on purpose — the arithmetic that decides whether a tenant looks abandoned,
 * and the rules that stop an operator locking everybody (including themselves) out, are exactly
 * the things worth arguing with in a test rather than discovering on somebody's live deployment.
 */

export const PLATFORM_ROLES = ["operator"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export function isPlatformRole(v: unknown): v is PlatformRole {
  return typeof v === "string" && (PLATFORM_ROLES as readonly string[]).includes(v);
}

/** One tenant as the console sees it. */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  people: number;
  owners: number;
  boards: number;
  entities: number;
  relations: number;
  /** The most recent thing that happened in it, ISO, or null when nothing ever has. */
  lastActivityAt: string | null;
}

/** One account as the console sees it, across every tenant it belongs to. */
export interface Account {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  /** True when this person has a password and can therefore sign in at all. */
  signsIn: boolean;
  sessions: number;
  createdAt: string;
  memberships: Array<{ workspaceId: string; slug: string; name: string; role: Role }>;
}

/**
 * What a tenant is doing, in one word.
 *
 * The point of a tenant list is to answer "which of these needs me" without opening any of them,
 * and three states do that: one that was made and never used, one that was used and then stopped,
 * and one that is fine. The dormant threshold is a named constant because it is a judgement, not
 * a fact — thirty days is long enough that a team on holiday is not flagged.
 */
export const DORMANT_DAYS = 30;

export type TenantState = "empty" | "dormant" | "active";

export function tenantState(t: Tenant, now: Date = new Date()): TenantState {
  if (t.entities === 0 && t.boards === 0) return "empty";
  if (!t.lastActivityAt) return "dormant";
  const age = (now.getTime() - new Date(t.lastActivityAt).getTime()) / 86_400_000;
  return age > DORMANT_DAYS ? "dormant" : "active";
}

export function stateWhy(t: Tenant, now: Date = new Date()): string {
  const state = tenantState(t, now);
  if (state === "empty") return "Created, and nothing has been put in it yet.";
  if (state === "dormant") {
    const days = t.lastActivityAt
      ? Math.floor((now.getTime() - new Date(t.lastActivityAt).getTime()) / 86_400_000)
      : null;
    return days === null ? "Has content, but nothing is dated." : `Nothing has changed for ${days} days.`;
  }
  return "In use.";
}

/** The platform in one line, for the top of the console. */
export interface Totals {
  tenants: number;
  people: number;
  operators: number;
  boards: number;
  entities: number;
  relations: number;
  sessions: number;
  /** Accounts with no password: invited, or waiting for an identity provider. */
  cannotSignIn: number;
}

export function totals(tenants: Tenant[], accounts: Account[]): Totals {
  const sum = (f: (t: Tenant) => number) => tenants.reduce((n, t) => n + f(t), 0);
  return {
    tenants: tenants.length,
    people: accounts.length,
    operators: accounts.filter((a) => a.platformRole === "operator").length,
    boards: sum((t) => t.boards),
    entities: sum((t) => t.entities),
    relations: sum((t) => t.relations),
    sessions: accounts.reduce((n, a) => n + a.sessions, 0),
    cannotSignIn: accounts.filter((a) => !a.signsIn).length,
  };
}

/**
 * A slug, as the URL will have it.
 *
 * Shared with tenant creation rather than reimplemented there, because a slug that the console
 * accepts and the router cannot address is a tenant nobody can open.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Reserved because the router uses them: a tenant called "admin" would shadow this console. */
export const RESERVED_SLUGS = ["admin", "api", "signin", "signout", "b", "w", "docs", "new"];

export function slugProblem(slug: string): string | null {
  if (!slug) return "A tenant needs a name that makes a usable address.";
  if (slug.length < 2) return "That address is too short.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return "An address is lower-case letters, digits and hyphens.";
  if (RESERVED_SLUGS.includes(slug)) return `“${slug}” is reserved by the application itself.`;
  return null;
}

/**
 * Whether an operator may stop being one.
 *
 * The same shape as the last-owner rule in a workspace (§5.46) and for the same reason: a
 * deployment with no operator has no way back except the environment variables, and the person
 * who would have to edit them is not necessarily awake.
 */
export function mayDropOperator(accounts: Account[], userId: string): string | null {
  const operators = accounts.filter((a) => a.platformRole === "operator");
  if (!operators.some((a) => a.id === userId)) return null;
  if (operators.length <= 1) return "This is the only operator. Make somebody else one first, or nobody can run the platform.";
  return null;
}

/**
 * Whether a tenant may be deleted, and what deleting it would take with it.
 *
 * Not a confirmation dialog's job to work out: the operator deleting a tenant is the one person
 * who cannot see inside it, so the count has to come to them.
 */
export function deletionCost(t: Tenant): string {
  const parts = [
    t.people === 1 ? "1 person" : `${t.people} people`,
    t.boards === 1 ? "1 board" : `${t.boards} boards`,
    t.entities === 1 ? "1 object" : `${t.entities} objects`,
    t.relations === 1 ? "1 relation" : `${t.relations} relations`,
  ];
  return parts.join(", ");
}
