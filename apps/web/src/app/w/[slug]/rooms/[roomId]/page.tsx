import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { BoardGrid } from "@/components/workspace/BoardGrid";
import { InlineTitle } from "@/components/workspace/InlineTitle";
import { NewBoardButton } from "@/components/workspace/NewBoardButton";
import { PageHeader } from "@/components/workspace/PageHeader";
import { RoomSettings } from "@/components/workspace/RoomSettings";
import { renameRoom } from "@/lib/actions";
import { getBoardsForWorkspace, getRoom, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function RoomPage({ params }: { params: Promise<{ slug: string; roomId: string }> }) {
  const { slug, roomId } = await params;
  const [workspace, user, room] = await Promise.all([getWorkspaceBySlug(slug), currentUser(), getRoom(roomId)]);
  if (!workspace || !room || room.workspaceId !== workspace.id) notFound();
  const [boards, { teams }] = await Promise.all([getBoardsForWorkspace(workspace.id, user.id, { roomId }), getWorkspaceShell(workspace.id, user.id)]);

  return (
    <>
      <PageHeader
        icon={room.emoji}
        title={<InlineTitle value={room.name} onCommit={renameRoom.bind(null, room.id)} className="text-2xl font-semibold tracking-tight" />}
        subtitle={
          <span className="flex items-center gap-2">
            {room.team ? (
              <Link href={`/w/${slug}/teams/${room.team.id}`} className="inline-flex items-center gap-1 hover:text-ink-900"><span className="h-2 w-2 rounded-sm" style={{ background: room.team.color }} />{room.team.name}</Link>
            ) : (
              <span>Whole workspace</span>
            )}
            {room.visibility === "private" && <span className="inline-flex items-center gap-1"><Lock size={12} /> Private</span>}
            {room.description && <span>· {room.description}</span>}
          </span>
        }
        actions={
          <>
            <RoomSettings room={room} teams={teams} />
            <NewBoardButton workspaceId={workspace.id} roomId={room.id} />
          </>
        }
      />
      <BoardGrid boards={boards} showRoom={false} newBoard={{ workspaceId: workspace.id, roomId: room.id }} />
    </>
  );
}
