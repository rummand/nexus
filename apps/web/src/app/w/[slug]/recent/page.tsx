import { notFound } from "next/navigation";
import { HomeMain } from "@/components/workspace/HomeMain";
import { getBoardsForWorkspace, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function RecentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [{ spaces }, boards] = await Promise.all([getWorkspaceShell(workspace.id, user.id), getBoardsForWorkspace(workspace.id, user.id, { recentOnly: true, limit: 50 })]);
  return <HomeMain workspaceId={workspace.id} heading="Recent" meta="Boards you opened, most recent first" boards={boards} spaces={spaces} mode="recent" />;
}
