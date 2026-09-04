import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { runQuery } from "@/lib/query";

/** POST { workspaceId, q } → structured graph query results. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { workspaceId?: string; q?: string } | null;
  if (!body?.workspaceId || typeof body.q !== "string") return NextResponse.json({ error: "workspaceId and q are required" }, { status: 400 });
  const db = await getDb();
  return NextResponse.json(await runQuery(db, body.workspaceId, body.q));
}
