import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getVersionDocument } from "@/lib/versions";

type Params = { params: Promise<{ boardId: string; versionId: string }> };

/** The document stored in one checkpoint (used by the History panel's compare view). */
export async function GET(_req: Request, { params }: Params) {
  const { boardId, versionId } = await params;
  const db = await getDb();
  const document = await getVersionDocument(db, boardId, versionId);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document });
}
