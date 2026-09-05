import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { explorerGraph } from "@/lib/explorer";

/** The whole workspace graph as nodes + edges for the explorer. */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const db = await getDb();
  return NextResponse.json(await explorerGraph(db, workspaceId));
}
