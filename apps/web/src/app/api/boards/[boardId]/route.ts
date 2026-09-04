import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { boards } from "@/db/schema";
import { migrateDocument, parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";
import { hydrateDocument, syncBoardToGraph } from "@/lib/graph";
import { autoCheckpoint } from "@/lib/versions";

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
    document: await hydrateDocument(db, parseDocument(board.document)),
  });
}

/** Save a board's document (autosave). Body: { document: CanvasDocument }. */
export async function PUT(req: Request, { params }: Params) {
  const { boardId } = await params;
  let body: { document?: unknown };
  try {
    body = (await req.json()) as { document?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.document || typeof body.document !== "object") {
    return NextResponse.json({ error: "document is required" }, { status: 400 });
  }
  const doc = migrateDocument(body.document as Partial<CanvasDocument>);
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  // time-based checkpoint of the state we are about to overwrite
  const previous = await db.query.boards.findFirst({ where: eq(boards.id, boardId), columns: { document: true } });
  if (previous) await autoCheckpoint(db, boardId, parseDocument(previous.document));
  const [row] = await db
    .update(boards)
    .set({ document: serializeDocument(doc), updatedAt })
    .where(eq(boards.id, boardId))
    .returning({ id: boards.id, workspaceId: boards.workspaceId });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await syncBoardToGraph(db, row, doc);
  return NextResponse.json({ ok: true, updatedAt });
}
