import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { parseDocument } from "@/canvas/document";
import { composeBoard } from "@/lib/compose/run";

/** Compile a board script and return the document it produces. Reads the graph; writes nothing. */
export async function POST(request: Request) {
  const body = (await request.json()) as { workspaceId?: string; script?: string; document?: unknown; mode?: "rebuild" | "extend" };
  if (!body.workspaceId || typeof body.script !== "string") {
    return NextResponse.json({ error: "workspaceId and script are required" }, { status: 400 });
  }
  const db = await getDb();
  const result = await composeBoard(
    db,
    body.workspaceId,
    body.script,
    // the client posts the live document as an object; parseDocument takes the stored string
    parseDocument(body.document ? JSON.stringify(body.document) : null),
    body.mode === "extend" ? "extend" : "rebuild",
  );
  return NextResponse.json(result);
}
