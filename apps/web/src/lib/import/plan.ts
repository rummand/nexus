import { KEY_ATTRIBUTE, type MatchTarget } from "./match";
import { planParents } from "./parents";
import type { Reviewed } from "./review";

/**
 * What an approved import would do, as data (§5.89).
 *
 * Until #137 this lived inside `applyBatch` as a loop that read the staged rows and wrote to the
 * graph in the same breath. That was fine while there was one destination. There are two now —
 * the estate everybody reads, or a branch of its own — and the only way the two can be trusted
 * to agree is for them to be the same decision written down twice rather than two loops.
 *
 * So this is pure, and it is the whole judgement of an import: which rows are new, which fields
 * on a matched object actually differ, which relations are already wired, and where each object
 * ends up in the hierarchy. Writing it to the graph and writing it to a change set are both
 * mechanical afterwards, and both are testable against the same list.
 *
 * The ops are the change model's own (§5.87), for the obvious reason: an import that lands on a
 * branch has to be readable as a change set, and one that writes through has to leave the same
 * rollback record it always did.
 */

export type ImportOp = "addEntity" | "setAttribute" | "retypeEntity" | "setParent" | "addRelation";

export interface ImportIntent {
  op: ImportOp;
  /** The object this is about. Empty only for `addRelation`, which is about two of them. */
  entityId: string;
  /** Minted here for `addRelation`, so both destinations use the same id. Empty otherwise. */
  relationId: string;
  /** The operands, in the change model's shape. */
  payload: Record<string, unknown>;
  /** What was there before: the rollback record's whole reason for existing. Empty for a new object. */
  from: string;
  /** True when the object this is about is introduced by this same import. */
  fresh: boolean;
  /** For the history and for a change's note: the name a person would recognise. */
  name: string;
}

export interface PlannedImport {
  intents: ImportIntent[];
  /** Staged record id → the entity id it becomes, so a caller can follow a row to its object. */
  idOf: Map<string, string>;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function planImport(input: {
  /** The accepted rows, in the order they were staged. */
  taking: Reviewed[];
  /** What the workspace already holds. */
  targets: MatchTarget[];
  /** The relations already wired, so an import run twice writes nothing the second time. */
  wired: Array<{ fromEntityId: string; toEntityId: string; kind: string }>;
  /** The hierarchy as it stands, for the cycle check. */
  hierarchy: Array<{ id: string; parentId: string | null }>;
  /** Relations somebody drew between two staged cards on the board (§5.36). */
  drawn?: Array<{ from: string; to: string; kind: string }>;
  mintEntityId: () => string;
  mintRelationId: () => string;
}): PlannedImport {
  const { taking, targets, hierarchy, mintEntityId, mintRelationId } = input;
  const intents: ImportIntent[] = [];
  const idOf = new Map<string, string>();
  const byTargetId = new Map(targets.map((t) => [t.id, t]));
  const fresh = new Set<string>();

  for (const row of taking) {
    const attributes: Record<string, string> = {};
    for (const [key, field] of Object.entries(row.record.attributes)) attributes[key] = field.chosen.value;
    if (row.record.key) attributes[KEY_ATTRIBUTE] = row.record.key;

    if (row.match.entityId) {
      const before = byTargetId.get(row.match.entityId);
      if (!before) continue;
      idOf.set(row.record.id, before.id);
      for (const [key, value] of Object.entries(attributes)) {
        const was = before.attributes[key] ?? "";
        if (norm(was) === norm(value)) continue;
        intents.push({ op: "setAttribute", entityId: before.id, relationId: "", payload: { key, value }, from: was, fresh: false, name: before.name });
      }
      const kind = row.record.kind || before.kind;
      if (norm(kind) !== norm(before.kind)) {
        intents.push({ op: "retypeEntity", entityId: before.id, relationId: "", payload: { kind }, from: before.kind, fresh: false, name: before.name });
      }
      continue;
    }

    const id = mintEntityId();
    idOf.set(row.record.id, id);
    fresh.add(id);
    intents.push({
      op: "addEntity",
      entityId: id,
      relationId: "",
      payload: { kind: row.record.kind || "", name: row.record.name, description: row.record.description, attributes },
      from: "",
      fresh: true,
      name: row.record.name,
    });
  }

  /*
   * Relations. Both ends have to exist first, whichever order the rows arrived in, so this is a
   * second pass — and the names are resolved against the whole workspace, not only this batch,
   * because an export that points at systems named in a different file is the normal case.
   */
  const byName = new Map<string, string>();
  for (const target of targets) byName.set(norm(target.name), target.id);
  for (const row of taking) {
    const id = idOf.get(row.record.id);
    if (id) byName.set(norm(row.record.name), id);
  }
  const nameOf = (entityId: string) => byTargetId.get(entityId)?.name ?? taking.find((r) => idOf.get(r.record.id) === entityId)?.record.name ?? "";
  const already = new Set(input.wired.map((r) => `${r.fromEntityId}|${norm(r.kind)}|${r.toEntityId}`));

  const connect = (from: string, to: string, kind: string) => {
    const signature = `${from}|${norm(kind)}|${to}`;
    if (already.has(signature)) return;
    already.add(signature);
    intents.push({
      op: "addRelation",
      entityId: "",
      relationId: mintRelationId(),
      payload: { fromEntityId: from, toEntityId: to, kind },
      from: "",
      fresh: fresh.has(from) || fresh.has(to),
      name: `${nameOf(from)} → ${nameOf(to)}`,
    });
  };
  for (const drawnRelation of input.drawn ?? []) {
    const from = idOf.get(drawnRelation.from);
    const to = idOf.get(drawnRelation.to);
    if (!from || !to || from === to) continue;
    connect(from, to, drawnRelation.kind.trim() || "relates to");
  }
  for (const row of taking) {
    const from = idOf.get(row.record.id);
    if (!from) continue;
    for (const relation of row.record.relations) {
      const to = byName.get(norm(relation.target));
      if (!to || to === from) continue;
      connect(from, to, relation.kind);
    }
  }

  /*
   * Containment last of all (§5.74): a parent is a name until every row has an id, and a move
   * that would close a ring is dropped rather than made. The tree it is checked against includes
   * the objects this import introduces, because two rows that each name the other is exactly how
   * a cycle arrives.
   */
  const wanted = taking
    .map((row) => ({ id: idOf.get(row.record.id) ?? "", parent: (row.record.parent ?? "").trim() }))
    .filter((row) => row.id && row.parent);
  if (wanted.length) {
    const tree = [...hierarchy, ...[...fresh].map((id) => ({ id, parentId: null as string | null }))];
    for (const move of planParents(wanted, (name) => byName.get(norm(name)), tree)) {
      intents.push({
        op: "setParent",
        entityId: move.id,
        relationId: "",
        payload: { parentId: move.parentId },
        from: move.from,
        fresh: fresh.has(move.id),
        name: nameOf(move.id),
      });
    }
  }

  return { intents, idOf };
}

/** What the plan amounts to, in the words the import's own screens already use. */
export function planTotals(intents: ImportIntent[]) {
  return {
    created: intents.filter((i) => i.op === "addEntity").length,
    updated: new Set(intents.filter((i) => i.op === "setAttribute" || i.op === "retypeEntity").map((i) => i.entityId)).size,
    connected: intents.filter((i) => i.op === "addRelation").length,
    nested: intents.filter((i) => i.op === "setParent").length,
  };
}
