import { conformance, type Conformance, type EntityLike, type RelationLike } from "@/lib/metamodel-conformance";
import type { MetaModel } from "@/lib/metamodel";

/**
 * The model's test suite (#136, §5.83).
 *
 * The campaign's definition of done and a merge's admission criteria are the same list, and that
 * list is a *test suite* over the model. Nexus already computed most of it — conformance (§5.66),
 * relation rules (§5.67), the orphan count on the health page, the cycle guard in the reparent
 * path — but each answer lived in its own screen, in its own shape, with no verdict. A number on
 * a dashboard is something to look at. A check that passes or fails, with the rows that failed it,
 * is something to gate on.
 *
 * Three decisions hold the design up:
 *
 * - **A check is pure over a snapshot.** No database, so it runs against `main`, against a change
 *   set's projection, or against a campaign's scope with the same code and no second
 *   implementation of what "conformant" means.
 * - **Blocking and advisory are different things.** Some checks are opinions — nobody should be
 *   stopped from merging because two applications share a name. A gate that cannot tell the
 *   difference is a gate that gets switched off.
 * - **The useful verdict is "not worse", not "clean".** A repository with 52 undeclared types
 *   cannot pass a clean-slate check, and a gate everybody fails is a gate everybody ignores. So
 *   the suite is comparable: `newFindings` is what a proposal *adds*, which is the question a
 *   review actually asks.
 */

export type Severity = "blocking" | "advisory";

export interface Finding {
  /** The check that raised it. */
  checkId: CheckId;
  /** What it is about — an entity or relation id, so the finding is addressable. */
  subjectId: string;
  subjectName: string;
  /** One sentence somebody can act on. */
  detail: string;
}

export type CheckId =
  | "types-declared"
  | "required-fields"
  | "field-values"
  | "relations-allowed"
  | "no-cycles"
  | "no-orphans"
  | "unique-names";

export interface CheckResult {
  id: CheckId;
  title: string;
  /** What good looks like, so a failure is not a mystery. */
  goal: string;
  severity: Severity;
  passed: boolean;
  findings: Finding[];
}

export interface CheckRun {
  checks: CheckResult[];
  findings: Finding[];
  /** Failing checks, by severity. */
  blocking: number;
  advisory: number;
  /** Nothing blocking failed. Advisory failures are reported and do not stop anything. */
  passed: boolean;
  /** How many objects and relations the run looked at. */
  checked: number;
}

/**
 * A relation, with its ends.
 *
 * Conformance only needs the *kinds* at each end, so `RelationLike` carries names rather than
 * ids. The orphan check needs to know which objects an edge actually touches, so the suite takes
 * the fuller row and narrows it when it calls conformance.
 */
export interface RelationRow extends RelationLike {
  fromEntityId: string;
  toEntityId: string;
}

export interface CheckInput {
  model: MetaModel;
  entities: EntityLike[];
  relations: RelationRow[];
  /** Containment, which is a column rather than a relation (§5.70). */
  parents?: Map<string, string | null>;
}

const DEFINITIONS: Array<{ id: CheckId; title: string; goal: string; severity: Severity }> = [
  { id: "types-declared", title: "Every object has a declared type", goal: "The meta-model describes what the repository holds.", severity: "advisory" },
  { id: "required-fields", title: "Required fields are filled", goal: "A field the type says is required has a value.", severity: "blocking" },
  { id: "field-values", title: "Values match their declared type", goal: "A date is a date; an enum is one of its allowed values.", severity: "blocking" },
  { id: "relations-allowed", title: "Relations are allowed by the model", goal: "A relation exists between types the meta-model permits it between.", severity: "blocking" },
  { id: "no-cycles", title: "Containment is a tree", goal: "Nothing sits inside itself, at any depth.", severity: "blocking" },
  { id: "no-orphans", title: "Nothing is connected to nothing", goal: "Every object has at least one relation or a place in the hierarchy.", severity: "advisory" },
  { id: "unique-names", title: "Names are unique within a type", goal: "Two applications called the same thing are usually one application.", severity: "advisory" },
];

/** Which check each conformance breach belongs to. */
const FROM_BREACH: Record<string, CheckId> = {
  "kind-undeclared": "types-declared",
  "field-missing": "required-fields",
  "field-type": "field-values",
  "field-option": "field-values",
  "relation-undeclared": "relations-allowed",
  "relation-rule": "relations-allowed",
};

/** Containment cycles, found by walking up from each object until it repeats or runs out. */
function cycles(parents: Map<string, string | null>, names: Map<string, string>): Finding[] {
  const found: Finding[] = [];
  const reported = new Set<string>();
  for (const id of parents.keys()) {
    const seen = new Set<string>([id]);
    let at = parents.get(id) ?? null;
    while (at) {
      if (seen.has(at)) {
        /*
         * Every member of a ring sees the ring, so it would be reported once per member. One
         * finding per cycle, keyed by its smallest id, keeps a two-object loop from reading as
         * two separate problems.
         */
        const key = [...seen].sort()[0]!;
        if (!reported.has(key)) {
          reported.add(key);
          found.push({
            checkId: "no-cycles",
            subjectId: id,
            subjectName: names.get(id) ?? id,
            detail: `“${names.get(id) ?? id}” sits inside itself, through ${seen.size} step${seen.size === 1 ? "" : "s"}.`,
          });
        }
        break;
      }
      seen.add(at);
      at = parents.get(at) ?? null;
    }
  }
  return found;
}

