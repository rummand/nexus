"use server";

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { hashPassword, MIN_PASSWORD } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session-store";
import { isRole } from "@/lib/auth/roles";
import { denyOperator, operatorOrNull } from "./guard";
import { accounts } from "./read";
import { mayDropOperator, slugProblem, slugify } from "./platform";

/**
 * What the platform console can change (§5.64).
 *
 * Every one of these is guarded by `denyOperator()` and nothing else: they are deliberately
 * *outside* the workspace capability matrix, because an operator acting on a tenant they are not
 * a member of has no role in it to check. That is the whole point of the level — and the reason
 * each action here is narrow, says what it did, and leaves a person's work alone.
 *
 * Three rules the schema cannot state:
 *
 * - **Nobody may leave the platform without an operator.** The last one cannot be demoted.
 * - **An operator is not a tenant's owner by accident.** Creating a tenant makes its first owner
 *   explicitly; the operator does not silently join every workspace they can see.
 * - **Deleting is deleting.** A tenant's cascade takes its boards and its graph, so the console
 *   makes the operator retype the address rather than click through a confirm.
 */

const refresh = () => {
  revalidatePath("/admin", "layout");
};

/** A stable colour per person, matching the one the People page gives (§5.41). */
function colourFor(seed: string): string {
  const palette = ["#1376d4", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899"];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return palette[hash % palette.length]!;
}

// ---- tenants -----------------------------------------------------------------

export async function createTenant(input: { name: string; slug: string; ownerId: string }): Promise<{ ok: true; slug: string } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;

  const name = input.name.trim();
  if (!name) return { error: "A tenant needs a name." };
  const slug = slugify(input.slug.trim() || name);
  const problem = slugProblem(slug);
  if (problem) return { error: problem };

  const db = await getDb();
  const [taken] = await db.select({ id: s.workspaces.id }).from(s.workspaces).where(eq(s.workspaces.slug, slug));
  if (taken) return { error: `The address “${slug}” is already in use.` };
  const [owner] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, input.ownerId));
  if (!owner) return { error: "Choose who will own it. A tenant with no owner is a tenant nobody can run." };

  const id = `ws_${nanoid(10)}`;
  await db.insert(s.workspaces).values({ id, slug, name });
  await db.insert(s.workspaceMembers).values({ workspaceId: id, userId: owner.id, role: "owner" });
  /*
   * One space, because a workspace with nowhere to put a board is a dead end the moment its owner
   * opens it. Nothing else is created: what the tenant is for is theirs to decide.
   */
  await db.insert(s.spaces).values({
    id: `space_${nanoid(10)}`, workspaceId: id, teamId: null,
    name: "General", description: "Where boards go until there is a better place for them.",
    emoji: "🗂️", visibility: "open",
  });
  refresh();
  return { ok: true, slug };
}

export async function renameTenant(workspaceId: string, name: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const trimmed = name.trim();
  if (!trimmed) return { error: "A tenant needs a name." };
  const db = await getDb();
  await db.update(s.workspaces).set({ name: trimmed }).where(eq(s.workspaces.id, workspaceId));
  refresh();
  return { ok: true };
}

/**
 * Change a tenant's address.
 *
 * Separate from renaming because the consequences are not the same: a name is a label, an address
 * is in every link anybody has ever shared. Kept possible anyway — a company that renames itself
 * has to be able to follow — but as its own act.
 */
export async function readdressTenant(workspaceId: string, slug: string): Promise<{ ok: true; slug: string } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const next = slugify(slug);
  const problem = slugProblem(next);
  if (problem) return { error: problem };
  const db = await getDb();
  const [taken] = await db.select({ id: s.workspaces.id }).from(s.workspaces).where(eq(s.workspaces.slug, next));
  if (taken && taken.id !== workspaceId) return { error: `The address “${next}” is already in use.` };
  await db.update(s.workspaces).set({ slug: next }).where(eq(s.workspaces.id, workspaceId));
  refresh();
  return { ok: true, slug: next };
}

/**
 * Delete a tenant and everything in it.
 *
 * The address has to be typed back, not because a confirm dialog is hard to click but because the
 * operator is the one person who cannot see what is inside — retyping is the step that makes them
 * read which tenant they are on.
 */
