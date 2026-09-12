import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { boards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserOrNull } from "@/lib/session";
import { restoreVersion, listVersions } from "@/lib/versions";
import { syncBoardToGraph } from "@/lib/graph";
import { currentCheckout } from "@/lib/change/checkout";
import { person } from "@/lib/history/actor";

export async function POST(_req: Request, { params }: { params: Promise<{ boardId: string; versionId: string }> }) {
  const { boardId, versionId } = await params;
  const db = await getDb();
  const user = await currentUserOrNull();
  // A route handler answers a fetch, so it says no rather than redirecting to a form.
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const doc = await restoreVersion(db, boardId, versionId, user.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (board) {
    const at = await currentCheckout(db, board.workspaceId, user.id);
    await syncBoardToGraph(db, { id: board.id, workspaceId: board.workspaceId, name: board.name }, doc, {
      actor: person(user), ref: at.ref, userId: user.id,
    });
  }
  // The restore bumped the revision; hand it back so the editing tab keeps saving instead of
  // being told it is stale by its own restore.
  return NextResponse.json({ document: doc, revision: board?.revision ?? 0, versions: await listVersions(db, boardId) });
}
