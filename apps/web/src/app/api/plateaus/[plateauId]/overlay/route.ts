import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { graphRows, listChangeSets, listDependencies, listPlateaus } from "@/lib/change/read";
import { project } from "@/lib/change/project";
import { deliveryOrder } from "@/lib/change/order";
import { impactOf } from "@/lib/change/impact";

/**
 * A plateau as something a board can be seen through.
 *
 * The same shape a change set's overlay returns, so the canvas has one code path for "show me the
 * board at a state" whether that state is one plan or a named milestone made of several.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ plateauId: string }> }) {
  const { plateauId } = await params;
  const db = await getDb();
  const row = await db.query.plateaus.findFirst({ where: eq(s.plateaus.id, plateauId) });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ entities, relations }, sets, deps, plateaus] = await Promise.all([
    graphRows(db, row.workspaceId),
    listChangeSets(db, row.workspaceId),
    listDependencies(db, row.workspaceId),
    listPlateaus(db, row.workspaceId),
  ]);
  const members = new Set(plateaus.find((p) => p.id === plateauId)?.changeSetIds ?? []);
  const byId = new Map(sets.map((set) => [set.id, set]));
  const included = sets.filter((set) => members.has(set.id));
  const changes = deliveryOrder(included, deps).flatMap((id) => byId.get(id)?.changes ?? []);

  // Unsettled on purpose: the board wants to show what is going, not pretend it has already gone.
  const projection = project(entities, relations, changes);
  const projected = new Map(projection.entities.map((e) => [e.id, e]));
  const retired = [...projection.retired];

  return NextResponse.json({
    id: row.id,
    name: row.name,
    status: "plateau",
    targetDate: row.targetDate,
    retired,
    changed: [...projection.changed],
    added: [...projection.added].map((id) => {
      const e = projected.get(id);
      return { id, name: e?.name ?? "", kind: e?.kind ?? "", description: e?.description ?? "" };
    }),
    problems: projection.problems.length,
    impact: retired.length ? impactOf(entities, relations, retired).summary : "",
  });
}
