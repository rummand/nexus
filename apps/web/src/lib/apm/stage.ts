import { dateOrder, toIsoDate, type Column, type Role } from "./map";

/**
 * The staging area: what the files say, before anything says it is true.
 *
 * Two ideas do the work here.
 *
 * **Provenance per field, not per record.** ServiceNow says the owner is Asset Management; the
 * spreadsheet says it is Grid Ops. Both are recorded, against the file and column they came from,
 * and the winner is decided by a trust order somebody can see and change. Storing only the winner
 * is how an estate model becomes an argument nobody can settle: the losing value is exactly what
 * you need when somebody asks "where did that come from".
 *
 * **Nothing is written.** A staged record is a claim. It is matched, checked and flagged here, and
 * the graph is not touched until a person approves the batch — the same plan-then-validate line
 * every other part of Nexus draws.
 */

export interface FieldValue {
  value: string;
  /** The file it came from. */
  source: string;
  column: string;
}

export interface Field {
  /** The value that would be written, by the trust order. */
  chosen: FieldValue;
  /** Everything else that was said about this field, kept. */
  others: FieldValue[];
}

export interface StagedRelation {
  kind: string;
  /** The name of the other object, as the file wrote it. */
  target: string;
  source: string;
  column: string;
}

export type Decision = "accept" | "hold" | "reject";

export interface StagedRecord {
  id: string;
  name: string;
  kind: string;
  description: string;
  /** The source's own identifier, when a column was mapped as one. */
  key: string;
  attributes: Record<string, Field>;
  /** Attributes whose column names people. Not written unless somebody says so. */
  personal: Record<string, Field>;
  relations: StagedRelation[];
  /** Which files contributed to this record, in the order they were read. */
  sources: string[];
  /** Row numbers per file, so a row can be found again in the original. */
  rows: Array<{ source: string; row: number }>;
}

