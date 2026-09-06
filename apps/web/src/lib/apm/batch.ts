import type { Column } from "./map";
import type { Decision, StagedRecord } from "./stage";
import type { Issue, Reviewed } from "./review";
import type { Match, Change } from "./match";

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
  /** Prose files are kept whole, for extraction rather than columns. */
  text?: string;
  note?: string;
}

export interface StoredReview {
  records: StagedRecord[];
  /** Per record id: the decision, and whether a person made it. */
  decisions: Record<string, { decision: Decision; by: "default" | "person" }>;
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
