import type { Column } from "./map";
import type { Decision, ProseClaim, StagedRecord } from "./stage";
import type { Issue, Reviewed } from "./review";
import type { Match, Change } from "./match";
import type { DrawnRelation, RecordOverride } from "./reconcile";

/**
 * A batch, as it is stored and read back.
 *
 * The staged review is JSON in one column, the way intake stores an extraction (§5.15): these
 * shapes are going to keep changing as we learn what a bad export looks like, and pinning them
 * into columns would freeze the pipeline at whatever we understood on the first day.
 *
 * What is *not* loose is `Written`. That is the record of what approving the batch did, and it is
 * the only thing that makes a rollback honest — so it is read back defensively and its shape is
 * treated as a contract.
 */

export interface BatchFile {
  name: string;
  format: string;
  columns: Column[];
  headers: string[];
  rows: string[][];
  /** What the rows in this file are, when no column says (§5.36). Proposed, and settable. */
  kind?: string;
  /** Why that kind was proposed, in one sentence a person can judge. */
  kindWhy?: string;
  /** True when the rows carry their own kind, so a file-level one would be ignored. */
  kindFromRows?: boolean;
  /**
   * The source already knew what its columns and its kind were, so do not re-guess them (§5.63).
   *
   * The mapper exists because a CSV says nothing about itself. A repository with an API is the
   * opposite case: LeanIX names every field and every relation type, and having the guesser
   * overwrite that would turn known facts back into inferences — and quietly lose the relations,
   * whose headers are the source's own names rather than the English the regexes look for.
   */
  declared?: boolean;
  /** Prose files are kept whole, for extraction rather than columns. */
  text?: string;
  /**
   * What was read out of that prose (§5.38), stored so a re-map re-stages without re-reading —
   * which matters because reading is the one step in this pipeline that can cost money.
   */
  claims?: ProseClaim[];
  /** One sentence about how it was read and what came out. */
  claimsNote?: string;
  /**
   * The picture, when the file was one (§5.91). Kept with the batch like the rows and the prose
   * are, so a re-read never asks somebody to find the slide deck again.
   */
  image?: { mediaType: string; data: string; bytes: number };
  note?: string;
}

export interface StoredReview {
  records: StagedRecord[];
  /** Per record id: the decision, and whether a person made it. */
  decisions: Record<string, { decision: Decision; by: "default" | "person" }>;
  /** Edits made on the board: a renamed card, a kind set, a description corrected (§5.36). */
  overrides?: Record<string, RecordOverride>;
  /** Relations drawn between two staged cards on the board. */
  drawn?: DrawnRelation[];
  /** Records a person deleted from the board. Kept as a list, so a redraw does not bring them back. */
  removed?: string[];
  /** Recomputed on read, but stored so an approved batch still shows what it showed. */
  rows?: Array<{ id: string; match: Match; changes: Change[]; issues: Issue[] }>;
  includePersonal: boolean;
  missing?: Array<{ entityId: string; name: string; message: string }>;
}

/** What approving the batch wrote, and what it wrote over. */
export interface Written {
  /** Entities created, which a rollback deletes if nothing has been hung on them since. */
  created: string[];
  /** Relations created. */
  relations: string[];
  /** Fields changed on entities that already existed, with the value that was there before. */
  updated: Array<{ entityId: string; key: string; from: string; to: string }>;
  at: string;
}

export const emptyWritten = (): Written => ({ created: [], relations: [], updated: [], at: "" });

export function parseFiles(raw: string): BatchFile[] {
  const parsed = safe(raw);
  return Array.isArray(parsed) ? (parsed as BatchFile[]) : [];
}

export function parseReview(raw: string): StoredReview {
  const parsed = safe(raw);
  if (!parsed || typeof parsed !== "object") return { records: [], decisions: {}, includePersonal: false };
  const body = parsed as Partial<StoredReview>;
  return {
    records: Array.isArray(body.records) ? body.records : [],
    decisions: body.decisions && typeof body.decisions === "object" ? body.decisions : {},
    overrides: body.overrides && typeof body.overrides === "object" ? body.overrides : undefined,
    drawn: Array.isArray(body.drawn)
      ? body.drawn.filter((d): d is DrawnRelation => Boolean(d) && typeof d === "object" && typeof d.from === "string" && typeof d.to === "string")
      : undefined,
    removed: strings(body.removed),
    rows: Array.isArray(body.rows) ? body.rows : undefined,
    includePersonal: Boolean(body.includePersonal),
    missing: Array.isArray(body.missing) ? body.missing : undefined,
  };
}

/**
 * Read back what a batch wrote.
 *
 * Defensively, and dropping anything malformed: a rollback that acts on half-understood rows is
 * worse than one that says it cannot act. Anything dropped here shows up as "could not be
 * reverted" rather than as a silent no-op.
 */
export function parseWritten(raw: string): Written {
  const parsed = safe(raw);
  if (!parsed || typeof parsed !== "object") return emptyWritten();
  const body = parsed as Partial<Written>;
  return {
    created: strings(body.created),
    relations: strings(body.relations),
    updated: Array.isArray(body.updated)
      ? body.updated.filter((u): u is Written["updated"][number] =>
          Boolean(u) && typeof u === "object" && typeof u.entityId === "string" && typeof u.key === "string" && typeof u.to === "string")
      : [],
    at: typeof body.at === "string" ? body.at : "",
  };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function safe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The decisions a person has taken, applied over a freshly computed review. */
export function applyDecisions(rows: Reviewed[], stored: StoredReview["decisions"]): Reviewed[] {
  return rows.map((row) => {
    const decided = stored[row.record.id];
    return decided ? { ...row, decision: decided.decision, decidedBy: decided.by } : row;
  });
}
