import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { boards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { restoreVersion, listVersions } from "@/lib/versions";
import { syncBoardToGraph } from "@/lib/graph";

export async function POST(_req: Request, { params }: { params: Promise<{ boardId: string; versionId: string }> }) {
  const { boardId, versionId } = await params;
  const db = await getDb();
  const user = await currentUser();
  const doc = await restoreVersion(db, boardId, versionId, user.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (board) await syncBoardToGraph(db, { id: board.id, workspaceId: board.workspaceId }, doc);
  return NextResponse.json({ document: doc, versions: await listVersions(db, boardId) });
}
