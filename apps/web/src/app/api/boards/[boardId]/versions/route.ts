import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { boards } from "@/db/schema";
import { parseDocument } from "@/canvas/document";
import { currentUser } from "@/lib/session";
import { createVersion, listVersions } from "@/lib/versions";

type Params = { params: Promise<{ boardId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { boardId } = await params;
  const db = await getDb();
  return NextResponse.json({ versions: await listVersions(db, boardId) });
}

/** Manual checkpoint of the stored document. Body: { label?: string, document?: CanvasDocument }. */
export async function POST(req: Request, { params }: Params) {
  const { boardId } = await params;
  const body = (await req.json().catch(() => ({}))) as { label?: string; document?: unknown };
  const db = await getDb();
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await currentUser();
  const doc = body.document && typeof body.document === "object" ? parseDocument(JSON.stringify(body.document)) : parseDocument(board.document);
  const id = await createVersion(db, boardId, doc, "manual", body.label ?? "", user.id);
  return NextResponse.json({ id, versions: await listVersions(db, boardId) });
}
