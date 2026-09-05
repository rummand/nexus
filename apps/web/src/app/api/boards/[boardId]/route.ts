import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { boards } from "@/db/schema";
import { migrateDocument, parseDocument, type CanvasDocument } from "@/canvas/document";
import { hydrateDocument, syncBoardToGraph } from "@/lib/graph";
import { saveBoardDocument } from "@/lib/board-save";

type Params = { params: Promise<{ boardId: string }> };

/** Load a board's document. */
export async function GET(_req: Request, { params }: Params) {
  const { boardId } = await params;
  const db = await getDb();
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: board.id,
    name: board.name,
    updatedAt: board.updatedAt,
    revision: board.revision,
    document: await hydrateDocument(db, parseDocument(board.document)),
  });
}

/**
 * Save a board's document (autosave). Body: { document, revision? }.
 *
 * When a revision is sent, the write is conditional on it: two people editing the same board no
 * longer overwrite each other silently — the loser is told, and can reload. A client that sends
 * no revision keeps the old last-writer-wins behaviour, so nothing breaks while callers catch up.
 */
export async function PUT(req: Request, { params }: Params) {
  const { boardId } = await params;
  let body: { document?: unknown; revision?: unknown };
  try {
    body = (await req.json()) as { document?: unknown; revision?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.document || typeof body.document !== "object") {
    return NextResponse.json({ error: "document is required" }, { status: 400 });
  }
  const doc = migrateDocument(body.document as Partial<CanvasDocument>);
  const db = await getDb();
  const result = await saveBoardDocument(db, boardId, doc, typeof body.revision === "number" ? body.revision : null);

  if (result.status === "notFound") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.status === "conflict") {
    // Somebody else saved between this client loading the board and saving it.
    return NextResponse.json(
      { error: "This board changed somewhere else while you were editing it.", conflict: true, revision: result.revision },
      { status: 409 },
    );
  }
  await syncBoardToGraph(db, { id: boardId, workspaceId: result.workspaceId }, doc);
  return NextResponse.json({ ok: true, updatedAt: result.updatedAt, revision: result.revision });
}
