"use client";

import { useMemo } from "react";
import { boxToScreen, elementBounds } from "./geometry";
import { useCanvas } from "./store";
import { scopeOf } from "@/lib/agent/remarks";

/**
 * What the selected agent can actually read (§5.52).
 *
 * An agent's scope is a *place* — the board, the frame it was dragged into, the objects a line
 * joins it to. That is the good idea in §5.27, and it had one thing missing: nowhere did the board
 * say which objects the place resolved to. You wrote a purpose, chose "joined", and pressed Wake to
 * find out — spending a model call to answer a question the document could answer for free.
 *
 * So selecting an agent outlines everything it would read, in the agent's own colour. It is the
 * canvas answer to "what does my filter match": on a canvas the filter is a position, so the match
 * is a set of objects, and objects can simply be drawn on.
 *
 * Drawn from `scopeOf`, the same function the run uses, so this is not an approximation of what the
 * agent sees — it is what the agent sees, including the objects with no words on them that are
 * quietly left out.
 */
export function AgentScopeOverlay() {
  const elements = useCanvas((s) => s.elements);
  const camera = useCanvas((s) => s.camera);
  const selection = useCanvas((s) => s.selection);
  const agentId = selection.length === 1 ? selection[0] : undefined;

  const marks = useMemo(() => {
    const agent = agentId ? elements[agentId] : undefined;
    if (!agent || agent.type !== "agent") return null;
    const ids = scopeOf(agent, elements).items.map((i) => i.id);
    if (!ids.length) return null;
    return {
      color: agent.color,
      boxes: ids
        .map((id) => elements[id])
        .filter((el) => el !== undefined)
        .map((el) => elementBounds(el, elements))
        .filter((box) => box !== null),
    };
  }, [agentId, elements]);

  if (!marks) return null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9 }} data-agent-scope>
      {marks.boxes.map((box, i) => {
        const sb = boxToScreen(box, camera);
        return (
          <div
            key={i}
            className="agent-scope-mark"
            style={{ left: sb.x - 3, top: sb.y - 3, width: sb.w + 6, height: sb.h + 6, borderColor: marks.color }}
          />
        );
      })}
    </div>
  );
}