export async function deleteTenant(workspaceId: string, confirmSlug: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const db = await getDb();
  const [ws] = await db.select({ slug: s.workspaces.slug }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (!ws) return { error: "That tenant is already gone." };
  if (confirmSlug.trim() !== ws.slug) return { error: `To delete it, type its address exactly: ${ws.slug}` };
  await db.delete(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  refresh();
  return { ok: true };
}

// ---- people ------------------------------------------------------------------

export async function createAccount(input: { name: string; email: string; password: string }): Promise<{ ok: true; userId: string } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "A person needs a name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That does not look like an email address." };
  if (input.password.length < MIN_PASSWORD) return { error: `At least ${MIN_PASSWORD} characters.` };
  const db = await getDb();
  const [existing] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (existing) return { error: "Somebody already has that email address." };
  const id = `usr_${nanoid(10)}`;
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(input.password), color: colourFor(id) });
  refresh();
  return { ok: true, userId: id };
}

/** Set anybody's password, and end every session they have. The reason this console exists. */
export async function setPassword(userId: string, password: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  if (password.length < MIN_PASSWORD) return { error: `At least ${MIN_PASSWORD} characters.` };
  const db = await getDb();
  const [user] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, userId));
  if (!user) return { error: "There is no such account." };
  await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, userId));
  /*
   * Sessions end with the password, always. Setting a new one while the laptop that prompted it
   * is still signed in achieves nothing at all.
   */
  await revokeAllSessions(db, userId);
  refresh();
  return { ok: true };
}

/** Sign somebody out of everywhere without changing anything else. */
export async function endSessions(userId: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const db = await getDb();
  await revokeAllSessions(db, userId);
  refresh();
  return { ok: true };
}

export async function setPlatformRole(userId: string, operator: boolean): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  if (!operator) {
    const last = mayDropOperator(await accounts(), userId);
    if (last) return { error: last };
  }
  const db = await getDb();
  await db.update(s.users).set({ platformRole: operator ? "operator" : null }).where(eq(s.users.id, userId));
  refresh();
  return { ok: true };
}

/** Put somebody into a tenant, or change what they may do there. */
export async function setMembership(workspaceId: string, userId: string, role: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  if (!isRole(role)) return { error: "That is not a role." };
  const db = await getDb();
  const [ws] = await db.select({ id: s.workspaces.id }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (!ws) return { error: "There is no such tenant." };
  const [existing] = await db
    .select({ role: s.workspaceMembers.role })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  if (!existing) {
    await db.insert(s.workspaceMembers).values({ workspaceId, userId, role });
  } else {
    if (existing.role === "owner" && role !== "owner" && (await ownerCount(workspaceId)) <= 1) {
      return { error: "This is the tenant's last owner. Give somebody else the role first." };
    }
    await db.update(s.workspaceMembers).set({ role })
      .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  }
  refresh();
  return { ok: true };
}

export async function removeMembership(workspaceId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const db = await getDb();
  const [existing] = await db
    .select({ role: s.workspaceMembers.role })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  if (!existing) return { error: "They are not in that tenant." };
  if (existing.role === "owner" && (await ownerCount(workspaceId)) <= 1) {
    return { error: "This is the tenant's last owner. Give somebody else the role first." };
  }
  await db.delete(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  refresh();
  return { ok: true };
}

/**
 * Delete an account.
 *
 * The narrowest of these on purpose. Everything a person made — boards, versions, comments,
 * change sets — names them, and the schema sets those references to null rather than cascading,
 * so the record of what happened survives. What goes is the ability to sign in and the
 * memberships. An operator cannot delete themselves: locking yourself out of the console you are
 * standing in is never the thing you meant.
 */
export async function deleteAccount(userId: string, confirmEmail: string): Promise<{ ok: true } | { error: string }> {
  const no = await denyOperator();
  if (no) return no;
  const me = await operatorOrNull();
  if (me?.userId === userId) return { error: "You cannot delete your own account from here." };
  const db = await getDb();
  const [user] = await db.select({ email: s.users.email, role: s.users.platformRole }).from(s.users).where(eq(s.users.id, userId));
  if (!user) return { error: "That account is already gone." };
  if (confirmEmail.trim().toLowerCase() !== user.email) return { error: `To delete it, type the address exactly: ${user.email}` };
  if (user.role === "operator") {
    const last = mayDropOperator(await accounts(), userId);
    if (last) return { error: last };
  }
  await db.delete(s.users).where(eq(s.users.id, userId));
  refresh();
  return { ok: true };
}

async function ownerCount(workspaceId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.role, "owner")));
  return Number(row?.n ?? 0);
}
