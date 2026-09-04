import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { computeProposals } from "@/lib/proposals";

/** Agent proposals for a workspace (deterministic rules over the graph). */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const db = await getDb();
  return NextResponse.json({ proposals: await computeProposals(db, workspaceId) });
}
