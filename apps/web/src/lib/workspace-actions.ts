"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUser } from "@/lib/session";

/**
 * Making a second workspace (§5.48).
 *
 * Everything below the workspace row has always been scoped to one — entities, boards, agents,
 * keys, providers, batches — so this adds no model. What it adds is the one thing that made the
 * scoping theoretical: a way to have two, and a way to tell which one you are in.
 *
 * The person who makes it is its owner, which is the only sensible answer and also the rule that
 * keeps §5.46 true: a workspace with no owner is one nobody can add anybody to.
 */

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || `workspace-${nanoid(6)}`
  );
}

export async function createWorkspace(name: string): Promise<{ error: string } | never> {
  const user = await currentUser();
  const label = name.trim();
  if (!label) return { error: "Give it a name — the organisation, or the part of it this models." };

  const db = await getDb();
  let slug = slugify(label);
  // Slugs are the address bar, so a clash is resolved rather than refused: somebody naming their
  // workspace the same as another organisation's is not doing anything wrong.
  if (await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) })) slug = `${slug}-${nanoid(4).toLowerCase()}`;

  const id = `ws_${nanoid(10)}`;
  await db.insert(s.workspaces).values({ id, slug, name: label });
  await db.insert(s.workspaceMembers).values({ workspaceId: id, userId: user.id, role: "owner" });
  /*
   * One space, so the first board has somewhere to go. A workspace that opens on "create a space
   * before you can create a board" is a workspace that opens on a form.
   */
  await db.insert(s.spaces).values({ id: `space_${nanoid(10)}`, workspaceId: id, name: "Architecture", description: "Where the models live.", emoji: "🗂️" });

  revalidatePath("/", "layout");
  redirect(`/w/${slug}`);
}
