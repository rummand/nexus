"use client";

import type { DropGhost } from "./entityCard";

/**
 * What you are about to drop, drawn where it will land (§5.44).
 *
 * The old affordance was a dashed border round the whole window — loud, and an answer to the wrong
 * question. Somebody dragging a system out of the inventory is not asking *may I drop here*, they
 * are asking *where will it go and how big is it*. So the preview is the cards themselves, in
 * world space, at the size and colour they will have: drag over a gap and you can see whether it
 * fits before you let go.
 *
 * It lives inside the world layer, so the camera transform scales it exactly as it scales the real
 * cards, and it is moved by writing a transform to this node rather than through React — a
 * `dragover` fires many times a second and a re-render per event is a stuttering ghost.
 */
export function DropPreview({ ghosts, nodeRef }: { ghosts: DropGhost[]; nodeRef: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={nodeRef} className="drop-preview" data-drop-preview aria-hidden style={{ display: "none" }}>
      {ghosts.map((g) => (
        <div key={g.key} className="drop-ghost" style={{ left: g.x, top: g.y, width: g.w, height: g.h, ["--card-color" as string]: g.color }}>
          <span className="drop-ghost-kind"><i />{g.kind || "Untyped"}</span>
          <strong>{g.title || "(unnamed)"}</strong>
        </div>
      ))}
      {ghosts.length > 1 && (
        // Above the whole block rather than above the pointer, which for a grid is inside it.
        <span className="drop-ghost-count" style={{ top: Math.min(...ghosts.map((g) => g.y)) - 12 }}>
          {ghosts.length} objects
        </span>
      )}
    </div>
  );
}