export interface FileInput {
  name: string;
  headers: string[];
  rows: string[][];
  columns: Column[];
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Read one file's rows into claims, then fold them together with everything else in the batch.
 *
 * Records are folded on the source key where there is one and on the normalised name otherwise:
 * the same application in a ServiceNow export and a SharePoint list is one thing arriving twice,
 * and discovering that here rather than in the graph is the entire point of a staging area.
 */
export function stage(files: FileInput[], options: { includePersonal?: boolean } = {}): StagedRecord[] {
  const byKey = new Map<string, StagedRecord>();
  const byName = new Map<string, StagedRecord>();
  const order: StagedRecord[] = [];

  for (const file of files) {
    const dayFirst = new Map<string, boolean | null>();
    for (const [i, column] of file.columns.entries()) {
      if (column.role.as === "date") {
        dayFirst.set(column.header, dateOrder(file.rows.map((r) => r[i] ?? "")));
      }
    }

    file.rows.forEach((row, rowIndex) => {
      const claim = readRow(file, row, dayFirst);
      /*
       * Which claims are the same object.
       *
       * A key is the strongest thing there is, and only one source usually has one — so a record is
       * findable by key *and* by name, and the SharePoint list folds onto the ServiceNow row it has
       * no key for. Two claims that both carry keys and disagree are two objects however alike their
       * names are: that is what a key is for, and folding them would be the one merge nobody can undo.
       */
      const key = claim.key ? `key:${norm(claim.key)}` : "";
      const name = claim.name ? `name:${norm(claim.name)}` : "";
      const byItsKey = key ? byKey.get(key) : undefined;
      const byItsName = name ? byName.get(name) : undefined;
      const existing = byItsKey ?? (byItsName && !(claim.key && byItsName.key && norm(byItsName.key) !== norm(claim.key)) ? byItsName : undefined);
      // A row with neither a name nor a key is still a row: it is kept so the review can hold it
      // and say what is wrong, rather than dropping it where nobody will ever look for it.
      const target = existing ?? blank(key || name || `row:${file.name}:${rowIndex}`, claim.name);
      if (!existing) order.push(target);
      if (key) byKey.set(key, target);
      if (name) byName.set(name, target);

      target.name ||= claim.name;
      target.kind ||= claim.kind;
      target.description ||= claim.description;
      target.key ||= claim.key;
      if (!target.sources.includes(file.name)) target.sources.push(file.name);
      target.rows.push({ source: file.name, row: rowIndex + 2 }); // +2: header row, and 1-based

      for (const [key, value] of Object.entries(claim.attributes)) merge(target.attributes, key, value);
      for (const [key, value] of Object.entries(claim.personal)) merge(target.personal, key, value);
      for (const relation of claim.relations) {
        if (!target.relations.some((r) => r.kind === relation.kind && norm(r.target) === norm(relation.target))) {
          target.relations.push(relation);
        }
      }
    });
  }

  if (options.includePersonal) {
    for (const record of order) {
      for (const [key, field] of Object.entries(record.personal)) merge(record.attributes, key, field.chosen);
      record.personal = {};
    }
  }
  return order;
}

/**
 * The trust order is the order the files were given, so the first file wins a disagreement — and
 * the loser is kept beside it rather than dropped. Re-order the files and the answer changes,
 * which is the whole of the mechanism a person needs to understand.
 */
function merge(into: Record<string, Field>, key: string, value: FieldValue) {
  const existing = into[key];
  if (!existing) { into[key] = { chosen: value, others: [] }; return; }
  if (norm(existing.chosen.value) === norm(value.value)) return; // agreement is not a conflict
  if (existing.others.some((o) => norm(o.value) === norm(value.value))) return;
  existing.others.push(value);
}

function blank(id: string, name: string): StagedRecord {
  return { id, name, kind: "", description: "", key: "", attributes: {}, personal: {}, relations: [], sources: [], rows: [] };
}

interface Claim {
  name: string;
  kind: string;
  description: string;
  key: string;
  attributes: Record<string, FieldValue>;
  personal: Record<string, FieldValue>;
  relations: StagedRelation[];
  /** Values a date column could not read, so the row can be flagged rather than silently blanked. */
  badDates: Array<{ column: string; value: string }>;
}

export function readRow(file: FileInput, row: string[], dayFirst: Map<string, boolean | null>): Claim {
  const claim: Claim = { name: "", kind: "", description: "", key: "", attributes: {}, personal: {}, relations: [], badDates: [] };
  file.columns.forEach((column, i) => {
    const raw = (row[i] ?? "").trim();
    if (!raw) return;
    const at = { value: raw, source: file.name, column: column.header };
    applyRole(claim, column.role, at, dayFirst.get(column.header) ?? null);
  });
  return claim;
}

function applyRole(claim: Claim, role: Role, at: FieldValue, dayFirst: boolean | null) {
  switch (role.as) {
    case "ignore": return;
    case "name": claim.name = at.value; return;
    case "kind": claim.kind = at.value; return;
    case "description": claim.description = at.value; return;
    case "key": claim.key = at.value; return;
    case "attribute": claim.attributes[role.key] = at; return;
    case "person": claim.personal[role.key] = at; return;
    case "relation": {
      // One cell often holds a list: "SAP, Maximo; SCADA" is three relations, not one object with
      // a comma in its name.
      for (const target of at.value.split(/\s*[;,|]\s*/).map((t) => t.trim()).filter(Boolean)) {
        claim.relations.push({ kind: role.kind, target, source: at.source, column: at.column });
      }
      return;
    }
    case "date": {
      const iso = toIsoDate(at.value, dayFirst);
      if (iso) claim.attributes[role.key] = { ...at, value: iso };
      else {
        claim.attributes[role.key] = at;
        claim.badDates.push({ column: at.column, value: at.value });
      }
      return;
    }
  }
}

/** Every value a record would write, for a diff or a card. */
export function flatten(record: StagedRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(record.attributes)) out[key] = field.chosen.value;
  return out;
}

/** Fields where the sources disagree — the thing a person most needs to see. */
export function conflicts(record: StagedRecord): Array<{ key: string; chosen: FieldValue; others: FieldValue[] }> {
  return Object.entries(record.attributes)
    .filter(([, field]) => field.others.length > 0)
    .map(([key, field]) => ({ key, chosen: field.chosen, others: field.others }));
}
