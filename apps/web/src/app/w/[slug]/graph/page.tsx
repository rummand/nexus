import { notFound } from "next/navigation";
import { GraphBrowser } from "@/components/workspace/GraphBrowser";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { computeProposals } from "@/lib/proposals";
import { healthReport } from "@/lib/health";
import { measureAuthority } from "@/lib/knowledge";
import * as sc from "@/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function GraphPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ entity?: string }> }) {
  const [{ slug }, { entity }] = await Promise.all([params, searchParams]);
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const db = await getDb();
  const [snapshot, { spaces }, proposals, entities, relations] = await Promise.all([
    graphSnapshot(db, workspace.id),
    getWorkspaceShell(workspace.id, user.id),
    computeProposals(db, workspace.id),
    db.select().from(sc.entities).where(eq(sc.entities.workspaceId, workspace.id)),
    db.select().from(sc.relations_).where(eq(sc.relations_.workspaceId, workspace.id)),
  ]);
  const health = healthReport(entities, relations);
  // The practice behind each measure comes from the knowledge base, on the server: the corpus is
  // megabytes and has no business in the browser bundle.
  return <GraphBrowser workspaceId={workspace.id} slug={slug} snapshot={snapshot} spaces={spaces} proposals={proposals} initialEntityId={entity ?? null} health={health} authority={measureAuthority()} />;
}
