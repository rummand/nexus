import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { workspaceHistory } from "@/lib/history/record";
import { listChangeSets } from "@/lib/change/read";
import { currentCheckout } from "@/lib/change/checkout";
import { branchTree } from "@/lib/change/tree";
import { RevisionExplorer } from "@/components/tree/RevisionExplorer";

/**
 * The tree: every branch and every commit, as a canvas you move through (§5.84, §5.86).
 *
 * Read whole on the server. A workspace's history is unbounded, so the trunk is capped — the
 * explorer says how many commits it is drawing rather than pretending it is the whole past.
 */

const CAP = 120;

export default async function TreePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();

  const db = await getDb();
  const [events, changeSets, plateauRows, checkout, entities] = await Promise.all([
    workspaceHistory(db, workspace.id, { limit: 600 }),
    listChangeSets(db, workspace.id),
    db.select({ id: s.plateaus.id, name: s.plateaus.name, targetDate: s.plateaus.targetDate }).from(s.plateaus).where(eq(s.plateaus.workspaceId, workspace.id)),
    currentCheckout(db, workspace.id, user.id),
    db.select({ id: s.entities.id, name: s.entities.name }).from(s.entities).where(eq(s.entities.workspaceId, workspace.id)),
  ]);

  const tree = branchTree({ events, changeSets, plateaus: plateauRows, limit: CAP });
  const names = Object.fromEntries(entities.map((e) => [e.id, e.name]));

  return (
    <RevisionExplorer
      slug={slug}
      workspaceId={workspace.id}
      tree={tree}
      names={names}
      currentRef={checkout.ref.kind === "main" ? "main" : checkout.ref.id}
    />
  );
}

export const metadata = { title: "The tree · Nexus" };
