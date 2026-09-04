import { notFound } from "next/navigation";
import { GraphBrowser } from "@/components/workspace/GraphBrowser";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { computeProposals } from "@/lib/proposals";
import { getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function GraphPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const db = await getDb();
  const [snapshot, { spaces }, proposals] = await Promise.all([graphSnapshot(db, workspace.id), getWorkspaceShell(workspace.id, user.id), computeProposals(db, workspace.id)]);
  return <GraphBrowser workspaceId={workspace.id} slug={slug} snapshot={snapshot} spaces={spaces} proposals={proposals} />;
}
