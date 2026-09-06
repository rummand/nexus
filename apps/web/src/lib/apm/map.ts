import { excelDate } from "./read";

/**
 * What each column of a file means.
 *
 * This is the step every import tool gets wrong by asking too much or too little. Ask nothing and
 * you get a graph full of columns called `u_bsn_crit_1`; ask for everything and nobody finishes the
 * form. So Nexus proposes a mapping from the headers and a look at the values, says why for each
 * one, and lets a person change any of it — the same shape as every other agent here: a proposal
 * with its reasoning attached, and a human deciding.
 *
 * Deliberately rules rather than a model: it must work with no key, it must give the same answer
 * twice, and the vocabulary of an export header is small enough that rules are simply better. A
 * model can improve it later by proposing for the columns the rules leave as plain attributes.
 */

export type Role =
  /** The object's name. Exactly one column, or nothing gets a name. */
  | { as: "name" }
  | { as: "kind" }
  | { as: "description" }
  /** A stable identifier in the source system — what makes re-importing an update, not a copy. */
  | { as: "key" }
  | { as: "attribute"; key: string }
  /** An attribute whose values are dates: Excel serials and local formats are normalised. */
  | { as: "date"; key: string }
  /** An attribute that names people. Kept apart so it can be excluded before anything is written. */
  | { as: "person"; key: string }
  /** The value names another object; this becomes a relation of the given type. */
  | { as: "relation"; kind: string }
  | { as: "ignore" };

export interface Column {
  header: string;
  role: Role;
  /** One sentence a person can judge, naming what was read. */
  why: string;
  /** A few real values, so the choice can be checked without opening the file. */
  sample: string[];
}

const norm = (v: string) => v.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

const NAME = /^(name|app name|application|application name|app|title|system|display name|label|u name|short name)$/;
const KEY = /^(id|sys id|number|key|guid|uuid|asset tag|correlation id|external id|ci id|record id)$/;
const KIND = /^(kind|type|class|category|sys class name|object type|record type|ci class)$/;
const DESCRIPTION = /^(description|short description|summary|purpose|comments|notes|remarks|business purpose)$/;
const PERSON = /(owner|manager|contact|responsible|steward|custodian|author|approver|assigned to|requested by|sponsor|architect)/;
const DATE = /(date|since|until|expiry|expires|renewal|end of|eol|eos|go live|golive|retire|decommission|created|updated|modified|review)/;
const RELATION: Array<[RegExp, string]> = [
  [/depends on|dependency|dependencies|requires/, "depends on"],
  [/hosted on|runs on|host|platform|infrastructure/, "runs on"],
  [/uses|consumes|consumed by/, "uses"],
  [/provides|serves|supports/, "supports"],
  [/interfaces|integration|integrates|connects to|feeds/, "feeds"],
  [/parent|belongs to|part of|capability/, "part of"],
];
/** Columns that are audit noise in every export and almost never wanted in a model. */
const NOISE = /^(sys (created|updated) (on|by)|sys mod count|sys tags|sys domain|version|checksum|row number|#)$/;

const looksLikeEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.trim());
const looksLikePerson = (v: string) => /^[A-Z][a-z'’-]+(?: [A-Z][a-z'’-]+){1,2}$/.test(v.trim());

/** Whether a value reads as a date in any of the forms an export actually contains. */
export function readsAsDate(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(v)) return true;
  if (/^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/.test(v)) return true;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) return true;
  if (/^\d{1,2} [a-z]{3,9},? \d{4}$/i.test(v)) return true;
  // A bare number in Excel's serial range, but only where it could not be a quantity anybody means.
  if (/^\d{5}$/.test(v) && excelDate(Number(v)) !== null) return true;
  return false;
}

/**
 * A date in whatever form, as ISO.
 *
 * Ambiguous slash dates are the one thing here that cannot be solved by looking at a single value:
 * 03/04/2027 is March or April depending on which side of an ocean the export came from. The column
 * is judged as a whole — if any value in it has a day above 12, the order is settled for all of
 * them — and when the column is genuinely ambiguous it is left alone and flagged rather than
 * guessed, because a roadmap a month out is worse than a blank.
 */
