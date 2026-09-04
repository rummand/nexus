import { notFound } from "next/navigation";
import { HomeMain } from "@/components/workspace/HomeMain";
import { getBoardsForWorkspace, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function FavoritesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [{ spaces }, boards] = await Promise.all([getWorkspaceShell(workspace.id, user.id), getBoardsForWorkspace(workspace.id, user.id)]);
  return <HomeMain workspaceId={workspace.id} heading="Starred" meta="Boards you starred" boards={boards.filter((b) => b.favorite)} spaces={spaces} mode="starred" />;
}
