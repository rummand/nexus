import type * as s from "@/db/schema";

/**
 * What breaks if this goes away.
 *
 * The question a retirement decision actually turns on, and the one an inventory in a spreadsheet
 * cannot answer at all. It is computed over the graph rather than asserted, so the answer changes
 * as the model does — which is the argument for keeping the model in the first place.
 */

/**
 * Relation kinds that read as "the source needs the target".
 *
 * Direction only means something where the vocabulary says so. Where it does not, the honest
 * answer is "these two are connected", and this list is what separates the two cases instead of
 * quietly assuming every arrow is a dependency.
 */
const DEPENDENCY_KINDS = [
  "depends on", "depends", "uses", "consumes", "reads from", "reads", "calls", "requires",
  "integrates with", "feeds from", "sources from", "subscribes to", "queries",
];

/** Relation kinds where the *target* is the one that would lose something. */
const SUPPLY_KINDS = ["supports", "provides", "feeds", "supplies", "serves", "publishes to", "sends to", "writes to", "billing", "master data", "meter data", "telemetry", "work orders"];

const norm = (v: string) => v.trim().toLowerCase();

/**
 * How a survivor is attached to what is going.
 *
 * Three of these are distinct problems, and collapsing them loses the point: something that
 * *depends on* the retiring system stops working; something *served by* it loses an input;
 * something that *supplies* it has a feed with nowhere to go, which is the one people forget to
 * decommission. "connected" is the honest answer where the relation kind says nothing.
 */
export type Nature = "depends-on" | "served-by" | "supplies" | "connected";

export interface Dependant {
  entity: s.Entity;
  nature: Nature;
  via: Array<{ relationId: string; kind: string }>;
  /** True when every relation this entity has is to something being retired. */
  orphaned: boolean;
}

export interface Impact {
  /** The entities being removed, resolved. */
  targets: s.Entity[];
  /** Everything one hop away that is not itself being retired, worst first. */
  dependants: Dependant[];
  /** Reachable in two hops but not one — the second-order surprise. */
  indirect: s.Entity[];
  /** Relations that would no longer have both ends. */
  severed: s.Relation[];
  /** Dependants left with nothing attached at all afterwards. */
  orphaned: s.Entity[];
  /** One sentence, in the words a person would use. */
  summary: string;
}

export function impactOf(entities: s.Entity[], relations: s.Relation[], targetIds: string[]): Impact {
  const gone = new Set(targetIds);
  const byId = new Map(entities.map((e) => [e.id, e]));
  const targets = targetIds.map((id) => byId.get(id)).filter((e): e is s.Entity => Boolean(e));

  const severed: s.Relation[] = [];
  const touching = new Map<string, Dependant>();
  /** How many relations each entity has in total, so "orphaned" can mean what it says. */
  const degree = new Map<string, number>();
  for (const r of relations) {
    degree.set(r.fromEntityId, (degree.get(r.fromEntityId) ?? 0) + 1);
    degree.set(r.toEntityId, (degree.get(r.toEntityId) ?? 0) + 1);
  }

  for (const r of relations) {
    const fromGone = gone.has(r.fromEntityId);
    const toGone = gone.has(r.toEntityId);
    if (!fromGone && !toGone) continue;
    severed.push(r);
    // The end that survives is the one that feels it.
    const survivorId = fromGone ? r.toEntityId : r.fromEntityId;
    if (gone.has(survivorId)) continue; // both ends going: nobody is left to care
    const survivor = byId.get(survivorId);
    if (!survivor) continue;

    const kind = norm(r.kind);
    const nature = natureOf(kind, fromGone);

    const existing = touching.get(survivorId);
    if (existing) {
      existing.via.push({ relationId: r.id, kind: r.kind });
      // A real dependency outranks an unlabelled connection when one entity has both.
      if (existing.nature === "connected" && nature !== "connected") existing.nature = nature;
    } else {
      touching.set(survivorId, { entity: survivor, nature, via: [{ relationId: r.id, kind: r.kind }], orphaned: false });
    }
  }

  for (const d of touching.values()) {
    const total = degree.get(d.entity.id) ?? 0;
    d.orphaned = total > 0 && total === d.via.length;
  }

  // Two hops: neighbours of the dependants that are not dependants themselves.
  const firstRing = new Set(touching.keys());
  const indirect = new Map<string, s.Entity>();
  for (const r of relations) {
    for (const [a, b] of [[r.fromEntityId, r.toEntityId], [r.toEntityId, r.fromEntityId]] as const) {
      if (!firstRing.has(a) || firstRing.has(b) || gone.has(b)) continue;
      const entity = byId.get(b);
      if (entity) indirect.set(b, entity);
    }
  }

  const rank: Record<Nature, number> = { "depends-on": 0, "served-by": 1, supplies: 2, connected: 3 };
  const dependants = [...touching.values()].sort(
    (a, b) => Number(b.orphaned) - Number(a.orphaned) || rank[a.nature] - rank[b.nature] || b.via.length - a.via.length || a.entity.name.localeCompare(b.entity.name),
  );
  const orphaned = dependants.filter((d) => d.orphaned).map((d) => d.entity);

  return { targets, dependants, indirect: [...indirect.values()], severed, orphaned, summary: describe(targets, dependants, orphaned, indirect.size) };
}

/**
 * Read the relation from the survivor's point of view.
 *
 * `fromGone` says which end is disappearing, which is what turns the same verb into two different
 * consequences: Historian → Data Lake "hourly batch" means the lake loses an input if the
 * Historian goes, and means the Historian's output has nowhere to land if the lake goes.
 */
function natureOf(kind: string, fromGone: boolean): Nature {
  if (fromGone) {
    // The thing going points at the survivor.
    if (SUPPLY_KINDS.includes(kind)) return "served-by";
    if (DEPENDENCY_KINDS.includes(kind)) return "supplies";
    return "connected";
  }
  // The survivor points at the thing going.
  if (DEPENDENCY_KINDS.includes(kind)) return "depends-on";
  if (SUPPLY_KINDS.includes(kind)) return "supplies";
  return "connected";
}

function describe(targets: s.Entity[], dependants: Dependant[], orphaned: s.Entity[], indirect: number): string {
  if (!targets.length) return "Nothing is being removed.";
  const what = targets.length === 1 ? `Retiring ${targets[0]!.name}` : `Retiring ${targets.length} systems`;
  if (!dependants.length) return `${what} touches nothing else in the model — which may mean it is genuinely standalone, or that its connections were never mapped.`;
  const needs = dependants.filter((d) => d.nature === "depends-on").length;
  const parts = [`${dependants.length} ${dependants.length === 1 ? "system is" : "systems are"} attached`];
  if (needs) parts.push(`${needs} of them ${needs === 1 ? "depends" : "depend"} on it`);
  if (orphaned.length) parts.push(`${orphaned.length} would be left connected to nothing`);
  if (indirect) parts.push(`${indirect} more sit one hop further out`);
  return `${what}: ${parts.join(", ")}.`;
}
