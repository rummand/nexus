"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addComment, deleteComment, editComment, resolveThread, threadsForBoard } from "@/lib/comments/actions";
import { openByElement, openCount, type Thread } from "@/lib/comments/threads";

/**
 * The board's conversations, held once (§5.50).
 *
 * A badge on a card and the panel listing every thread are the same data seen twice, so they share
 * one loader rather than each fetching. Comments are rows, not part of the document, so they are
 * not on the canvas store and not carried by the live channel — they are refetched after anybody
 * here changes something, and when the tab comes back to the front, which is when somebody has
 * been away long enough for a colleague to have said something.
 */

interface CommentsValue {
  threads: Thread[];
  open: number;
  byElement: Record<string, number>;
  loading: boolean;
  refresh: () => Promise<void>;
  say: (input: { body: string; elementId?: string; anchorLabel?: string; parentId?: string | null }) => Promise<string | null>;
  edit: (commentId: string, body: string) => Promise<string | null>;
  remove: (commentId: string) => Promise<string | null>;
  settle: (threadId: string, resolved: boolean) => Promise<string | null>;
  /** Which thread the board is showing, so a badge and the panel agree about what is open. */
  focused: string | null;
  focus: (threadId: string | null) => void;
  /**
   * What a new comment would be about. Pressing Comment on a selected object sets it; the compose
   * box at the top of the panel reads it. Held here rather than in the panel because the button
   * that sets it lives on the other side of the canvas.
   */
  draft: { elementId: string; anchorLabel: string } | null;
  setDraft: (d: { elementId: string; anchorLabel: string } | null) => void;
  /** Who is reading. Only your own words carry an Edit and a Delete — see the actions. */
  me: string;
}

const Ctx = createContext<CommentsValue | null>(null);

const EMPTY: CommentsValue = {
  threads: [],
  open: 0,
  byElement: {},
  loading: false,
  refresh: async () => {},
  say: async () => null,
  edit: async () => null,
  remove: async () => null,
  settle: async () => null,
  focused: null,
  focus: () => {},
  draft: null,
  setDraft: () => {},
  me: "",
};

export function useComments(): CommentsValue {
  return useContext(Ctx) ?? EMPTY;
}

/** The error a call returned, or null. Every action here answers the same shape. */
const problem = (r: unknown) => (r && typeof r === "object" && "error" in r ? String((r as { error: unknown }).error) : null);

export function CommentsProvider({ boardId, me, children }: { boardId: string; me: string; children: React.ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ elementId: string; anchorLabel: string } | null>(null);

  const refresh = useCallback(async () => {
    const next = await threadsForBoard(boardId).catch(() => null);
    if (next) setThreads(next);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    // Written as a promise chain rather than `await refresh()`: nothing here may set state while the
    // effect body is still running, and the load is the same one the focus listener wants.
    const load = () => {
      threadsForBoard(boardId)
        .then((next) => { if (!cancelled) { setThreads(next); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    // Coming back to the tab is the moment somebody may have said something while you were away.
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.removeEventListener("focus", load); };
  }, [boardId]);

  const after = useCallback(
    async (call: Promise<unknown>) => {
      const r = await call;
      const err = problem(r);
      if (!err) await refresh();
      return err;
    },
    [refresh],
  );

  const value = useMemo<CommentsValue>(
    () => ({
      threads,
      open: openCount(threads),
      byElement: openByElement(threads),
      loading,
      refresh,
      say: (input) => after(addComment({ boardId, ...input })),
      edit: (commentId, body) => after(editComment(commentId, body)),
      remove: (commentId) => after(deleteComment(commentId)),
      settle: (threadId, resolved) => after(resolveThread(threadId, resolved)),
      focused,
      focus: setFocused,
      draft,
      setDraft,
      me,
    }),
    [threads, loading, refresh, after, boardId, focused, draft, me],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
