import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";

/**
 * Two observed states of the estate, compared (#112, §5.98).
 *
 * A different axis from the change-set diff (§5.21). That one compares the estate with a *plan* —
 * what somebody intends. This compares the estate with **itself at another moment** — what
 * actually happened, whether anybody meant it to or not. Both are needed and they answer
 * different questions: "what will this do" against "what have we done".
 *
 * Pure over two sets of rows, so it works equally on two rewound dates (§5.97), a date against
 * today, or anything else that can produce entities.
 */

export interface FieldChange {
  key: string;
  from: string;
  to: string;
}

export interface Changed {
  id: string;
  name: string;
  kind: string;
  /** Set when the object was renamed between the two moments. */
  renamedFrom?: string;
  /** Set when it was retyped. */
  retypedFrom?: string;
  fields: FieldChange[];
}

export interface EstateDiff {
  added: Array<{ id: string; name: string; kind: string }>;
  removed: Array<{ id: string; name: string; kind: string }>;
  changed: Changed[];
  /** Objects present and identical in both. Counted rather than listed. */
  untouched: number;
}

const name = (e: s.Entity) => e.name ?? "";

/** What happened to the estate between `before` and `after`. */
export function diffEstates(before: s.Entity[], after: s.Entity[]): EstateDiff {
  const was = new Map(before.map((e) => [e.id, e]));
  const now = new Map(after.map((e) => [e.id, e]));
  const diff: EstateDiff = { added: [], removed: [], changed: [], untouched: 0 };

  for (const [id, entity] of now) {
    const old = was.get(id);
    if (!old) {
      diff.added.push({ id, name: name(entity), kind: entity.kind });
      continue;
    }

    const fields: FieldChange[] = [];
    const oldAttributes = parseAttributes(old.attributes);
    const newAttributes = parseAttributes(entity.attributes);
    // Every key either side knows about, so a field that was removed shows as plainly as one
    // that was added: a value that quietly disappeared is the harder thing to notice.
    for (const key of new Set([...Object.keys(oldAttributes), ...Object.keys(newAttributes)])) {
      const from = oldAttributes[key] ?? "";
      const to = newAttributes[key] ?? "";
      if (from !== to) fields.push({ key, from, to });
    }
    fields.sort((a, b) => a.key.localeCompare(b.key));

    const renamed = name(old) !== name(entity);
    const retyped = old.kind !== entity.kind;
    if (!renamed && !retyped && !fields.length) { diff.untouched++; continue; }

    diff.changed.push({
      id,
      name: name(entity),
      kind: entity.kind,
      ...(renamed ? { renamedFrom: name(old) } : {}),
      ...(retyped ? { retypedFrom: old.kind } : {}),
      fields,
    });
  }

  for (const [id, entity] of was) {
    if (!now.has(id)) diff.removed.push({ id, name: name(entity), kind: entity.kind });
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  diff.added.sort(byName);
  diff.removed.sort(byName);
  diff.changed.sort(byName);
  return diff;
}

/** The shape of what happened, in one sentence. */
export function diffWords(diff: EstateDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} arrived`);
  if (diff.removed.length) parts.push(`${diff.removed.length} went`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  if (!parts.length) return "Nothing changed between these two moments.";
  return `${parts.join(", ")}. ${diff.untouched} untouched.`;
}

/** What happened to one object, for its row. */
export function changedWords(changed: Changed): string {
  const parts: string[] = [];
  if (changed.renamedFrom) parts.push(`renamed from “${changed.renamedFrom}”`);
  if (changed.retypedFrom) parts.push(`was a ${changed.retypedFrom || "nothing"}`);
  for (const field of changed.fields.slice(0, 3)) {
    parts.push(field.to ? `${field.key} “${field.from || "nothing"}” → “${field.to}”` : `${field.key} cleared`);
  }
  if (changed.fields.length > 3) parts.push(`and ${changed.fields.length - 3} more fields`);
  return parts.join(", ");
}
