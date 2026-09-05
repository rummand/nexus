import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/** Liveness + readiness: runs migrations/seed on first call and checks the database answers. */
export async function GET() {
  try {
    const db = await getDb();
    const [row] = await db.all<{ n: number }>(sql`select count(*) as n from workspaces`);
    return NextResponse.json({ ok: true, workspaces: row?.n ?? 0, database: (process.env.DATABASE_URL ?? "file:./data/nexus.db").startsWith("file:") ? "sqlite" : "remote" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
