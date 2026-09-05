import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { dialect, getDb } from "@/db/client";
import * as s from "@/db/schema";

/** Liveness + readiness: runs migrations/seed on first call and checks the database answers. */
export async function GET() {
  try {
    const db = await getDb();
    // A portable count: db.all() is libsql's, and this endpoint has to answer on either dialect.
    const [row] = await db.select({ n: count() }).from(s.workspaces);
    return NextResponse.json({ ok: true, workspaces: Number(row?.n ?? 0), database: dialect() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
