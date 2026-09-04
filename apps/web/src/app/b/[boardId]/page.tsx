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
    <BoardCanvas
      document={parseDocument(board.document)}
      header={{
        boardId: board.id,
        name: board.name,
        space: { id: board.space.id, name: board.space.name, emoji: board.space.emoji },
        workspace: { slug: board.workspace.slug, name: board.workspace.name },
        user: { name: user.name, color: user.color },
      }}
    />
  );
}
