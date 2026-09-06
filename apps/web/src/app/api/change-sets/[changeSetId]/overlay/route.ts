import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getChangeSet, graphRows } from "@/lib/change/read";
import { project } from "@/lib/change/project";
import { impactOf } from "@/lib/change/impact";

/**
 * A change set as something a board can be *seen through*.
 *
 * The answer is entity ids and a sentence, not a graph: the board already holds the cards, and the
 * overlay's whole job is to tint the ones the plan touches. Additions that are not on the board
 * come back in full, because the only useful thing to do with them is offer to place them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ changeSetId: string }> }) {
  const { changeSetId } = await params;
  const db = await getDb();
  const set = await getChangeSet(db, changeSetId);
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { entities, relations } = await graphRows(db, set.workspaceId);
  const projection = project(entities, relations, set.changes);
  const byId = new Map(projection.entities.map((e) => [e.id, e]));
  const retired = [...projection.retired];

  return NextResponse.json({
    id: set.id,
    name: set.name,
    status: set.status,
    targetDate: set.targetDate,
    retired,
    changed: [...projection.changed],
    // Everything an addition needs to become a card, so placing one is a local operation.
    added: [...projection.added].map((id) => {
      const e = byId.get(id);
      return { id, name: e?.name ?? "", kind: e?.kind ?? "", description: e?.description ?? "" };
    }),
    problems: projection.problems.length,
    impact: retired.length ? impactOf(entities, relations, retired).summary : "",
  });
}
