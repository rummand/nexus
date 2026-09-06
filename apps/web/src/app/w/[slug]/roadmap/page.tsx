import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { graphRows, listChangeSets } from "@/lib/change/read";
import { project, projectAll, settled } from "@/lib/change/project";
import { impactOf } from "@/lib/change/impact";
import { summarise } from "@/lib/change/types";
import { Roadmap, type ChangeSetView, type EntityOption } from "@/components/roadmap/Roadmap";

/**
 * The roadmap: the model in time.
 *
 * Every projection is computed here, on the server, from the graph rows and the change sets. The
 * client is handed the answers rather than the graph — a workspace's entities and relations are
 * not a payload you want to ship twice per plan.
 */
export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const [{ entities, relations }, sets] = await Promise.all([graphRows(db, workspace.id), listChangeSets(db, workspace.id)]);

  const byId = new Map(entities.map((e) => [e.id, { name: e.name }]));
  const views: ChangeSetView[] = sets.map((set) => {
    // A change set can connect something it introduces in the same breath, so names have to
    // include its own additions — otherwise the row reads as a raw id nobody recognises.
    const names = new Map(byId);
    for (const change of set.changes) {
      if (change.op === "addEntity" && change.entityId) {
        names.set(change.entityId, { name: String((change.payload as { name?: string }).name ?? "New object") });
      }
    }
    const projection = project(entities, relations, set.changes);
    const retirements = [...projection.retired];
    const impact = retirements.length ? impactOf(entities, relations, retirements) : null;
    return {
      id: set.id,
      name: set.name,
      description: set.description,
      status: set.status,
      targetDate: set.targetDate,
      deliveredAt: set.deliveredAt,
      summary: summarise(projection),
      problems: projection.problems,
      changes: set.changes.map((change) => ({
        id: change.id,
        op: change.op,
        note: change.note,
        entityId: change.entityId,
        // Resolve the names here: the client should never have to hold the graph to render a line.
        subject: subjectOf(change.op, change.entityId, change.payload, names),
        detail: describeChange(change.op, change.payload, names),
      })),
      impact: impact
        ? {
            summary: impact.summary,
            dependants: impact.dependants.slice(0, 8).map((d) => ({ id: d.entity.id, name: d.entity.name, kind: d.entity.kind, nature: d.nature, orphaned: d.orphaned })),
            more: Math.max(0, impact.dependants.length - 8),
            orphaned: impact.orphaned.length,
            indirect: impact.indirect.length,
          }
        : null,
    };
  });

  // The estate after everything that is planned but not yet delivered — the to-be worth quoting.
  const pending = sets.filter((set) => set.status === "draft" || set.status === "planned");
  const future = settled(projectAll(entities, relations, pending));

  const options: EntityOption[] = entities
    .map((e) => ({ id: e.id, name: e.name, kind: e.kind }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Roadmap
      workspaceId={workspace.id}
      slug={slug}
      sets={views}
      entities={options}
      asIs={{ entities: entities.length, relations: relations.length }}
      toBe={{ entities: future.entities.length, relations: future.relations.length }}
    />
  );
}

/** What the row is about: the object for most ops, the two ends for a relation. */
function subjectOf(op: string, entityId: string | null, payload: Record<string, unknown>, names: Map<string, { name: string }>): string {
  if (op === "addEntity") return String((payload as { name?: string }).name ?? "Unnamed");
  if (op === "addRelation" || op === "removeRelation") return String((payload as { kind?: string }).kind ?? "relation");
  return names.get(entityId ?? "")?.name ?? "(no longer in the graph)";
}

function describeChange(op: string, payload: Record<string, unknown>, byId: Map<string, { name: string }>): string {
  const name = (id: unknown) => byId.get(String(id ?? ""))?.name ?? String(id ?? "");
  switch (op) {
    case "addEntity":
      return String(payload.kind ?? "") || "New object";
    case "setAttribute":
      return payload.value === "" ? `clear ${String(payload.key ?? "")}` : `${String(payload.key ?? "")} → ${String(payload.value ?? "")}`;
    case "addRelation":
      return `${name(payload.fromEntityId)} → ${name(payload.toEntityId)}`;
    default:
      return "";
  }
}
