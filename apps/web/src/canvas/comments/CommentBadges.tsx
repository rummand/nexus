"use client";

import { MessageSquare } from "lucide-react";
import { elementBounds, boxToScreen } from "../geometry";
import { useCanvas, useCanvasStore } from "../store";
import { useComments } from "./CommentsContext";

/**
 * A pin on every object somebody is still talking about (§5.50).
 *
 * Screen space, in one overlay, rather than a badge rendered inside each object: the world layer is
 * scaled, so a pin drawn inside a card is unreadable at 30% zoom and enormous at 300%, and there
 * are seven element renderers that would each need the same thing. One layer above the board, at a
 * constant size, is the same trick the selection outlines use.
 *
 * Only unresolved threads get a pin. A settled conversation is still in the panel — the reasoning
 * is the point — but it has stopped asking the board for anything.
 */
export function CommentBadges() {
  const store = useCanvasStore();
  const { byElement, threads, focus } = useComments();
  const elements = useCanvas((s) => s.elements);
  const camera = useCanvas((s) => s.camera);

  const ids = Object.keys(byElement);
  if (ids.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 11 }} data-comment-badges>
      {ids.map((id) => {
        const el = elements[id];
        if (!el) return null; // a thread about a deleted object lives in the panel, not on the board
        const b = elementBounds(el, elements);
        if (!b) return null;
        const sb = boxToScreen(b, camera);
        const count = byElement[id] ?? 0;
        return (
          <button
            key={id}
            type="button"
            className="comment-pin pointer-events-auto"
            style={{ left: sb.x + sb.w - 10, top: sb.y - 10 }}
            title={`${count} open conversation${count === 1 ? "" : "s"} about this`}
            aria-label={`${count} open conversation${count === 1 ? "" : "s"} about this object`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              const first = threads.find((t) => t.elementId === id && !t.resolved);
              store.getState().togglePanel("comments", true);
              focus(first ? first.id : null);
            }}
          >
            <MessageSquare size={11} />
            {count}
          </button>
        );
      })}
    </div>
  );
}
