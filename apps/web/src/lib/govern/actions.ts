"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { currentUser } from "@/lib/session";
import { getChangeSet } from "@/lib/change/read";
import { maySign } from "./owners";
import { ownerRules, standingFor } from "./read";

/**
 * Declaring owners, and putting your name to a branch (#141, §5.93).
 *
 * Two powers, deliberately different. Deciding *who* owns part of the model is administrative —
 * it decides whose agreement everything else needs, which is the most consequential setting in
 * the product. Actually approving is neither administrative nor ordinary editing: it is a
 * standing the rule itself confers, and checking it against `graph.edit` would mean every editor
 * could approve their own work.
 */

const now = () => new Date().toISOString();

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

export async function setModelOwner(input: {
  workspaceId: string;
  scope: s.ModelOwnerRow["scope"];
  scopeValue: string;
  userId?: string;
  teamId?: string;
}): Promise<{ id: string } | { error: string }> {
  // Who decides whose agreement everything else needs is a people question, not a modelling one.
  const no = await deny(input.workspaceId, "people.manage");
  if (no) return no;
  if (!input.userId && !input.teamId) return { error: "A rule has to name somebody: a person or a team." };
  if (input.userId && input.teamId) return { error: "A rule names a person or a team, not both." };
  if (input.scope !== "everything" && !input.scopeValue.trim()) {
    return { error: input.scope === "subtree" ? "Which part of the model?" : "Which type?" };
  }

  const db = await getDb();
  const id = `own_${nanoid(10)}`;
  await db.insert(s.modelOwners).values({
    id,
    workspaceId: input.workspaceId,
    scope: input.scope,
    scopeValue: input.scope === "everything" ? "" : input.scopeValue.trim(),
    userId: input.userId ?? null,
    teamId: input.teamId ?? null,
    createdAt: now(),
  });
  revalidatePath("/", "layout");
  return { id };
}

export async function removeModelOwner(workspaceId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const no = await deny(workspaceId, "people.manage");
  if (no) return no;
  const db = await getDb();
  await db.delete(s.modelOwners).where(and(eq(s.modelOwners.id, id), eq(s.modelOwners.workspaceId, workspaceId)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Put your name to a branch, for one rule you hold.
 *
 * Not guarded by a capability: the entitlement *is* the rule, and it is checked here against the
 * person signing. An administrator who owns nothing may not approve on somebody's behalf — they
 * may override the gate entirely at the merge, which is a different act with a different record
 * and their name on it (§5.93).
 */
export async function approveChangeSet(changeSetId: string, ruleId: string, note?: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const set = await getChangeSet(db, changeSetId);
  if (!set) return { error: "That change set is gone." };
  if (set.status === "delivered") return { error: "This has been delivered; approving it now would mean nothing." };

  const user = await currentUser();
  const member = await db.query.workspaceMembers.findFirst({
    where: and(eq(s.workspaceMembers.workspaceId, set.workspaceId), eq(s.workspaceMembers.userId, user.id)),
  });
  if (!member) return { error: "That workspace is not yours to approve in." };

  const rules = await ownerRules(db, set.workspaceId);
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) return { error: "That rule is gone." };

  const teams = await db.select({ teamId: s.teamMembers.teamId }).from(s.teamMembers).where(eq(s.teamMembers.userId, user.id));
  if (!maySign(rule, { userId: user.id, teamIds: teams.map((t) => t.teamId) })) {
    return { error: `That is ${rule.ownerLabel}'s to approve, not yours.` };
  }

  // It has to still be a rule this branch actually triggers: approving something you do not
  // affect is a signature that means nothing, and it would satisfy the gate.
  const standing = await standingFor(db, set.workspaceId, changeSetId, set.changes);
  if (!standing.required.some((r) => r.rule.id === ruleId)) {
    return { error: "This branch does not touch anything you own." };
  }

  await db.insert(s.changeSetApprovals).values({
    changeSetId,
    ruleId,
    byId: user.id,
    byName: user.name,
    note: (note ?? "").trim().slice(0, 500),
    createdAt: now(),
  }).onConflictDoNothing();

  const slug = await slugOf(set.workspaceId);
  if (slug) revalidatePath(`/w/${slug}/roadmap`);
  return { ok: true };
}

/** Take your name off it, while it is still open. */
export async function withdrawApproval(changeSetId: string, ruleId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const set = await getChangeSet(db, changeSetId);
  if (!set) return { error: "That change set is gone." };
  if (set.status === "delivered") return { error: "This has been delivered; the approval is part of the record now." };

  const user = await currentUser();
  const [row] = await db.select().from(s.changeSetApprovals)
    .where(and(eq(s.changeSetApprovals.changeSetId, changeSetId), eq(s.changeSetApprovals.ruleId, ruleId)));
  if (!row) return { ok: true };
  if (row.byId !== user.id) return { error: `That is ${row.byName}'s approval to withdraw.` };

  await db.delete(s.changeSetApprovals)
    .where(and(eq(s.changeSetApprovals.changeSetId, changeSetId), eq(s.changeSetApprovals.ruleId, ruleId)));
  const slug = await slugOf(set.workspaceId);
  if (slug) revalidatePath(`/w/${slug}/roadmap`);
  return { ok: true };
}
