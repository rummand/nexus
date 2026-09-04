import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

/** Stable deep link for an entity: /e/:id → the workspace's Knowledge graph page with the drawer open. */
export async function GET(req: Request, { params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  const db = await getDb();
  const [row] = await db.select({ slug: s.workspaces.slug }).from(s.entities).innerJoin(s.workspaces, eq(s.entities.workspaceId, s.workspaces.id)).where(eq(s.entities.id, entityId));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(new URL(`/w/${row.slug}/graph?entity=${encodeURIComponent(entityId)}`, req.url));
}
