import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { boards } from "@/db/schema";
import { migrateDocument, parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";

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
    document: parseDocument(board.document),
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
  const [row] = await db
    .update(boards)
    .set({ document: serializeDocument(doc), updatedAt })
    .where(eq(boards.id, boardId))
    .returning({ id: boards.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt });
}
