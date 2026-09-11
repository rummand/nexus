"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { currentUser } from "@/lib/session";
import { getCampaign } from "./read";
import { burnDown, canClose, type ObjectState } from "./state";

/**
 * Working a campaign (§5.85).
 *
 * Every write here is somebody putting their name to a judgement about an object, which is why
 * none of them is open: validation is the one thing an agent may never do (#134), and an
 * anonymous validation is a badge rather than a statement.
 */

const now = () => new Date().toISOString();

export type CampaignResult = { ok: true } | { error: string };

async function denyCampaign(campaignId: string, capability: "graph.edit") {
  const db = await getDb();
  const row = await db.query.campaigns.findFirst({ where: eq(s.campaigns.id, campaignId) });
  if (!row) return { error: "That campaign is gone." };
  return deny(row.workspaceId, capability);
}

export async function createCampaign(input: {
  workspaceId: string;
  name: string;
  description?: string;
  scope: Record<string, unknown>;
  checks: string[];
}): Promise<{ id: string } | { error: string }> {
  const no = await deny(input.workspaceId, "graph.edit");
  if (no) return no;
  const user = await currentUser();
  const db = await getDb();
  const id = `cmp_${nanoid(10)}`;
  const at = now();
  await db.insert(s.campaigns).values({
    id,
    workspaceId: input.workspaceId,
    name: input.name.trim() || "Untitled campaign",
    description: (input.description ?? "").trim(),
    scope: JSON.stringify(input.scope ?? {}),
    checks: JSON.stringify(input.checks ?? []),
    status: "open",
    createdById: user.id,
    createdAt: at,
    updatedAt: at,
  });
  revalidatePath("/", "layout");
  return { id };
}

/**
 * Move one object to a state.
 *
 * The rules that live here rather than in the state machine, because they are about *writing*
 * rather than about reading: a waiver needs a reason and an expiry, a question needs to be
 * addressed to somebody, and a validation records what the object looked like when it was given
 * — which is what lets the burn-down go back up when somebody edits it afterwards.
 */
export async function setObjectState(input: {
  campaignId: string;
  entityId: string;
  state: ObjectState;
  note?: string;
  expiresAt?: string | null;
  askedOfId?: string | null;
}): Promise<CampaignResult> {
  const no = await denyCampaign(input.campaignId, "graph.edit");
  if (no) return no;
  const user = await currentUser();
  const db = await getDb();

  const entity = await db.query.entities.findFirst({ where: eq(s.entities.id, input.entityId) });
  if (!entity) return { error: "That object is gone." };

  const where = and(eq(s.campaignObjects.campaignId, input.campaignId), eq(s.campaignObjects.entityId, input.entityId));

  /* Untouched is the absence of a decision, so it is a delete rather than a state. */
  if (input.state === "untouched") {
    await db.delete(s.campaignObjects).where(where);
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const note = (input.note ?? "").trim();
  if (input.state === "waived") {
    if (!note) return { error: "A waiver needs a reason. “Accepted as is” with no reason is how a model rots." };
    if (!input.expiresAt) return { error: "A waiver needs an expiry, or it quietly becomes permanent." };
  }
  if (input.state === "needs-decision" && !note) {
    return { error: "Say what the question is, so somebody can answer it." };
  }

  const at = now();
  await db
    .insert(s.campaignObjects)
    .values({
      campaignId: input.campaignId,
      entityId: input.entityId,
      state: input.state,
      note,
      expiresAt: input.state === "waived" ? input.expiresAt ?? null : null,
      askedOfId: input.state === "needs-decision" ? input.askedOfId ?? null : null,
      /* The object as it was. A fact sheet validated in March and edited in June is not validated. */
      atVersion: input.state === "validated" ? entity.updatedAt : "",
      byId: user.id,
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: [s.campaignObjects.campaignId, s.campaignObjects.entityId],
      set: {
        state: input.state,
        note,
        expiresAt: input.state === "waived" ? input.expiresAt ?? null : null,
        askedOfId: input.state === "needs-decision" ? input.askedOfId ?? null : null,
        atVersion: input.state === "validated" ? entity.updatedAt : "",
        byId: user.id,
        updatedAt: at,
      },
    });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Close a campaign, if its scope says it may be closed.
 *
 * Refused while anything is still untouched. A campaign that can be closed with work left and
 * nobody's name against it is one nobody believes the next time.
 */
export async function closeCampaign(campaignId: string): Promise<CampaignResult> {
  const no = await denyCampaign(campaignId, "graph.edit");
  if (no) return no;
  const db = await getDb();
  const detail = await getCampaign(db, campaignId);
  if (!detail) return { error: "That campaign is gone." };

  const verdict = canClose(burnDown(detail.objects.map((o) => o.standing)));
  if (!verdict.ok) return { error: verdict.why };

  await db.update(s.campaigns).set({ status: "closed", updatedAt: now() }).where(eq(s.campaigns.id, campaignId));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reopenCampaign(campaignId: string): Promise<CampaignResult> {
  const no = await denyCampaign(campaignId, "graph.edit");
  if (no) return no;
  const db = await getDb();
  await db.update(s.campaigns).set({ status: "open", updatedAt: now() }).where(eq(s.campaigns.id, campaignId));
  revalidatePath("/", "layout");
  return { ok: true };
}

