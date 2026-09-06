import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

/** The named states a board can be viewed at. Enough to fill a picker; the overlay is a second call. */
export async function GET(req: Request) {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  const db = await getDb();
  const rows = await db
    .select({ id: s.plateaus.id, name: s.plateaus.name, targetDate: s.plateaus.targetDate })
    .from(s.plateaus)
    .where(eq(s.plateaus.workspaceId, workspaceId))
    .orderBy(s.plateaus.targetDate);
  return NextResponse.json({ plateaus: rows });
}
