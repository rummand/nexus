import { notFound } from "next/navigation";
import { BoardGrid } from "@/components/workspace/BoardGrid";
import { PageHeader } from "@/components/workspace/PageHeader";
import { EmptyState } from "@/components/ui";
import { getBoardsForWorkspace, getWorkspaceBySlug } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function FavoritesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const boards = (await getBoardsForWorkspace(workspace.id, user.id)).filter((b) => b.favorite);
  return (
    <>
      <PageHeader title="Favourites" subtitle="Boards you starred" />
      {boards.length ? <BoardGrid boards={boards} /> : <EmptyState title="No favourites yet" hint="Star a board to keep it one click away." />}
    </>
  );
}
