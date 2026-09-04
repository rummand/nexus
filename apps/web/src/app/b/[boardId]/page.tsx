import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardCanvas } from "@/canvas/BoardCanvas";
import { parseDocument } from "@/canvas/document";
import { getBoardWithContext } from "@/lib/data";
import { currentUser } from "@/lib/session";

type Props = { params: Promise<{ boardId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { boardId } = await params;
  const board = await getBoardWithContext(boardId);
  return { title: board ? `${board.name} · Nexus` : "Board · Nexus" };
}

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params;
  const [board, user] = await Promise.all([getBoardWithContext(boardId), currentUser()]);
  if (!board) notFound();
  return (
    <div className="h-full w-full">
      <BoardCanvas
        document={parseDocument(board.document)}
        header={{
          boardId: board.id,
          name: board.name,
          room: { id: board.room.id, name: board.room.name, emoji: board.room.emoji },
          workspaceSlug: board.workspace.slug,
          user: { name: user.name, color: user.color },
        }}
      />
    </div>
  );
}
