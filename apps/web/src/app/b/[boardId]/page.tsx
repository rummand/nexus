import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardCanvasClient } from "@/canvas/BoardCanvasClient";
import { parseDocument } from "@/canvas/document";
import { getBoardWithContext } from "@/lib/data";
import { getDb } from "@/db/client";
import { hydrateDocument } from "@/lib/graph";
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
  const document = await hydrateDocument(await getDb(), parseDocument(board.document));
  return (
    <BoardCanvasClient
      document={document}
      header={{
        boardId: board.id,
        workspaceId: board.workspaceId,
        name: board.name,
        space: { id: board.space.id, name: board.space.name, emoji: board.space.emoji },
        workspace: { slug: board.workspace.slug, name: board.workspace.name },
        user: { name: user.name, color: user.color },
      }}
    />
  );
}
