import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { entityDetail } from "@/lib/graph";

export async function GET(_req: Request, { params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  const db = await getDb();
  const detail = await entityDetail(db, entityId);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}
