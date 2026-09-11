import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardCanvasClient } from "@/canvas/BoardCanvasClient";
import { parseDocument } from "@/canvas/document";
import { getBoardWithContext } from "@/lib/data";
import { getDb } from "@/db/client";
import { hydrateDocument } from "@/lib/graph";
import { currentUser } from "@/lib/session";
import { currentCheckout } from "@/lib/change/checkout";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";

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
  const db = await getDb();
  /*
   * A board is opened in the world you are standing in (§5.82). The ref is read here rather than
   * fetched by the canvas, so the chrome says which world this is on the first paint instead of
   * flickering from main to a plan once a request comes back.
   */
  const checkout = await currentCheckout(db, board.workspaceId, user.id);
  const document = await hydrateDocument(db, parseDocument(board.document));
  /*
   * A staged import board needs to know whether its batch is still open (§5.36). Read here rather
   * than in the bar: an approved import should say so the moment the board is opened, not after a
   * round trip that lets somebody press Approve on something already written.
   */
  const batchId = document.meta?.importBatch;
  const batch = batchId ? await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) }) : null;
  return (
    <BoardCanvasClient
      document={document}
      boardRevision={board.revision}
      importStatus={batch ? batch.status : batchId ? "gone" : null}
      header={{
        boardId: board.id,
        workspaceId: board.workspaceId,
        name: board.name,
        space: { id: board.space.id, name: board.space.name, emoji: board.space.emoji },
        workspace: { slug: board.workspace.slug, name: board.workspace.name },
        user: { id: user.id, name: user.name, color: user.color },
        at: checkout.ref,
      }}
    />
  );
}
