import { changesAgainst, matchRecord, type Change, type Match, type MatchTarget } from "./match";
import { conflicts, type Decision, type StagedRecord } from "./stage";

/**
 * The review: what is wrong with this batch, and what would happen if you took it.
 *
 * Every issue here is one somebody has been bitten by. The severities matter more than the list:
 *
 * - **blocker** — it cannot be written, so the row is held. No name, nothing to match.
 * - **question** — it can be written but somebody has to decide. A near-name match, two sources
 *   disagreeing, a system that has vanished from the export.
 * - **note** — worth knowing, no decision needed. Nothing changed; a new kind is appearing.
 *
 * A row's default decision comes from its worst issue, and a person can override any of it. The
 * defaults are deliberately cautious: a batch that imports itself is a batch nobody reviewed.
 */

export type Severity = "blocker" | "question" | "note";

export interface Issue {
  severity: Severity;
  code: string;
  /** One sentence, naming the thing. */
  message: string;
}

export interface Reviewed {
  record: StagedRecord;
  match: Match;
  /** What would change on the matched object; empty for something new. */
  changes: Change[];
  issues: Issue[];
  decision: Decision;
  /** Set when a person has overridden the default. */
  decidedBy: "default" | "person";
}

export interface ReviewOptions {
  /** Kinds the workspace already uses, for noticing a new one. */
  kinds: string[];
  /**
   * Objects the source claimed last time and does not claim now. Only meaningful when the batch is
   * a full export of something rather than a slice of it — so it is opt-in, not assumed.
   */
  previouslyFrom?: MatchTarget[];
}

export interface Review {
  rows: Reviewed[];
  /** Objects that were in the last import from this source and are not in this one. */
  missing: Array<{ target: MatchTarget; issue: Issue }>;
  counts: { total: number; create: number; update: number; unchanged: number; held: number; rejected: number };
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function review(records: StagedRecord[], targets: MatchTarget[], options: ReviewOptions): Review {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const named = new Set(records.map((r) => norm(r.name)).filter(Boolean));
  const knownKinds = new Set(options.kinds.map(norm));
  const matchedIds = new Set<string>();

  const rows: Reviewed[] = records.map((record) => {
    const match = matchRecord(record, targets);
    if (match.entityId) matchedIds.add(match.entityId);
    const target = match.entityId ? byId.get(match.entityId) ?? null : null;
    const changes = changesAgainst(record, target);
    const issues: Issue[] = [];

    if (!record.name.trim()) {
      issues.push({ severity: "blocker", code: "no-name", message: "This row has no name, so there is nothing to call the object." });
    }
    /*
     * One file claiming the same object twice.
     *
     * Two files doing it is the point of a batch; one file doing it is either a broken export — if
     * the source's own key repeats, which should be impossible — or two rows nothing tells apart.
     */
    for (const [source, times] of rowsPerSource(record)) {
      if (times < 2) continue;
      issues.push(record.key
        ? { severity: "blocker", code: "duplicate-key", message: `“${source}” uses the key “${record.key}” on ${times} rows. A source's own identifier cannot mean two things.` }
        : { severity: "question", code: "duplicate-name", message: `“${source}” has ${times} rows called “${record.name}”, and nothing tells them apart.` });
    }

    if (match.how === "near name" && match.alternatives.length) {
      issues.push({
        severity: "question",
        code: "near-match",
        message: `Close to ${match.alternatives.map((a) => `“${a.name}”`).join(", ")} — the same thing, or a different one?`,
      });
    }
    if (match.how === "none" && match.alternatives.length > 1) {
      issues.push({
        severity: "question",
        code: "ambiguous-match",
        message: `The graph has ${match.alternatives.length} objects called “${record.name}”, and nothing here says which.`,
      });
    }
    if (match.how === "name" && record.kind && norm(match.kind) !== norm(record.kind)) {
      issues.push({
        severity: "question",
        code: "kind-differs",
        message: `Matched “${match.name}” by name, but the graph calls it a ${match.kind || "no kind"} and this file calls it a ${record.kind}.`,
      });
    }

    for (const conflict of conflicts(record)) {
      issues.push({
        severity: "question",
        code: "conflict",
        message: `${conflict.key}: ${conflict.chosen.source} says “${conflict.chosen.value}”, ${conflict.others.map((o) => `${o.source} says “${o.value}”`).join(", ")}.`,
      });
    }

    const people = Object.keys(record.personal);
    if (people.length) {
      issues.push({
        severity: "question",
        code: "personal",
        message: `${people.join(", ")} name${people.length === 1 ? "s" : ""} people. Nothing about a person is written unless you say so.`,
      });
    }

    for (const relation of record.relations) {
      const target = norm(relation.target);
      if (!named.has(target) && !targets.some((t) => norm(t.name) === target)) {
        issues.push({
          severity: "question",
          code: "dangling",
          message: `“${relation.target}” (${relation.kind}) is not in this batch or in the graph, so that connection would go nowhere.`,
        });
      }
    }

    if (record.kind && !knownKinds.has(norm(record.kind))) {
      issues.push({ severity: "note", code: "new-kind", message: `“${record.kind}” would be a new kind in this workspace.` });
    }
    if (match.entityId && changes.length === 0) {
      issues.push({ severity: "note", code: "unchanged", message: "Already in the graph, and nothing here changes it." });
    }

    const worst = issues.some((i) => i.severity === "blocker") ? "blocker" : issues.some((i) => i.severity === "question") ? "question" : "note";
    return { record, match, changes, issues, decision: worst === "blocker" ? "hold" : "accept", decidedBy: "default" };
  });

  /**
   * What the source used to claim and does not any more.
   *
   * Never a deletion, and never silent. A system missing from this month's export has either been
   * decommissioned, moved out of scope, or the export was filtered — and only a person knows which.
   */
  const missing = (options.previouslyFrom ?? [])
    .filter((t) => !matchedIds.has(t.id))
    .map((target) => ({
      target,
      issue: {
        severity: "question" as const,
        code: "missing",
        message: `“${target.name}” was in the last import from this source and is not in this one. Retired, out of scope, or a filtered export?`,
      },
    }));

  return { rows, missing, counts: count(rows) };
}

function rowsPerSource(record: StagedRecord): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of record.rows) counts.set(row.source, (counts.get(row.source) ?? 0) + 1);
  return [...counts.entries()];
}

function count(rows: Reviewed[]): Review["counts"] {
  let create = 0, update = 0, unchanged = 0, held = 0, rejected = 0;
  for (const row of rows) {
    if (row.decision === "hold") held++;
    else if (row.decision === "reject") rejected++;
    else if (!row.match.entityId) create++;
    else if (row.changes.length) update++;
    else unchanged++;
  }
  return { total: rows.length, create, update, unchanged, held, rejected };
}

/** Re-count after a person has changed some decisions. */
export function recount(rows: Reviewed[]): Review["counts"] {
  return count(rows);
}

/** The rows that would actually be written. */
export function accepted(rows: Reviewed[]): Reviewed[] {
  return rows.filter((r) => r.decision === "accept" && r.record.name.trim());
}
