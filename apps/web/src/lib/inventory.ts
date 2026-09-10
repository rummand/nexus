import type { MetaField } from "./metamodel";

/**
 * The inventory: browsing one type of thing the way an EA tool should (§5.72).
 *
 * Nexus could already filter entities by kind and search them, but "kind" was a chip on a page
 * of everything. LeanIX gets one thing very right here: **a type is a destination.** You go to
 * Applications, and what you get is an inventory of applications — faceted by the fields that
 * type actually has, with counts, so the shape of the portfolio is visible before you have
 * asked it anything.
 *
 * Three decisions in here are the difference between a facet rail that works and one that
 * quietly misleads:
 *
 * - **"Not set" is a value.** *Which applications have no owner* is the single most useful
 *   question an inventory answers, and a facet listing only the values that are present hides
 *   it. That is §2.2 again: an absence is a finding, not a blank.
 * - **A facet's own counts ignore its own selection.** Standard, and easy to get wrong: if
 *   selecting `lifecycle = active` recomputed the lifecycle counts against that selection, every
 *   other lifecycle would read zero and the filter would become a one-way door. Each facet
 *   counts against every *other* facet's selection, so switching values stays possible.
 * - **A declared field appears even at zero usage.** A field the model declares and nobody has
 *   filled is a finding worth seeing, and dropping it from the rail because it has no values is
 *   how a model quietly stops being checked against its data.
 *
 * Pure. Every judgement above is arguable and belongs somewhere it can be argued with.
 */

export interface InventoryItem {
  id: string;
  name: string;
  kind: string;
  description: string;
  attributes: Record<string, string>;
  relationCount: number;
  boardCount: number;
}

/** The marker for "this item has no value for that key". Empty string is a real absent value. */
export const NOT_SET = "";

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facet {
  key: string;
  /** From the meta-model when the field is declared; "" for one discovered in the data. */
  dataType: string;
  declared: boolean;
  required: boolean;
  /** Declared options, for an enum. Empty otherwise. */
  options: string[];
  /** Values present, commonest first. Never includes the not-set bucket. */
  values: FacetValue[];
  /** How many items carry no value for this key. */
  missing: number;
  /** How many items carry any value. */
  present: number;
}

/** key → the values selected on it. `NOT_SET` selects the items with no value. */
export type Selection = Record<string, string[]>;

const norm = (v: string) => v.trim().toLowerCase();
const valueOf = (item: InventoryItem, key: string) => (item.attributes[key] ?? "").trim();

/** Does one item survive one facet's selection? */
function passes(item: InventoryItem, key: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const v = valueOf(item, key);
  return selected.some((s) => (s === NOT_SET ? v === "" : norm(s) === norm(v)));
}

/** Items surviving every facet except the one named — the set a facet counts against. */
function survivors(items: InventoryItem[], selection: Selection, except?: string): InventoryItem[] {
  const keys = Object.keys(selection).filter((k) => k !== except);
  return items.filter((item) => keys.every((k) => passes(item, k, selection[k] ?? [])));
}

/**
 * The facet rail for one type.
 *
 * Declared fields lead, in the order the model declares them, because that order is somebody's
 * considered opinion about what matters. Discovered keys follow by how many items carry them.
 */
export function facets(items: InventoryItem[], fields: MetaField[], selection: Selection = {}): Facet[] {
  const declared = new Map(fields.map((f) => [norm(f.key), f]));
  const discovered = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item.attributes)) {
      if (!declared.has(norm(key))) discovered.add(key);
    }
  }

  const usage = (key: string) => items.filter((i) => valueOf(i, key) !== "").length;
  const keys = [
    ...fields.map((f) => f.key),
    ...[...discovered].sort((a, b) => usage(b) - usage(a) || a.localeCompare(b)),
  ];

  return keys.map((key) => {
    const field = declared.get(norm(key));
    // Counted against the other facets only, so a chosen value never zeroes its own siblings.
    const scope = survivors(items, selection, key);
    const counts = new Map<string, number>();
    let missing = 0;
    for (const item of scope) {
      const v = valueOf(item, key);
      if (!v) { missing++; continue; }
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const values = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return {
      key,
      dataType: field?.dataType ?? "",
      declared: Boolean(field),
      required: field?.required ?? false,
      options: field?.options ?? [],
      values,
      missing,
      present: scope.length - missing,
    };
  });
}

