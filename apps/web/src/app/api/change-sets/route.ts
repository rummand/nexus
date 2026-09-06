import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

/**
 * The change sets a board can be viewed through.
 *
 * Just enough to fill a picker: the canvas has no business loading plans it is not showing, and
 * the overlay itself is a second call once one is chosen.
 */
export async function GET(req: Request) {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  const db = await getDb();
  const rows = await db
    .select({ id: s.changeSets.id, name: s.changeSets.name, status: s.changeSets.status, targetDate: s.changeSets.targetDate })
    .from(s.changeSets)
    .where(eq(s.changeSets.workspaceId, workspaceId))
    .orderBy(s.changeSets.targetDate);
  return NextResponse.json({ changeSets: rows });
}
