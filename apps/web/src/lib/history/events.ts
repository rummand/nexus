/**
 * The graph's memory, as pure functions (§5.43).
 *
 * Everything here is arithmetic on two snapshots of an entity: what it looked like, what it looks
 * like now, and therefore what somebody did to it. Nothing in this file touches a database, which
 * is what makes the interesting cases — an attribute that went from empty to empty, a rename that
 * is only whitespace, a merge that also inherited a description — cheap to write down as tests.
 *
 * The vocabulary is deliberately small. A history with thirty verbs is one nobody can scan; these
 * twelve cover everything the product can actually do to an entity, and anything that does not fit
 * is a sign the product grew a capability that should be named here too.
 */

export const ACTOR_KINDS = ["person", "agent", "import", "board", "rules", "system"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export interface Actor {
  kind: ActorKind;
  /** A user id, an agent definition id, an import batch id — or null when there is nothing to point at. */
  id: string | null;
  name: string;
}

export const EVENT_KINDS = [
  "created",
  "renamed",
  "retyped",
  "described",
  "attributeSet",
  "attributeRemoved",
  "relationAdded",
  "relationRemoved",
  "moved",
  "absorbed",
  "merged",
  "deleted",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(v: unknown): v is EventKind {
  return typeof v === "string" && (EVENT_KINDS as readonly string[]).includes(v);
}

export function isActorKind(v: unknown): v is ActorKind {
  return typeof v === "string" && (ACTOR_KINDS as readonly string[]).includes(v);
}

/** Just enough of an entity to tell what changed. */
export interface EntitySnapshot {
  id: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
  /**
   * What contains it (§5.70), by id — and separately the name, for the sentence.
   *
   * Compared by id on purpose: comparing the names would report every child of a renamed parent
   * as having *moved*, which is a room full of events for something nobody did.
   */
  parentId?: string;
  parentName?: string;
}

/** One field that moved. Becomes one row, and one line a person can read. */
export interface Change {
  kind: EventKind;
  field: string;
  from: string;
  to: string;
}

/** A recorded event, as the pages read it back. */
export interface GraphEvent extends Change {
  id: string;
  entityId: string;
  entityName: string;
  actor: Actor;
  context: string;
  at: string;
}

const trim = (v: string | undefined | null) => (v ?? "").trim();

/**
 * What one person's edit did.
 *
 * A creation is one event, not one per field: importing four hundred rows with five attributes
 * each should read as four hundred things happening, not two thousand. The fields an entity was
 * born with are on the entity; only what happened *since* is history.
 */
export function diffEntity(before: EntitySnapshot | null, after: EntitySnapshot | null): Change[] {
  if (!before && !after) return [];
  if (!before && after) return [{ kind: "created", field: trim(after.kind), from: "", to: trim(after.name) }];
  if (before && !after) return [{ kind: "deleted", field: trim(before.kind), from: trim(before.name), to: "" }];
  const a = before!;
  const b = after!;
  const out: Change[] = [];

  if (trim(a.name) !== trim(b.name)) out.push({ kind: "renamed", field: "", from: trim(a.name), to: trim(b.name) });
  if (trim(a.kind) !== trim(b.kind)) out.push({ kind: "retyped", field: "", from: trim(a.kind), to: trim(b.kind) });
  if (trim(a.description) !== trim(b.description)) out.push({ kind: "described", field: "", from: trim(a.description), to: trim(b.description) });
  if (trim(a.parentId) !== trim(b.parentId)) {
    out.push({ kind: "moved", field: "", from: trim(a.parentName) || trim(a.parentId), to: trim(b.parentName) || trim(b.parentId) });
  }

  // Sorted, so two runs over the same edit produce the same history in the same order.
  const keys = [...new Set([...Object.keys(a.attributes), ...Object.keys(b.attributes)])].sort();
  for (const key of keys) {
    const from = trim(a.attributes[key]);
    const to = trim(b.attributes[key]);
    if (from === to) continue;
    if (!to) out.push({ kind: "attributeRemoved", field: key, from, to: "" });
    else out.push({ kind: "attributeSet", field: key, from, to });
  }
  return out;
}

/** Diff a whole set at once, keyed by entity id. Ids in either map are considered. */
export function diffEntities(before: Map<string, EntitySnapshot>, after: Map<string, EntitySnapshot>): Array<{ entity: EntitySnapshot; changes: Change[] }> {
  const out: Array<{ entity: EntitySnapshot; changes: Change[] }> = [];
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const a = before.get(id) ?? null;
    const b = after.get(id) ?? null;
    const changes = diffEntity(a, b);
    // The name on the event is the one that survives: for a deletion, the one it had.
    if (changes.length) out.push({ entity: (b ?? a)!, changes });
  }
  return out;
}

const q = (v: string) => `“${v}”`;

/** Long values are the description; a timeline is a glance, not a diff view. */
function clip(v: string, max = 60) {
  const one = v.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * One change as a sentence fragment, with no subject.
 *
 * The subject is whoever is being rendered around it — "Maria Lund " + "renamed it to …" in a
 * workspace list, or just the fragment under a name in an entity's own timeline. Keeping the
 * subject out is what lets one string serve both.
 */
export function describeChange(c: Change): string {
  switch (c.kind) {
    case "created":
      return c.field ? `created it as ${c.field}` : "created it";
    case "renamed":
      return `renamed it from ${q(clip(c.from))} to ${q(clip(c.to))}`;
    case "retyped":
      if (!c.from) return `typed it as ${q(c.to)}`;
      return `changed its kind from ${q(c.from)} to ${q(c.to)}`;
    case "described":
      if (!c.from) return `wrote a description — ${q(clip(c.to, 80))}`;
      if (!c.to) return "removed the description";
      return `rewrote the description — ${q(clip(c.to, 80))}`;
    case "attributeSet":
      if (!c.from) return `set ${c.field} to ${q(clip(c.to))}`;
      return `changed ${c.field} from ${q(clip(c.from))} to ${q(clip(c.to))}`;
    case "attributeRemoved":
      return c.from ? `removed ${c.field} (was ${q(clip(c.from))})` : `removed ${c.field}`;
    case "relationAdded":
      return `linked ${q(clip(c.from))} —${c.field ? ` ${c.field} ` : " "}→ ${q(clip(c.to))}`;
    case "relationRemoved":
      return `unlinked ${q(clip(c.from))} —${c.field ? ` ${c.field} ` : " "}→ ${q(clip(c.to))}`;
    case "moved":
      if (!c.from) return `moved it inside ${q(clip(c.to))}`;
      if (!c.to) return `moved it to the top level, out of ${q(clip(c.from))}`;
      return `moved it from inside ${q(clip(c.from))} to inside ${q(clip(c.to))}`;
    case "absorbed":
      return `merged ${q(clip(c.from))} into it`;
    case "merged":
      return `merged it into ${q(clip(c.to))}`;
    case "deleted":
      return "deleted it";
  }
}

/** How to introduce whoever did it. */
export function describeActor(actor: Actor): string {
  if (actor.name.trim()) return actor.name.trim();
  switch (actor.kind) {
    case "person":
      return "Someone";
    case "agent":
      return "An agent";
    case "import":
      return "An import";
    case "board":
      return "A board";
    case "rules":
      return "The rules";
    case "system":
      return "Nexus";
  }
}

/**
 * A moment: one actor, one place, one burst of edits.
 *
 * Saving a card that changed three attributes writes three rows, and a timeline that prints them
 * as three entries with the same name and the same minute is a timeline that hides the shape of
 * what happened. Folding is presentation only — the rows stay separate, so a query can still ask
 * "when did criticality last change" and get an answer.
 */
export interface Moment {
  at: string;
  actor: Actor;
  context: string;
  events: GraphEvent[];
}

/** Edits closer together than this, by the same actor in the same place, are one moment. */
export const MOMENT_MS = 120_000;

/** Fold newest-first events into newest-first moments. */
export function foldMoments(events: GraphEvent[], windowMs = MOMENT_MS): Moment[] {
  const out: Moment[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    const sameHand =
      last &&
      last.actor.kind === e.actor.kind &&
      last.actor.id === e.actor.id &&
      last.actor.name === e.actor.name &&
      last.context === e.context;
    const gap = last ? Math.abs(Date.parse(last.at) - Date.parse(e.at)) : Infinity;
    if (sameHand && Number.isFinite(gap) && gap <= windowMs) {
      last.events.push(e);
      continue;
    }
    out.push({ at: e.at, actor: e.actor, context: e.context, events: [e] });
  }
  return out;
}

/** "2 minutes ago", "yesterday", "12 Feb". Same wording everywhere the history is shown. */
export function whenWords(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "at some point";
  const secs = Math.round((now - t) / 1000);
  if (secs < 0) return "just now";
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The day an event belongs to, for grouping a workspace-wide list. YYYY-MM-DD, local. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Two changes to the same field, close together, by the same hand — one change.
 *
 * Autosave is the reason this exists. A person renaming a card types eleven characters and the
 * board saves four times; without coalescing the history of that entity is four lines that all say
 * "renamed", and the one line that mattered — from what, to what — is buried. Worse, an edit that
 * was undone leaves two rows saying opposite things instead of the truth, which is that nothing
 * happened.
 *
 * So a later change is folded into the earlier row when it continues it: `A → B` then `B → C`
 * becomes `A → C`, and `A → B` then `B → A` becomes nothing at all. Only within the moment window,
 * and only by the same actor in the same place; anybody else's edit ends the run, because "Maria
 * changed it and then Jonas changed it back" is two facts, not zero.
 */
const CHAINABLE = new Set<EventKind>(["renamed", "retyped", "described", "attributeSet", "attributeRemoved"]);
const ATTRIBUTE = new Set<EventKind>(["attributeSet", "attributeRemoved"]);

export type Coalesced = { action: "insert" } | { action: "drop" } | { action: "extend"; kind: EventKind; from: string; to: string };

export function coalesce(prev: Change | null, next: Change): Coalesced {
  if (!prev) return { action: "insert" };
  if (!CHAINABLE.has(prev.kind) || !CHAINABLE.has(next.kind)) return { action: "insert" };
  if (prev.field !== next.field) return { action: "insert" };
  // Renaming and retyping both carry an empty field; only a shared kind — or two attribute
  // events, which are the same fact in two directions — may be chained.
  if (prev.kind !== next.kind && !(ATTRIBUTE.has(prev.kind) && ATTRIBUTE.has(next.kind))) return { action: "insert" };
  if (prev.to !== next.from) return { action: "insert" };
  if (prev.from === next.to) return { action: "drop" };
  return { action: "extend", kind: next.to ? next.kind : "attributeRemoved", from: prev.from, to: next.to };
}
