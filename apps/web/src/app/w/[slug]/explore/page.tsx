import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { explorerGraph } from "@/lib/explorer";
import { getWorkspaceBySlug } from "@/lib/data";
import { GraphExplorer } from "@/components/explorer/GraphExplorer";

/**
 * Graph explorer: the whole workspace graph as a navigable node-link view. Boards are curated
 * slices you compose by hand; this is everything at once.
 */
export default async function ExplorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const graph = await explorerGraph(db, workspace.id);
  return <GraphExplorer graph={graph} workspaceId={workspace.id} slug={slug} />;
}