const norm = (v: string) => v.trim().toLowerCase();

export function runChecks({ model, entities, relations, parents = new Map() }: CheckInput): CheckRun {
  const conf: Conformance = conformance(model, entities, relations);
  const names = new Map(entities.map((e) => [e.id, e.name]));

  const byCheck = new Map<CheckId, Finding[]>();
  const add = (f: Finding) => byCheck.set(f.checkId, [...(byCheck.get(f.checkId) ?? []), f]);

  for (const breach of conf.breaches) {
    const checkId = FROM_BREACH[breach.kind];
    if (!checkId) continue;
    add({ checkId, subjectId: breach.subjectId, subjectName: breach.subjectName, detail: breach.detail });
  }

  for (const f of cycles(parents, names)) add(f);

  /*
   * An orphan is an object with no relation *and* no place in the hierarchy. Counting containment
   * matters: a capability with eleven applications inside it and no edges is not adrift, and
   * calling it an orphan would make the check something people learn to ignore.
   */
  const touched = new Set<string>();
  for (const r of relations) { touched.add(r.fromEntityId); touched.add(r.toEntityId); }
  const hasChildren = new Set<string>();
  for (const [, parentId] of parents) if (parentId) hasChildren.add(parentId);
  for (const e of entities) {
    const placed = Boolean(parents.get(e.id)) || hasChildren.has(e.id);
    if (!touched.has(e.id) && !placed) {
      add({ checkId: "no-orphans", subjectId: e.id, subjectName: e.name, detail: `“${e.name}” has no relations and sits nowhere.` });
    }
  }

  const seenNames = new Map<string, string[]>();
  for (const e of entities) {
    if (!e.name.trim()) continue;
    const key = `${norm(e.kind)}::${norm(e.name)}`;
    seenNames.set(key, [...(seenNames.get(key) ?? []), e.id]);
  }
  for (const [key, ids] of seenNames) {
    if (ids.length < 2) continue;
    // Reported on every member: each one is a candidate for the merge, and a review that only
    // showed the first would hide half the decision.
    for (const id of ids) {
      add({ checkId: "unique-names", subjectId: id, subjectName: names.get(id) ?? id, detail: `${ids.length} objects of this type are called “${names.get(id) ?? key}”.` });
    }
  }

  const checks: CheckResult[] = DEFINITIONS.map((d) => {
    const findings = byCheck.get(d.id) ?? [];
    return { ...d, passed: findings.length === 0, findings };
  });

  const failing = checks.filter((c) => !c.passed);
  return {
    checks,
    findings: checks.flatMap((c) => c.findings),
    blocking: failing.filter((c) => c.severity === "blocking").length,
    advisory: failing.filter((c) => c.severity === "advisory").length,
    passed: failing.every((c) => c.severity !== "blocking"),
    checked: entities.length + relations.length,
  };
}

const keyOf = (f: Finding) => `${f.checkId}::${f.subjectId}::${f.detail}`;

/**
 * What a proposal *adds* — the verdict a review actually asks for.
 *
 * A clean-slate pass is the wrong gate on a real estate: 52 undeclared types means nothing is
 * ever green, and a gate everybody fails is a gate everybody turns off. "Does this change make
 * the model worse" is answerable, fair, and the thing a merge should refuse on.
 */
export function newFindings(base: CheckRun, head: CheckRun): Finding[] {
  const before = new Set(base.findings.map(keyOf));
  return head.findings.filter((f) => !before.has(keyOf(f)));
}

/** And what it repairs, which is worth as much in a review and nobody would otherwise see. */
export function fixedFindings(base: CheckRun, head: CheckRun): Finding[] {
  const after = new Set(head.findings.map(keyOf));
  return base.findings.filter((f) => !after.has(keyOf(f)));
}

export function severityOf(id: CheckId): Severity {
  return DEFINITIONS.find((d) => d.id === id)?.severity ?? "advisory";
}

/** The one-line verdict: what a merge would say. */
export function verdict(added: Finding[]): { ok: boolean; blocking: number; advisory: number; words: string } {
  const blocking = added.filter((f) => severityOf(f.checkId) === "blocking").length;
  const advisory = added.length - blocking;
  if (!added.length) return { ok: true, blocking: 0, advisory: 0, words: "Nothing new breaks." };
  if (!blocking) return { ok: true, blocking: 0, advisory, words: `${advisory} new advisory finding${advisory === 1 ? "" : "s"}, nothing blocking.` };
  return { ok: false, blocking, advisory, words: `${blocking} new blocking finding${blocking === 1 ? "" : "s"}.` };
}
