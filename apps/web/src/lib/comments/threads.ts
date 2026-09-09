/**
 * Conversations, as pure functions (§5.50).
 *
 * A comment is a row; a *thread* is a shape a person recognises — one thing somebody said and the
 * replies to it, settled or not. Folding rows into that shape is arithmetic, so it lives here where
 * the awkward cases can be written down as tests rather than discovered on a board: a reply whose
 * parent was deleted, a thread pinned to a card that no longer exists, two comments a millisecond
 * apart, an anchor that has been renamed since.
 */

export interface Comment {
  id: string;
  boardId: string;
  elementId: string;
  anchorLabel: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  body: string;
  resolvedAt: string | null;
  resolvedByName: string;
  editedAt: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  /** "" for a comment about the board as a whole. */
  elementId: string;
  anchorLabel: string;
  opening: Comment;
  replies: Comment[];
  resolved: boolean;
  /** When anybody last said anything in it — what a list should be sorted by. */
  lastAt: string;
  /** Everybody who has spoken, in the order they first did. */
  voices: string[];
}

const byTime = (a: Comment, b: Comment) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/**
 * Fold rows into threads, newest conversation first.
 *
 * A reply whose parent is missing — deleted, or from a board this list did not include — is
 * promoted to a thread of its own rather than dropped. Losing what somebody said because of a
 * bookkeeping detail is the one outcome a comment system may not have.
 */
export function threadsOf(rows: Comment[]): Thread[] {
  const openings = new Map<string, Comment>();
  const replies = new Map<string, Comment[]>();
  const ids = new Set(rows.map((r) => r.id));

  for (const row of rows) {
    if (row.parentId && ids.has(row.parentId)) {
      replies.set(row.parentId, [...(replies.get(row.parentId) ?? []), row]);
    } else {
      openings.set(row.id, row);
    }
  }

  const threads: Thread[] = [...openings.values()].map((opening) => {
    const kids = (replies.get(opening.id) ?? []).sort(byTime);
    const voices: string[] = [];
    for (const c of [opening, ...kids]) if (c.authorName && !voices.includes(c.authorName)) voices.push(c.authorName);
    return {
      id: opening.id,
      elementId: opening.elementId,
      anchorLabel: opening.anchorLabel,
      opening,
      replies: kids,
      resolved: Boolean(opening.resolvedAt),
      lastAt: kids.length ? kids[kids.length - 1]!.createdAt : opening.createdAt,
      voices,
    };
  });

  /*
   * Open threads first, then by when anybody last spoke. A resolved conversation is not deleted —
   * the reasoning is usually the point — but it has stopped asking anybody for anything, so it
   * stops competing for the top of the list.
   */
  return threads.sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.lastAt.localeCompare(a.lastAt));
}

/** How many unresolved conversations are pinned to each element, for the badges on the canvas. */
export function openByElement(threads: Thread[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of threads) {
    if (t.resolved || !t.elementId) continue;
    out[t.elementId] = (out[t.elementId] ?? 0) + 1;
  }
  return out;
}

/** The one number a board's topbar shows. */
export function openCount(threads: Thread[]): number {
  return threads.filter((t) => !t.resolved).length;
}

/**
 * What a thread is about, in a few words.
 *
 * A thread pinned to something that has since been deleted says so, because "this conversation is
 * about a card that is gone" is a fact somebody reading it needs — and the alternative, hiding it,
 * throws away the reasoning at exactly the moment it became history.
 */
export function anchorOf(thread: Thread, present: (elementId: string) => boolean): string {
  if (!thread.elementId) return "This board";
  if (present(thread.elementId)) return thread.anchorLabel || "An object";
  return `${thread.anchorLabel || "An object"} (deleted)`;
}

/** A body that is only whitespace is not a comment. Trimmed, and capped so a paste cannot be a book. */
export const MAX_BODY = 4000;

export function cleanBody(input: string): string {
  return input.replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY);
}
