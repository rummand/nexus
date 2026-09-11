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
import { BranchTreeView } from "@/components/tree/BranchTreeView";

/**
 * The tree: every branch and every commit (§5.84).
 *
 * Read whole on the server. A workspace's history is unbounded, so the trunk is capped — the
 * page says so rather than pretending the drawing is the whole past.
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
    <div className="studio-home-main tree-page" data-tree-page>
      <div className="studio-home-topbar">
        <div>
          <span>Every branch, every commit</span>
          <h1>The tree</h1>
        </div>
      </div>
      <p className="tree-intro">
        Time runs down the page, newest first. <b>main</b> is the left-hand line — the estate as we
        currently believe it to be. Every change set is a line of its own, cut from the state of
        main it was written against, landing back when it is delivered. Click anything to see what
        it carries; click a branch to stand on it.
      </p>
      <BranchTreeView
        slug={slug}
        workspaceId={workspace.id}
        tree={tree}
        names={names}
        currentRef={checkout.ref.kind === "main" ? "main" : checkout.ref.id}
      />
    </div>
  );
}

export const metadata = { title: "The tree · Nexus" };
