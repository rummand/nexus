import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { neighborhood } from "@/lib/graph";
import type { NeighborhoodRequest, NeighborhoodResponse } from "@/lib/graph-types";

/** POST { workspaceId, entityIds, depth, direction, relationKinds? } → entities + relations. */
export async function POST(req: Request) {
  let body: NeighborhoodRequest;
  try {
    body = (await req.json()) as NeighborhoodRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.workspaceId || !Array.isArray(body.entityIds)) return NextResponse.json({ error: "workspaceId and entityIds are required" }, { status: 400 });
  const db = await getDb();
  const depth = Math.max(0, Math.min(3, Number(body.depth) || 0));
  const direction = body.direction === "out" || body.direction === "in" ? body.direction : "both";
  const { entities, relations } = await neighborhood(db, body.workspaceId, body.entityIds.slice(0, 200), depth, direction, body.relationKinds);
  const res: NeighborhoodResponse = {
    entities: entities.map((e) => ({ id: e.id, kind: e.kind, name: e.name, description: e.description })),
    relations: relations.map((r) => ({ id: r.id, fromEntityId: r.fromEntityId, toEntityId: r.toEntityId, kind: r.kind })),
  };
  return NextResponse.json(res);
}
