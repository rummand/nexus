import type { MetaField } from "@/lib/metamodel";

/**
 * An object page, arranged (§5.77).
 *
 * An object's page is not a dump of its attributes: it is the type's own opinion about what
 * belongs beside what. The meta-model carries that opinion — each declared field names the
 * section it sits in — and this turns it into the order the page is read in.
 *
 * Three rules, and each is about not lying to the reader:
 *
 * - **A declared field appears even when it is empty.** An unanswered required field is a finding,
 *   not an absence, and hiding it makes the page look complete when it is not.
 * - **Nothing is filed by guesswork.** A key that arrived in an import and was never declared goes
 *   in one honest group at the end rather than under a heading somebody's regex picked. Guessing
 *   puts `lxCostCentre` under Lifecycle and then nobody trusts any of the headings.
 * - **Sections keep the order the modeller gave them.** First appearance in the type's field
 *   order, not alphabetical: somebody decided Ownership comes before Cost, and alphabetising it
 *   throws that away.
 */

export interface SheetValue {
  key: string;
  value: string;
  field?: MetaField;
  /** Declared, carries no value, and the type says it must. */
  missing: boolean;
}

export interface SheetSection {
  title: string;
  /** True for the catch-all holding keys the meta-model has never heard of. */
  fromData: boolean;
  values: SheetValue[];
}

/** Where declared fields with no section of their own go. */
export const UNFILED = "Details";
/** Where attribute keys nobody declared go. */
export const FROM_DATA = "From the data";

const norm = (v: string) => v.trim().toLowerCase();

export function sheetSections(fields: MetaField[], attributes: Record<string, string>): SheetSection[] {
  const declared = fields.filter((f) => f.presence !== "undeclared");
  const byKey = new Map(Object.entries(attributes).map(([k, v]) => [norm(k), { key: k, value: v }]));

  const order: string[] = [];
  const buckets = new Map<string, SheetValue[]>();
  const put = (title: string, value: SheetValue) => {
    if (!buckets.has(title)) { buckets.set(title, []); order.push(title); }
    buckets.get(title)!.push(value);
  };

  for (const field of declared) {
    const hit = byKey.get(norm(field.key));
    const value = hit?.value ?? "";
    put(field.section.trim() || UNFILED, {
      key: field.key,
      value,
      field,
      missing: !value.trim() && field.required,
    });
  }

  /*
   * Everything the object carries that no field declares. On an imported estate this is most of
   * them — 52 undeclared types on the LeanIX pull — so it is a section, not an error state.
   */
  const claimed = new Set(declared.map((f) => norm(f.key)));
  const loose = Object.entries(attributes)
    .filter(([key, value]) => !claimed.has(norm(key)) && value.trim())
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, value] of loose) put(FROM_DATA, { key, value, missing: false });

  return order.map((title) => ({ title, fromData: title === FROM_DATA, values: buckets.get(title)! }));
}

/** The sections a type offers, for the picker on a field. First use wins the order. */
export function sectionsOf(fields: MetaField[]): string[] {
  const seen: string[] = [];
  for (const field of fields) {
    const title = field.section.trim();
    if (title && !seen.some((s) => norm(s) === norm(title))) seen.push(title);
  }
  return seen;
}

/**
 * What the page says about how complete the object is.
 *
 * Counts declared fields only: an object is not incomplete because somebody's spreadsheet had a
 * column for it, and counting undeclared keys would make the number move every time an import
 * brings a new one.
 */
export function completeness(sections: SheetSection[]): { filled: number; declared: number; missing: number } {
  let filled = 0, declaredCount = 0, missing = 0;
  for (const section of sections) {
    if (section.fromData) continue;
    for (const value of section.values) {
      declaredCount++;
      if (value.value.trim()) filled++;
      if (value.missing) missing++;
    }
  }
  return { filled, declared: declaredCount, missing };
}
