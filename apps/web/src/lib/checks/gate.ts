import { severityOf, verdict, type Finding } from "./suite";

/**
 * The gate a merge goes through (§5.88).
 *
 * #136 built the arithmetic — what this ref adds to the estate's findings, and whether anything
 * blocking is among them — and then wired it to a page that could only report. This is the part
 * that can say no.
 *
 * Kept pure and separate from the action so the one thing worth getting right, *what counts as a
 * refusal and how it reads*, can be tested without a database. The action supplies the two runs;
 * everything else is here.
 *
 * Two rules the wording follows. Only findings this ref **adds** count: a plan is not answerable
 * for the four hundred undeclared types it inherited, and a gate that refused on those would
 * never open. And only **blocking** ones stop it: an advisory finding is worth saying out loud
 * at the moment of merging and is not worth a locked door.
 */

export interface Refusal {
  blocking: number;
  advisory: number;
  /** The headline: "2 new blocking findings." */
  words: string;
  /** The first few, so the refusal names something rather than a number. */
  named: Array<{ subjectId: string; subjectName: string; detail: string }>;
  /** How many blocking findings are not named above. */
  more: number;
}

/** The most a refusal spells out. Past this it is a list, and the checks page is the list. */
const NAMED = 3;

export function mergeGate(added: Finding[]): { ok: true; advisory: number } | { ok: false; refusal: Refusal } {
  const call = verdict(added);
  if (call.ok) return { ok: true, advisory: call.advisory };
  const blocking = added.filter((f) => severityOf(f.checkId) === "blocking");
  return {
    ok: false,
    refusal: {
      blocking: call.blocking,
      advisory: call.advisory,
      words: call.words,
      named: blocking.slice(0, NAMED).map((f) => ({ subjectId: f.subjectId, subjectName: f.subjectName, detail: f.detail })),
      more: Math.max(0, blocking.length - NAMED),
    },
  };
}

/**
 * The refusal as one sentence, for somewhere that has only a string — a toast, a CLI, an agent's
 * transcript. The page has room to do better and does.
 */
export function refusalWords(refusal: Refusal): string {
  const named = refusal.named.map((f) => `“${f.subjectName || "(unnamed)"}” ${f.detail}`).join("; ");
  const rest = refusal.more ? `, and ${refusal.more} more` : "";
  return `${refusal.words} ${named}${rest}.`;
}
