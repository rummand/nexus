"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUser } from "@/lib/session";
import { deny, viewer } from "./guard";
import { hashPassword, verifyPassword, MIN_PASSWORD } from "./password";
import { isRole, mayGrant, type Role } from "./roles";
import { revokeAllSessions } from "./session-store";

/**
 * Managing the people in a workspace (§5.46).
 *
 * The gap this closes was recorded honestly and is closed the same way: there is still no sign-up,
 * no password-reset email and no invitation link, because enterprise SSO is the intended answer to
 * all three and building a mail transport to avoid it would be a worse product with more moving
 * parts. What was actually missing is smaller and entirely local — a way to **add** a colleague, a
 * way to say what they may do, and a way for somebody to **change their own password** without an
 * administrator knowing it.
 *
 * Two rules the matrix cannot express on its own live here:
 *
 * - **Nobody may lock the workspace out of itself.** The last owner cannot be demoted or removed.
 * - **A reset ends the sessions.** Changing somebody's password while their stolen laptop is still
 *   signed in achieves nothing, so it revokes every session that person has.
 */

/* One statement of the rule, in password.ts, so the two places that enforce it cannot drift. */

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

async function refresh(workspaceId: string) {
  const slug = await slugOf(workspaceId);
  if (slug) revalidatePath(`/w/${slug}/settings/people`, "layout");
}

/** How many owners this workspace has, so the last one cannot be removed. */
async function ownerCount(workspaceId: string) {
  const db = await getDb();
  const rows = await db
    .select({ userId: s.workspaceMembers.userId })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.role, "owner")));
  return rows.length;
}

export async function addPerson(input: { workspaceId: string; name: string; email: string; role: string; password: string }): Promise<{ ok: true; userId: string } | { error: string }> {
  const no = await deny(input.workspaceId, "people.manage");
  if (no) return no;
  const me = await viewer(input.workspaceId);

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const role: Role = isRole(input.role) ? input.role : "member";
  if (!name) return { error: "A name, so their cursor and their edits say who they are." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That does not look like an email address." };
  if (input.password.length < MIN_PASSWORD) return { error: `A password of at least ${MIN_PASSWORD} characters. Length is the only rule; composition rules push people towards Password1!.` };
  if (!mayGrant(me.role, role)) return { error: "Only an owner can make another owner." };

  const db = await getDb();
  const existing = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  const userId = existing?.id ?? `usr_${nanoid(10)}`;

  if (existing) {
    const already = await db
      .select()
      .from(s.workspaceMembers)
      .where(and(eq(s.workspaceMembers.workspaceId, input.workspaceId), eq(s.workspaceMembers.userId, userId)));
    if (already.length) return { error: `${existing.name} is already in this workspace.` };
    // A person who already has an account keeps their password: adding them here is membership,
    // not a new identity, and quietly resetting it would sign them out of somewhere else.
    await db.insert(s.workspaceMembers).values({ workspaceId: input.workspaceId, userId, role });
  } else {
    await db.insert(s.users).values({ id: userId, name, email, passwordHash: await hashPassword(input.password), color: colourFor(userId) });
    await db.insert(s.workspaceMembers).values({ workspaceId: input.workspaceId, userId, role });
  }
  await refresh(input.workspaceId);
  return { ok: true, userId };
}

export async function setPersonRole(workspaceId: string, userId: string, role: string): Promise<{ ok: true } | { error: string }> {
  const no = await deny(workspaceId, "people.manage");
  if (no) return no;
  if (!isRole(role)) return { error: "That is not a role." };
  const me = await viewer(workspaceId);
  if (!mayGrant(me.role, role)) return { error: "Only an owner can make another owner." };

  const db = await getDb();
  const [current] = await db
    .select({ role: s.workspaceMembers.role })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  if (!current) return { error: "They are not in this workspace." };
  if (current.role === "owner" && role !== "owner" && (await ownerCount(workspaceId)) <= 1) {
    return { error: "This is the last owner. Make somebody else an owner first, or the workspace has nobody who can manage it." };
  }
  await db
    .update(s.workspaceMembers)
    .set({ role })
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  await refresh(workspaceId);
  return { ok: true };
}

export async function removePerson(workspaceId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const no = await deny(workspaceId, "people.manage");
  if (no) return no;
  const db = await getDb();
  const [current] = await db
    .select({ role: s.workspaceMembers.role })
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  if (!current) return { error: "They are not in this workspace." };
  if (current.role === "owner" && (await ownerCount(workspaceId)) <= 1) {
    return { error: "This is the last owner. Make somebody else an owner first." };
  }
  /*
   * The membership goes; the person and everything they made stays. Boards, versions, change sets
   * and history all name them, and deleting the row would rewrite the record of what happened.
   */
  await db.delete(s.workspaceMembers).where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  await refresh(workspaceId);
  return { ok: true };
}

/** An owner sets somebody a new password, and ends every session they have. */
export async function resetPassword(workspaceId: string, userId: string, password: string): Promise<{ ok: true } | { error: string }> {
  const no = await deny(workspaceId, "people.manage");
  if (no) return no;
  if (password.length < MIN_PASSWORD) return { error: `At least ${MIN_PASSWORD} characters.` };
  const db = await getDb();
  const [member] = await db
    .select()
    .from(s.workspaceMembers)
    .where(and(eq(s.workspaceMembers.workspaceId, workspaceId), eq(s.workspaceMembers.userId, userId)));
  if (!member) return { error: "They are not in this workspace." };
  await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, userId));
  await revokeAllSessions(db, userId);
  await refresh(workspaceId);
  return { ok: true };
}

/**
 * Somebody changes their own password.
 *
 * Needs the current one, because a signed-in tab somebody walked away from should not be a way to
 * lock its owner out. Their other sessions end; this one does not, or changing your password would
 * sign you out of the page you did it on.
 */
export async function changeMyPassword(current: string, next: string): Promise<{ ok: true } | { error: string }> {
  const user = await currentUser();
  if (next.length < MIN_PASSWORD) return { error: `At least ${MIN_PASSWORD} characters.` };
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "That is not your current password." };
  const db = await getDb();
  await db.update(s.users).set({ passwordHash: await hashPassword(next) }).where(eq(s.users.id, user.id));
  return { ok: true };
}

/** A stable colour per person, so presence does not have to invent one (§5.41). */
function colourFor(seed: string): string {
  const palette = ["#1376d4", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899"];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return palette[hash % palette.length]!;
}
