import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { graphRows, listChangeSets, listDependencies, listPlateaus } from "@/lib/change/read";
import { diffStates, plateauState } from "@/lib/change/plateau";
import { healthReport } from "@/lib/health";
import { Plateaus, type PlateauView } from "@/components/roadmap/Plateaus";

/**
 * Plateaus: the named states the change sets produce.
 *
 * Every state and every diff is computed here from the graph rows. A plateau stores a name, a date
 * and a membership — never a copy of the estate — so it cannot drift from the model it describes,
 * which is precisely what happens to the slide it replaces.
 */
export default async function PlateausPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; vs?: string }>;
}) {
  const { slug } = await params;
  const { p, vs } = await searchParams;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const [{ entities, relations }, sets, deps, plateaus] = await Promise.all([
    graphRows(db, workspace.id),
    listChangeSets(db, workspace.id),
    listDependencies(db, workspace.id),
    listPlateaus(db, workspace.id),
  ]);

  const setById = new Map(sets.map((set) => [set.id, set]));
  const states = new Map(plateaus.map((plateau) => [plateau.id, plateauState(entities, relations, sets, deps, plateau.changeSetIds)]));
  const asIs = { entities, relations };

  const views: PlateauView[] = plateaus.map((plateau) => {
    const state = states.get(plateau.id)!;
    const health = healthReport(state.entities, state.relations);
    return {
      id: plateau.id,
      name: plateau.name,
      description: plateau.description,
      targetDate: plateau.targetDate,
      entities: state.entities.length,
      relations: state.relations.length,
      health: health.score,
      members: state.order.map((id) => ({ id, name: setById.get(id)?.name ?? "(deleted)", status: setById.get(id)?.status ?? "draft" })),
      incoherent: state.incoherent.map((i) => ({
        name: setById.get(i.changeSetId)?.name ?? i.changeSetId,
        missing: i.missing.map((m) => setById.get(m)?.name ?? m),
      })),
      problems: state.problems.length,
    };
  });

  const selected = p ? plateaus.find((x) => x.id === p) ?? null : plateaus[0] ?? null;
  const baselineId = vs ?? "";
  const before = baselineId && states.has(baselineId) ? states.get(baselineId)! : asIs;
  const after = selected ? states.get(selected.id)! : null;
  const diff = after ? diffStates(before, after) : null;

  const healthNow = healthReport(entities, relations).score;

  return (
    <Plateaus
      workspaceId={workspace.id}
      slug={slug}
      plateaus={views}
      selectedId={selected?.id ?? null}
      baselineId={baselineId}
      asIs={{ entities: entities.length, relations: relations.length, health: healthNow }}
      changeSets={sets.map((set) => ({ id: set.id, name: set.name, status: set.status, targetDate: set.targetDate }))}
      diff={
        diff && {
          summary: diff.summary,
          added: diff.added.slice(0, 20).map((e) => ({ id: e.id, name: e.name, kind: e.kind })),
          addedMore: Math.max(0, diff.added.length - 20),
          removed: diff.removed.slice(0, 20).map((e) => ({ id: e.id, name: e.name, kind: e.kind })),
          removedMore: Math.max(0, diff.removed.length - 20),
          renamed: diff.renamed.slice(0, 12).map((r) => ({ id: r.after.id, before: r.before.name, after: r.after.name })),
          attributes: diff.attributes.slice(0, 20).map((a) => ({ id: `${a.entity.id}:${a.key}`, name: a.entity.name, key: a.key, before: a.before, after: a.after })),
          attributesMore: Math.max(0, diff.attributes.length - 20),
          relationsAdded: diff.relationsAdded.length,
          relationsRemoved: diff.relationsRemoved.length,
        }
      }
    />
  );
}