export function toIsoDate(value: string, dayFirst: boolean | null): string | null {
  const v = value.trim();
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
  if (iso) return iso[3] ? v : `${iso[1]}-${iso[2]}`;
  if (/^\d{5}$/.test(v)) return excelDate(Number(v));
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(v);
  if (slash) {
    const a = Number(slash[1]), b = Number(slash[2]), year = slash[3]!;
    if (a > 12 && b <= 12) return `${year}-${pad(b)}-${pad(a)}`;
    if (b > 12 && a <= 12) return `${year}-${pad(a)}-${pad(b)}`;
    if (dayFirst === null) return null; // genuinely ambiguous — say so rather than pick
    return dayFirst ? `${year}-${pad(b)}-${pad(a)}` : `${year}-${pad(a)}-${pad(b)}`;
  }
  const ymd = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(v);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const spelled = /^(\d{1,2}) ([a-z]{3,9}),? (\d{4})$/i.exec(v);
  if (spelled) {
    const month = MONTHS.findIndex((m) => m.startsWith(spelled[2]!.toLowerCase().slice(0, 3)));
    if (month >= 0) return `${spelled[3]}-${pad(month + 1)}-${pad(Number(spelled[1]))}`;
  }
  return null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Whether a column of slash dates is day-first, month-first, or cannot be told from its values. */
export function dateOrder(values: string[]): boolean | null {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values) {
    const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(v.trim());
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  if (dayFirst && !monthFirst) return true;
  if (monthFirst && !dayFirst) return false;
  return null;
}

/**
 * Propose what every column means.
 *
 * The name is the one thing that must be right, so it is chosen twice over: by header first, and
 * failing that by the column whose values are most nearly unique — which is what a name is.
 */
export function proposeMapping(headers: string[], rows: string[][], options: { knownNames?: string[] } = {}): Column[] {
  /*
   * A relation column is one whose values name things.
   *
   * The header alone is not enough: "Hosting" reads like a relation and holds "on premise", while
   * "Depends on" holds the names of other systems. Given the names this batch and the graph know
   * about, the difference is decidable — a column whose values are mostly known names is pointing
   * at objects, and one whose values are mostly not is describing this one.
   */
  const known = new Set((options.knownNames ?? []).map(norm));
  const columns: Column[] = headers.map((header, i) => {
    const values = rows.map((r) => (r[i] ?? "").trim()).filter(Boolean);
    const sample = [...new Set(values)].slice(0, 3);
    const h = norm(header);
    const filled = values.length;
    const distinct = new Set(values.map((v) => v.toLowerCase())).size;

    if (filled === 0) return { header, role: { as: "ignore" }, why: "Every row is empty.", sample };
    if (NOISE.test(h)) return { header, role: { as: "ignore" }, why: "Audit metadata from the source system.", sample };
    if (KEY.test(h)) return { header, role: { as: "key" }, why: `“${header}” reads as the source's own identifier — what makes the next export an update rather than a copy.`, sample };
    if (NAME.test(h)) return { header, role: { as: "name" }, why: `“${header}” is the object's name.`, sample };
    if (KIND.test(h)) return { header, role: { as: "kind" }, why: `“${header}” reads as what sort of thing each row is.`, sample };
    if (DESCRIPTION.test(h)) return { header, role: { as: "description" }, why: `“${header}” is prose about the object.`, sample };

    const dated = values.filter(readsAsDate).length;
    if (DATE.test(h) && dated >= Math.max(1, filled * 0.5)) {
      return { header, role: { as: "date", key: h }, why: `“${header}” is a date column — ${dated} of ${filled} values read as dates.`, sample };
    }
    if (PERSON.test(h) && values.some((v) => looksLikeEmail(v) || looksLikePerson(v))) {
      return { header, role: { as: "person", key: h }, why: `“${header}” names people. It is kept separate so you can decide before anything about a person enters the graph.`, sample };
    }
    for (const [pattern, kind] of RELATION) {
      if (!pattern.test(h)) continue;
      const targets = values.flatMap((v) => v.split(/\s*[;,|]\s*/)).map((v) => norm(v.trim())).filter(Boolean);
      const recognised = known.size ? targets.filter((t) => known.has(t)).length : 0;
      if (!known.size || recognised >= Math.max(1, targets.length * 0.5)) {
        return {
          header,
          role: { as: "relation", kind },
          why: known.size
            ? `“${header}” holds names of other objects — ${recognised} of ${targets.length} are things this batch or the graph knows — so it reads as a “${kind}” relation.`
            : `“${header}” names another object, so it reads as a “${kind}” relation.`,
          sample,
        };
      }
      // Named like a relation, but its values are not names: it is describing this object.
      return {
        header,
        role: { as: "attribute", key: h },
        why: `“${header}” reads like a relation, but its values (${sample.slice(0, 2).join(", ")}) name nothing this batch or the graph has — so it is an attribute of the object itself.`,
        sample,
      };
    }
    if (dated >= Math.max(2, filled * 0.8)) {
      return { header, role: { as: "date", key: h }, why: `Not named like a date, but ${dated} of ${filled} values are dates.`, sample };
    }
    return {
      header,
      role: { as: "attribute", key: h },
      why: distinct <= 12 && filled > distinct
        ? `An attribute with ${distinct} distinct value${distinct === 1 ? "" : "s"} — the kind of column a lens is useful on.`
        : "An attribute.",
      sample,
    };
  });

  if (!columns.some((c) => c.role.as === "name")) {
    // No column announced itself. A name is the column that is filled in and nearly always
    // different — pick that one, and say that is why.
    let best = -1;
    let bestScore = 0;
    headers.forEach((_, i) => {
      const values = rows.map((r) => (r[i] ?? "").trim()).filter(Boolean);
      if (!values.length) return;
      const unique = new Set(values.map((v) => v.toLowerCase())).size / values.length;
      const filled = values.length / Math.max(1, rows.length);
      const short = values.every((v) => v.length <= 80) ? 1 : 0.4;
      const score = unique * filled * short;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    const chosen = columns[best];
    if (chosen && bestScore > 0.5) {
      chosen.role = { as: "name" };
      chosen.why = `Nothing was named like a name, and “${chosen.header}” is filled in and almost always different — which is what a name is.`;
    }
  }
  return columns;
}

/** The mapping, as a person would read it back. */
export function describeRole(role: Role): string {
  switch (role.as) {
    case "name": return "name";
    case "kind": return "kind";
    case "description": return "description";
    case "key": return "source key";
    case "attribute": return `attribute · ${role.key}`;
    case "date": return `date · ${role.key}`;
    case "person": return `person · ${role.key}`;
    case "relation": return `relation · ${role.kind}`;
    case "ignore": return "ignored";
  }
}
