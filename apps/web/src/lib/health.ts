import type * as s from "@/db/schema";

/**
 * Estate health — one number, and the work behind it.
 *
 * Nexus already reports that fifty systems have no source and shows "Asset Register" twice in its
 * own evidence. Reporting a problem repeatedly without offering to fix it is worse than not
 * noticing: it teaches people to read past the warning. This turns those observations into
 * measures that move when the work is done, each carrying the entities behind it so the fix is one
 * click from the number.
 *
 * Pure over rows, so the arithmetic is tested rather than eyeballed, and so the same report can be
 * computed for a workspace, a space or a lens later. It deliberately imports nothing but types:
 * the panel that renders it is a client component, and pulling in `./graph` would drag the whole
 * database client into the browser bundle — which it silently did, until the panel stopped
 * responding to clicks.
 */

/** Local, so this module stays free of server imports. Mirrors graph.ts's parser. */
function parseAttributes(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

export type MeasureId = "provenance" | "duplicates" | "untyped" | "orphans" | "ownership" | "lifecycle";

export interface Measure {
  id: MeasureId;
  name: string;
  /** What good looks like, in one line. */
  goal: string;
  /** 0–100. 100 is healthy. */
  score: number;
  /** How many objects are in the way. */
  offenders: number;
  /** Out of how many it was measured. */
  population: number;
  /** A sentence that is true about this workspace right now. */
  detail: string;
  /** The entities behind the number, capped — enough to act on, not enough to hang the page. */
  entityIds: string[];
  /** The action that would move it, in the words of the screen that offers it. */
  fix: string;
}

export interface HealthReport {
  /** The headline: the mean of the measures, weighted by how much of the estate each covers. */
  score: number;
  measures: Measure[];
  entities: number;
  relations: number;
}

/** Kinds that describe a running system — the ones an architect is accountable for. */
const SYSTEM_KINDS = new Set(["application", "system", "platform", "it component", "service", "database", "integration", "interface"]);
/** Kinds intake writes as records of what was said; they are evidence, not estate. */
const RECORD_KINDS = new Set(["meeting", "document", "dataset", "sync", "decision", "action", "risk", "question", "need", "person", "topic"]);

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const MAX_IDS = 200;

const pct = (good: number, total: number) => (total === 0 ? 100 : Math.round((good / total) * 100));

export function healthReport(entities: s.Entity[], relations: s.Relation[]): HealthReport {
  const estate = entities.filter((e) => SYSTEM_KINDS.has(norm(e.kind)));
  const modelled = entities.filter((e) => !RECORD_KINDS.has(norm(e.kind)));
  const attributesOf = new Map(entities.map((e) => [e.id, parseAttributes(e.attributes)]));

  // Something explains it: it came from a source, or a source node points at it.
  const pointedAt = new Set(relations.map((r) => r.toEntityId));
  const unsourced = estate.filter((e) => e.source === "canvas" && !pointedAt.has(e.id));

  // Same name, more than once — the duplicate the resolution proposals already know how to merge.
  const byName = new Map<string, s.Entity[]>();
  for (const e of modelled) byName.set(norm(e.name), [...(byName.get(norm(e.name)) ?? []), e]);
  const duplicates = [...byName.values()].filter((list) => list.length > 1);
  const duplicateEntities = duplicates.flat();

  const untyped = entities.filter((e) => !e.kind.trim());

  const connected = new Set<string>();
  for (const r of relations) { connected.add(r.fromEntityId); connected.add(r.toEntityId); }
  const orphans = modelled.filter((e) => !connected.has(e.id));

  const unowned = estate.filter((e) => {
    const attrs = attributesOf.get(e.id) ?? {};
    return !Object.entries(attrs).some(([k, v]) => norm(k) === "owner" && v.trim());
  });

  const undated = estate.filter((e) => {
    const attrs = attributesOf.get(e.id) ?? {};
    return !Object.entries(attrs).some(([k, v]) => norm(k) === "lifecycle" && v.trim());
  });

  const ids = (list: s.Entity[]) => list.slice(0, MAX_IDS).map((e) => e.id);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const measures: Measure[] = [
    {
      id: "provenance",
      name: "Provenance",
      goal: "Every system in the model can point at where it came from",
      score: pct(estate.length - unsourced.length, estate.length),
      offenders: unsourced.length,
      population: estate.length,
      detail: unsourced.length
        ? `${plural(unsourced.length, "system was", "systems were")} drawn by hand and no source explains ${unsourced.length === 1 ? "it" : "them"}.`
        : "Everything in the estate traces back to a source.",
      entityIds: ids(unsourced),
      fix: "Ingest the source that describes them, or link them to one from Intake.",
    },
    {
      id: "duplicates",
      name: "Duplicates",
      goal: "One thing, one node",
      score: pct(modelled.length - duplicateEntities.length, modelled.length),
      offenders: duplicateEntities.length,
      population: modelled.length,
      detail: duplicates.length
        ? `${plural(duplicates.length, "name is", "names are")} used by more than one node — ${duplicates.slice(0, 3).map((d) => `“${d[0]!.name}”`).join(", ")}.`
        : "No two nodes share a name.",
      entityIds: ids(duplicateEntities),
      fix: "Merge them from the proposals on this page.",
    },
    {
      id: "untyped",
      name: "Typing",
      goal: "Everything has a kind the meta-model knows",
      score: pct(entities.length - untyped.length, entities.length),
      offenders: untyped.length,
      population: entities.length,
      detail: untyped.length ? `${plural(untyped.length, "node has", "nodes have")} no kind at all.` : "Everything is typed.",
      entityIds: ids(untyped),
      fix: "Set a kind in bulk, or accept the kind the agent proposes.",
    },
    {
      id: "orphans",
      name: "Connectedness",
      goal: "Nothing sits alone in the graph",
      score: pct(modelled.length - orphans.length, modelled.length),
      offenders: orphans.length,
      population: modelled.length,
      detail: orphans.length
        ? `${plural(orphans.length, "node is", "nodes are")} connected to nothing, so no question can reach ${orphans.length === 1 ? "it" : "them"}.`
        : "Every node is reachable.",
      entityIds: ids(orphans),
      fix: "Connect them on a board, or let Intake read a source that mentions them.",
    },
    {
      id: "ownership",
      name: "Ownership",
      goal: "Every system has someone accountable",
      score: pct(estate.length - unowned.length, estate.length),
      offenders: unowned.length,
      population: estate.length,
      detail: unowned.length ? `${plural(unowned.length, "system has", "systems have")} no owner recorded.` : "Every system has an owner.",
      entityIds: ids(unowned),
      fix: "Set the owner in bulk from the entity table.",
    },
    {
      id: "lifecycle",
      name: "Lifecycle",
      goal: "Every system says where it is in its life",
      score: pct(estate.length - undated.length, estate.length),
      offenders: undated.length,
      population: estate.length,
      detail: undated.length ? `${plural(undated.length, "system has", "systems have")} no lifecycle recorded.` : "Every system has a lifecycle.",
      entityIds: ids(undated),
      fix: "Set the lifecycle in bulk from the entity table.",
    },
  ];

  // Weighted by population: a measure over three nodes should not swing the headline.
  const weight = measures.reduce((n, m) => n + Math.max(1, m.population), 0);
  const score = Math.round(measures.reduce((n, m) => n + m.score * Math.max(1, m.population), 0) / weight);

  return { score, measures, entities: entities.length, relations: relations.length };
}

/** A word for the number, so the headline reads as a judgement rather than a metric. */
export function healthLabel(score: number): string {
  if (score >= 90) return "healthy";
  if (score >= 75) return "workable";
  if (score >= 55) return "patchy";
  return "thin";
}
