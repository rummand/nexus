import type { AgentElement } from "./document";
import type { BoardScope } from "@/lib/agent/remarks";

/**
 * What an agent says about itself (§5.52).
 *
 * Two sentences, both of them things the product already knew and used to throw away: what this
 * agent can see if you wake it now, and what the last run actually did. Kept pure and here rather
 * than inline in the view, because the wording *is* the feature — the whole point is that "I read
 * fourteen objects and none of them needed saying about" stops looking like "I could not see
 * anything at all" — and wording that matters deserves to be tested.
 */

/** Nothing in scope, said in a way that names the fix rather than the symptom. */
const EMPTY: Record<AgentElement["scope"], string> = {
  board: "Nothing on this board has any words on it yet",
  frame: "Not in a frame — drag it into one, or let it watch the board",
  connected: "Joined to nothing — draw a line from it to what it should watch",
};

const count = (n: number) => `${n} object${n === 1 ? "" : "s"}`;

/** What it can see, before you spend anything on finding out. */
export function scopeLine(scope: BoardScope, kind: AgentElement["scope"]): string {
  if (scope.items.length === 0) return EMPTY[kind];
  const where = scope.frame ? ` in “${scope.frame}”` : "";
  // The cap used to be silent, which reads exactly like an agent with nothing to say.
  if (scope.total > scope.items.length) return `Reads ${scope.items.length} of ${count(scope.total)}${where} — the rest are out of reach`;
  return `Reads ${count(scope.items.length)}${where}`;
}

/**
 * What the last run did.
 *
 * `read` is the number that separates the two silences. `discarded` is the validator throwing away
 * remarks that quoted words which were not on the object — worth showing rather than hiding,
 * because an agent that keeps making things up is one somebody should change or delete, and that
 * only becomes visible if the number is on the screen.
 */
export function runLine(el: Pick<AgentElement, "read" | "discarded" | "remarks">): string {
  const said = el.remarks?.length ?? 0;
  // Bare numerals rather than "N objects": this line shares 268 pixels with the time it ran, and
  // the word "objects" is already on the line above it.
  const parts = [`Read ${el.read ?? 0}`, said ? `said ${said}` : "said nothing"];
  if (el.discarded) parts.push(`discarded ${el.discarded}`);
  return parts.join(" · ");
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, in the roughest unit that is still true. */
export function ago(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "at some point";
  const ms = now - then;
  if (ms < 0) return "just now";
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
