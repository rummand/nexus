import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";

/** Workspace knowledge graph summary: entities (with board usage), kinds, relation kinds. */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const db = await getDb();
  return NextResponse.json(await graphSnapshot(db, workspaceId));
}
