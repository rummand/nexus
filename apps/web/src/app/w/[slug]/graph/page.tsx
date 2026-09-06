import { notFound } from "next/navigation";
import { GraphBrowser } from "@/components/workspace/GraphBrowser";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { computeProposals } from "@/lib/proposals";
import { healthReport } from "@/lib/health";
import { measureAuthority } from "@/lib/knowledge";
import { modelConfigured, modelStatus } from "@/lib/agent/propose";
import { lastRun } from "@/lib/agent/store";
import * as sc from "@/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function GraphPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ entity?: string }> }) {
  const [{ slug }, { entity }] = await Promise.all([params, searchParams]);
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const db = await getDb();
  const [snapshot, { spaces }, proposals, entities, relations, run] = await Promise.all([
    graphSnapshot(db, workspace.id),
    getWorkspaceShell(workspace.id, user.id),
    computeProposals(db, workspace.id),
    db.select().from(sc.entities).where(eq(sc.entities.workspaceId, workspace.id)),
    db.select().from(sc.relations_).where(eq(sc.relations_.workspaceId, workspace.id)),
    lastRun(db, workspace.id),
  ]);
  const health = healthReport(entities, relations);
  // The practice behind each measure comes from the knowledge base, on the server: the corpus is
  // megabytes and has no business in the browser bundle.
  /**
   * Whether the agent can be asked is a server fact — the key never reaches the browser — so it is
   * resolved here and passed as a boolean and a sentence.
   */
  const agent = { ready: modelConfigured(), hint: modelStatus(), lastAskedAt: run?.at ?? null, grounded: run?.grounded ?? [] };
  return <GraphBrowser workspaceId={workspace.id} slug={slug} snapshot={snapshot} spaces={spaces} proposals={proposals} initialEntityId={entity ?? null} health={health} authority={measureAuthority()} agent={agent} />;
}
