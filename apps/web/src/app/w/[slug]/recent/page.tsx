import { notFound } from "next/navigation";
import { BoardGrid } from "@/components/workspace/BoardGrid";
import { PageHeader } from "@/components/workspace/PageHeader";
import { EmptyState } from "@/components/ui";
import { getBoardsForWorkspace, getWorkspaceBySlug } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function RecentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const boards = await getBoardsForWorkspace(workspace.id, user.id, { recentOnly: true, limit: 50 });
  return (
    <>
      <PageHeader title="Recent" subtitle="Boards you have opened, most recent first" />
      {boards.length ? <BoardGrid boards={boards} /> : <EmptyState title="Nothing opened yet" hint="Boards you open will show up here." />}
    </>
  );
}