/** Items surviving every facet and the free-text search. */
export function filterItems(items: InventoryItem[], selection: Selection, query: string): InventoryItem[] {
  const q = norm(query);
  return survivors(items, selection).filter((item) => {
    if (!q) return true;
    const hay = norm(`${item.name} ${item.description} ${Object.values(item.attributes).join(" ")}`);
    return hay.includes(q);
  });
}

/** Toggle one value on one facet, dropping the key entirely when nothing is left selected. */
export function toggleFacet(selection: Selection, key: string, value: string): Selection {
  const current = selection[key] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const out = { ...selection };
  if (next.length) out[key] = next;
  else delete out[key];
  return out;
}

/** How many facets are narrowing the view, for a "clear all" that says what it clears. */
export function activeCount(selection: Selection): number {
  return Object.values(selection).reduce((n, v) => n + v.length, 0);
}

/**
 * Columns for the table: declared fields first, then discovered keys by usage.
 *
 * A declared field with no data still gets a column. An empty column in an inventory is the
 * clearest possible statement that nobody has filled the field in, and hiding it is how the
 * model and the data drift apart without anybody noticing.
 */
export function columns(items: InventoryItem[], fields: MetaField[], cap = 8): string[] {
  const declared = fields.map((f) => f.key);
  const seen = new Set(declared.map(norm));
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const [key, value] of Object.entries(item.attributes)) {
      if (seen.has(norm(key)) || !value.trim()) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const discovered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  return [...declared, ...discovered].slice(0, cap);
}

/**
 * The plural of a type name.
 *
 * "23 application" is the first thing a reader sees on this page, and getting it wrong makes
 * the whole screen look unfinished. Naive `+ "s"` turns Business Capability into Business
 * Capabilitys; the three ordinary English rules cover every type name an estate has produced so
 * far, and a name that is already plural ("Data") is left alone rather than guessed at.
 */
export function plural(name: string, n: number): string {
  if (n === 1) return name;
  const word = name.trim();
  if (!word) return word;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/* -------------------------------------------------------------------------------------------- */
/* Editing a value the model has an opinion about                                                 */
/* -------------------------------------------------------------------------------------------- */

/**
 * Why a value is not allowed for a declared field, or null when it is.
 *
 * The table used to edit every attribute as free text, including fields the meta-model declares
 * as an enum with four options — which is precisely how `Active` and `active` end up in the
 * same column and Nexus grows a whole proposals system to clean up a mess it allowed. A model
 * that declares a type and then does not use it when the value is typed is decoration.
 *
 * Empty always passes. Requiredness is a statement about a finished record, not about a
 * keystroke, and refusing to let somebody clear a field is how data gets stuck wrong.
 */
export function valueProblem(field: MetaField | undefined, raw: string): string | null {
  const value = raw.trim();
  if (!field || !value) return null;

  switch (field.dataType) {
    case "enum": {
      if (field.options.length === 0) return null;
      if (field.options.some((o) => norm(o) === norm(value))) return null;
      return `“${value}” is not one of: ${field.options.join(", ")}.`;
    }
    case "number":
      return Number.isFinite(Number(value)) ? null : `“${value}” is not a number.`;
    case "boolean":
      return ["true", "false", "yes", "no"].includes(norm(value)) ? null : `“${value}” is not yes or no.`;
    case "date":
      // Accept a year, a month or a full date — an estate records "2027-06" constantly.
      return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) || !Number.isNaN(Date.parse(value))
        ? null
        : `“${value}” is not a date. Try 2027, 2027-06 or 2027-06-30.`;
    case "url":
      return /^(https?:\/\/|www\.)\S+$/i.test(value) ? null : `“${value}” is not a web address.`;
    default:
      return null;
  }
}

/** The declared spelling of an enum value, so “Active” is stored as the model's “active”. */
export function canonical(field: MetaField | undefined, raw: string): string {
  const value = raw.trim();
  if (!field || field.dataType !== "enum" || !value) return value;
  return field.options.find((o) => norm(o) === norm(value)) ?? value;
}
