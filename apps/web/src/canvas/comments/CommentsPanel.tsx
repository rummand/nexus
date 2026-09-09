"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import { useCanvas, useCanvasStore } from "../store";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { anchorOf, type Thread } from "@/lib/comments/threads";
import { useComments } from "./CommentsContext";

/**
 * Every conversation on this board (§5.50).
 *
 * The panel exists because pins do not scale: a board with nine threads on it, three of them about
 * cards somebody has since deleted, cannot be read by hunting for badges. Open first, settled
 * below, and a thread about a deleted object still listed — that is the moment its reasoning
 * becomes history rather than noise.
 */
export function CommentsPanel({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
  const store = useCanvasStore();
  const { threads, settle, focused, focus } = useComments();
  // Right-hand side, beside the inspector rather than on top of the graph panel: a conversation
  // about the selected object belongs next to the selected object's fields.
  const { pos, onPointerDown, panelRef } = useDraggablePanel(rootRef, { right: 260, y: 76 });
  const [showResolved, setShowResolved] = useState(false);
  // Selecting the map, not a closure over it: a selector returning a fresh function every render
  // is a new snapshot every render, which useSyncExternalStore treats as an endless change.
  const elements = useCanvas((s) => s.elements);
  const present = useCallback((id: string) => Boolean(elements[id]), [elements]);

  const shown = useMemo(() => threads.filter((t) => showResolved || !t.resolved), [threads, showResolved]);
  const settled = threads.filter((t) => t.resolved).length;

  /* Clicking a pin on the board opens this panel and names a thread; with nine of them in the list
     that is only useful if the list moves to it. */
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!focused) return;
    listRef.current?.querySelector(`[data-thread="${CSS.escape(focused)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <section
      ref={(el) => { panelRef.current = el; }}
      className="floating-panel comments-panel"
      aria-label="Comments"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 76 }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      data-comments-panel
    >
      <div className="panel-title" onPointerDown={onPointerDown} title="Drag to move">
        <MessageSquare size={18} />
        Comments
        <div className="panel-title-actions">
          <button type="button" onClick={() => store.getState().togglePanel("comments", false)}>Hide</button>
        </div>
      </div>

      <NewThread />

      {shown.length === 0 && (
        <p className="muted comments-empty">
          {threads.length === 0
            ? "Nothing said yet. Select an object and press Comment, or write about the board above."
            : "Everything here is settled."}
        </p>
      )}

      <ol className="comments-list" ref={listRef}>
        {shown.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            anchor={anchorOf(thread, present)}
            open={focused === thread.id}
            onOpen={() => focus(focused === thread.id ? null : thread.id)}
            onFocusElement={() => { if (thread.elementId && present(thread.elementId)) store.getState().focusElement(thread.elementId); }}
            onSettle={(resolved) => void settle(thread.id, resolved)}
          />
        ))}
      </ol>

      {settled > 0 && (
        <button type="button" className="comments-toggle" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? "Hide" : "Show"} {settled} settled
        </button>
      )}
    </section>
  );
}

/**
 * A new conversation — about the board, or about the object you pressed Comment on.
 *
 * One compose box rather than two, because "what is this about" is a property of the comment you
 * are writing, not of a second place to write it. The chip says which, and can be taken off.
 */
function NewThread() {
  const { say, draft, setDraft } = useComments();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="comment-compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const err = await say(draft ? { body, elementId: draft.elementId, anchorLabel: draft.anchorLabel } : { body });
          setError(err);
          if (!err) { setBody(""); setDraft(null); }
        });
      }}
    >
      {draft && (
        <button type="button" className="comment-about" onClick={() => setDraft(null)} title="Comment about the board instead">
          About {draft.anchorLabel || "an object"} <X size={11} />
        </button>
      )}
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={draft ? `Say something about ${draft.anchorLabel || "this object"}` : "Say something about this board"}
        aria-label={draft ? "A comment about the selected object" : "A comment about this board"}
        onKeyDown={(e) => e.stopPropagation()}
        data-comment-input
      />
      <button type="submit" className="ghost-button" disabled={pending || !body.trim()}>Post</button>
      {error && <small className="form-error">{error}</small>}
    </form>
  );
}

function ThreadCard({ thread, anchor, open, onOpen, onFocusElement, onSettle }: {
  thread: Thread;
  anchor: string;
  open: boolean;
  onOpen: () => void;
  onFocusElement: () => void;
  onSettle: (resolved: boolean) => void;
}) {
  return (
    <li className={thread.resolved ? "comment-thread resolved" : "comment-thread"} data-thread={thread.id}>
      <header>
        <button type="button" className="comment-anchor" onClick={onFocusElement} title={thread.elementId ? "Find it on the board" : undefined}>
          {anchor}
        </button>
        <button
          type="button"
          className="comment-settle"
          title={thread.resolved ? "Reopen this" : "Mark it settled"}
          aria-label={thread.resolved ? "Reopen this conversation" : "Mark this conversation settled"}
          onClick={() => onSettle(!thread.resolved)}
        >
          {thread.resolved ? <RotateCcw size={13} /> : <Check size={13} />}
        </button>
      </header>

      <CommentBody comment={thread.opening} />

      {open ? (
        <>
          {thread.replies.map((r) => <CommentBody key={r.id} comment={r} reply />)}
          <Reply threadId={thread.id} />
        </>
      ) : (
        thread.replies.length > 0 && (
          <button type="button" className="comment-more" onClick={onOpen}>
            {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"} · {thread.voices.join(", ")}
          </button>
        )
      )}
      {!open && thread.replies.length === 0 && (
        <button type="button" className="comment-more" onClick={onOpen}>Reply</button>
      )}
      {thread.resolved && <small className="comment-settled-by">Settled by {thread.opening.resolvedByName || "somebody"}</small>}
    </li>
  );
}

function CommentBody({ comment, reply }: { comment: Thread["opening"]; reply?: boolean }) {
  const { remove, edit, me } = useComments();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Your own words only. The actions enforce it; showing the controls to everybody would just be
  // offering a refusal.
  const mine = Boolean(me) && comment.authorId === me;

  return (
    <div className={reply ? "comment-body reply" : "comment-body"}>
      <b>{comment.authorName || "Somebody"}</b>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const err = await edit(comment.id, draft);
              setError(err);
              if (!err) setEditing(false);
            });
          }}
        >
          <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.stopPropagation()} aria-label="Edit your comment" />
          <button type="submit" className="ghost-button" disabled={pending}>Save</button>
          <button type="button" className="ghost-button" onClick={() => { setDraft(comment.body); setEditing(false); }}>Cancel</button>
        </form>
      ) : (
        <p>{comment.body}</p>
      )}
      <footer>
        <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>
          {new Date(comment.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </time>
        {comment.editedAt && <em>edited</em>}
        {mine && <button type="button" onClick={() => setEditing((v) => !v)} className="comment-edit">Edit</button>}
        {mine && (
          <button
            type="button"
            onClick={() => { if (confirm("Delete this comment? Replies to it stay.")) start(async () => setError(await remove(comment.id))); }}
            aria-label="Delete this comment"
          >
            <Trash2 size={12} />
          </button>
        )}
      </footer>
      {error && <small className="form-error">{error}</small>}
    </div>
  );
}

function Reply({ threadId }: { threadId: string }) {
  const { say } = useComments();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="comment-reply"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const err = await say({ body, parentId: threadId });
          if (!err) setBody("");
        });
      }}
    >
      <textarea rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply" aria-label="Reply" onKeyDown={(e) => e.stopPropagation()} data-comment-reply />
      <button type="submit" className="ghost-button" disabled={pending || !body.trim()}>Send</button>
    </form>
  );
}
