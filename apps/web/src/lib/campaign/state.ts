import type { CheckId } from "@/lib/checks/suite";

/**
 * Where an object stands in a campaign (§5.85).
 *
 * The state machine is the part of #134 that does not exist anywhere in the product today. Right
 * now an object is in the model or it is not, and there is no room between for *somebody has
 * looked at this*. Five states, and one edge that decides whether the whole process is believed
 * or quietly ignored:
 *
 *   untouched → in review → validated
 *                        ↘ waived (with a reason and an expiry)
 *                        ↘ needs a decision (a question, addressed to somebody)
 *   validated → untouched, the moment the object changes
 *
 * That last edge is the one. A fact sheet validated in March and edited in June is **not**
 * validated: the burn-down goes up as well as down, and a waiver with no expiry cannot quietly
 * become permanent. Without it, validation is a badge people stop believing within a quarter —
 * which is the version every tool ships first and regrets.
 *
 * Pure, and over rows rather than over a database, so the rules can be tested and so the same
 * code answers for one object on its page and for four hundred on a burn-down.
 */

export const STATES = ["untouched", "in-review", "needs-decision", "validated", "waived"] as const;
export type ObjectState = (typeof STATES)[number];

/** What a person set, as stored. Absent means untouched — a fresh campaign writes no rows. */
export interface StateRow {
  entityId: string;
  state: Exclude<ObjectState, "untouched">;
  note: string;
  expiresAt: string | null;
  askedOfId: string | null;
  /** The object's `updatedAt` when this was recorded. */
  atVersion: string;
  byId: string | null;
  updatedAt: string;
}

export interface Standing {
  entityId: string;
  state: ObjectState;
  note: string;
  /** Set when a validation or waiver no longer holds, and why. */
  lapsed: "" | "changed" | "expired";
  askedOfId: string | null;
  byId: string | null;
  at: string;
}

export const UNTOUCHED: Standing = { entityId: "", state: "untouched", note: "", lapsed: "", askedOfId: null, byId: null, at: "" };

/**
 * What an object's state actually is, now — which is not always what was written down.
 *
 * Two things undo a decision without anybody revisiting it: the object changing after it was
 * validated, and a waiver reaching its expiry. Both put it back to `untouched` rather than to a
 * state of their own, because the work to do is the same work: somebody has to look again.
 */
export function standing(row: StateRow | undefined, entityUpdatedAt: string, now: number): Standing {
  if (!row) return UNTOUCHED;
  const base: Standing = {
    entityId: row.entityId, state: row.state, note: row.note, lapsed: "",
    askedOfId: row.askedOfId, byId: row.byId, at: row.updatedAt,
  };

  if (row.state === "validated" && row.atVersion && entityUpdatedAt && entityUpdatedAt !== row.atVersion) {
    return { ...base, state: "untouched", lapsed: "changed" };
  }
  if (row.state === "waived") {
    if (!row.expiresAt) return base;
    const until = Date.parse(row.expiresAt);
    if (Number.isFinite(until) && until <= now) return { ...base, state: "untouched", lapsed: "expired" };
  }
  return base;
}

export interface BurnDown {
  total: number;
  untouched: number;
  inReview: number;
  needsDecision: number;
  validated: number;
  waived: number;
  /** Validated or deliberately waived: the part that is finished. */
  done: number;
  /** How many came back — the number that makes the burn-down honest. */
  lapsed: number;
  /** 0–100. */
  percent: number;
}

export function burnDown(standings: Standing[]): BurnDown {
  const count = (s: ObjectState) => standings.filter((x) => x.state === s).length;
  const validated = count("validated");
  const waived = count("waived");
  const total = standings.length;
  const done = validated + waived;
  return {
    total,
    untouched: count("untouched"),
    inReview: count("in-review"),
    needsDecision: count("needs-decision"),
    validated,
    waived,
    done,
    lapsed: standings.filter((x) => x.lapsed).length,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
  };
}

/** The line on the campaign page and in the rail. */
export function burnWords(b: BurnDown): string {
  if (!b.total) return "Nothing in scope yet.";
  const left = b.total - b.done;
  const parts = [`${b.validated} validated`];
  if (b.waived) parts.push(`${b.waived} waived`);
  parts.push(`${left} to go`);
  return parts.join(" · ");
}

/**
 * A campaign closes when its scope satisfies its definition of done, or when the remainder is
 * explicitly waived. There is no third way out: a campaign that can be closed with work left
 * and nobody's name against it is a campaign nobody believes the next time.
 */
export function canClose(b: BurnDown): { ok: boolean; why: string } {
  if (!b.total) return { ok: true, why: "Nothing is in scope." };
  if (b.done === b.total) return { ok: true, why: "Everything in scope is validated or waived." };
  const left = b.total - b.done;
  // The verb agrees too: "1 object still need somebody" is the kind of sentence that makes a
  // product feel machine-written.
  const subject = left === 1 ? "1 object still needs" : `${left} objects still need`;
  return { ok: false, why: `${subject} somebody: validate it, or waive it with a reason.` };
}

export const STATE_LABEL: Record<ObjectState, string> = {
  untouched: "Nobody has looked",
  "in-review": "Somebody has it",
  "needs-decision": "Waiting on an answer",
  validated: "Validated",
  waived: "Waived",
};

/** What the campaign is checking, in the words the checks themselves use. */
export interface Definition {
  checks: CheckId[];
}

/** A campaign's scope is a query, so it stays true as objects arrive rather than going stale. */
export function parseChecks(raw: string): CheckId[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as CheckId[]) : [];
  } catch {
    return [];
  }
}
