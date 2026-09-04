import { notFound } from "next/navigation";
import { GraphBrowser } from "@/components/workspace/GraphBrowser";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function GraphPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [snapshot, { spaces }] = await Promise.all([graphSnapshot(await getDb(), workspace.id), getWorkspaceShell(workspace.id, user.id)]);
  return <GraphBrowser workspaceId={workspace.id} slug={slug} snapshot={snapshot} spaces={spaces} />;
}
