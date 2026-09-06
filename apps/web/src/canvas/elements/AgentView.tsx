"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { nanoid } from "nanoid";
import { Bot, Frame as FrameIcon, Globe, Link2, Play, Trash2 } from "lucide-react";
import type { AgentElement } from "../document";
import { useCanvas, useCanvasStore } from "../store";
import { LiveField } from "./LiveField";
import { scopeOf } from "@/lib/agent/remarks";
import { recordRemarkOutcome, wakeBoardAgent } from "@/lib/agent/board-actions";

/**
 * An agent, drawn on the board.
 *
 * It is an object like any other: you drag it, you put it in a frame, you join it to things, you
 * delete it. What makes it an agent is that it can be woken, and that what it says appears on the
 * objects it is talking about rather than in a panel somewhere else.
 *
 * The purpose field is the whole interface. An architect writes what they want watched, in their
 * own words, and that becomes the agent's instruction — which is why two agents on the same board
 * are genuinely two different agents rather than two copies of one feature.
 */

const SCOPES: Array<{ value: AgentElement["scope"]; label: string; icon: React.ReactNode; hint: string }> = [
  { value: "board", label: "board", icon: <Globe size={11} />, hint: "Watches everything drawn here." },
  { value: "frame", label: "frame", icon: <FrameIcon size={11} />, hint: "Watches whatever frame you drop it into." },
  { value: "connected", label: "joined", icon: <Link2 size={11} />, hint: "Watches only the objects you connect it to." },
];

export function AgentView({ el, selected, fresh }: { el: AgentElement; selected: boolean; fresh: boolean }) {
  const store = useCanvasStore();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const patch = (p: Partial<AgentElement>) => store.getState().updateElements({ [el.id]: p as never });
  const remarks = el.remarks?.length ?? 0;

  const wake = () => {
    setError(null);
    patch({ thinking: true });
    start(async () => {
      const state = store.getState();
      const result = await wakeBoardAgent({
        workspaceId: state.workspaceId,
        purpose: el.purpose,
        scope: scopeOf(el, state.elements),
      });
      if ("error" in result) {
        patch({ thinking: false });
        setError(result.error);
        return;
      }
      patch({
        thinking: false,
        remarks: result.remarks,
        note: result.note || (result.remarks.length ? "" : "Nothing worth saying about this."),
        lastRunAt: new Date().toISOString(),
      });
    });
  };

  const cls = ["board-object", "board-agent", selected ? "selected" : "", el.thinking ? "thinking" : "", remarks ? "spoke" : ""].filter(Boolean).join(" ");
  return (
    <div data-element-id={el.id} data-agent className={cls} style={{ left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z, "--agent-color": el.color } as CSSProperties}>
      <header className="board-agent-head">
        <span className="board-agent-face" aria-hidden><Bot size={15} /></span>
        <LiveField active={selected} value={el.name} placeholder="Name this agent" ariaLabel="Agent name" autoFocus={fresh} onChange={(name) => patch({ name })} />
        {remarks > 0 && <i className="board-agent-count" title={`${remarks} remark${remarks === 1 ? "" : "s"} on this board`}>{remarks}</i>}
      </header>

      <LiveField
        active={selected}
        multiline
        className="board-agent-purpose"
        value={el.purpose}
        placeholder="What should it watch for? e.g. “tell me where this landscape contradicts itself”"
        ariaLabel="What this agent is for"
        onChange={(purpose) => patch({ purpose })}
      />

      <footer className="board-agent-foot" onPointerDown={(e) => e.stopPropagation()}>
        <div className="board-agent-scope" role="group" aria-label="What this agent can see">
          {SCOPES.map((s) => (
            <button key={s.value} type="button" title={s.hint} className={el.scope === s.value ? "on" : ""} onClick={() => patch({ scope: s.value })}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="board-agent-wake" disabled={pending || el.thinking} onClick={wake} data-wake-agent>
          <Play size={12} /> {el.thinking || pending ? "Reading…" : remarks ? "Look again" : "Wake"}
        </button>
        {remarks > 0 && (
          <button type="button" className="board-agent-clear" title="Take back everything it said" onClick={() => patch({ remarks: [], note: "" })}>
            <Trash2 size={12} />
          </button>
        )}
      </footer>

      {(error || el.note) && (
        <p className={error ? "board-agent-said error" : "board-agent-said"} title={error ?? el.note}>{error ?? el.note}</p>
      )}
    </div>
  );
}

/**
 * A mark on an object an agent has said something about.
 *
 * This is the part that makes agents feel present rather than filed away: you see, on the card
 * itself, that somebody has a remark about it, and you read it there. Dismissing it removes the
 * remark; turning it into a note makes it yours, which is the only way an agent's words ever
 * become part of the board.
 */
export function RemarkBadge({ id }: { id: string }) {
  const store = useCanvasStore();
  const count = useCanvas((s) => {
    let n = 0;
    for (const el of Object.values(s.elements)) if (el.type === "agent") for (const r of el.remarks ?? []) if (r.about === id) n++;
    return n;
  });
  /**
   * Open state carries the place to draw the bubble, measured at the moment of the click.
   *
   * Drawn at the top of the page rather than inside the object: inside the card it lived in the
   * canvas's transformed world, underneath the selection toolbar that appears over whatever you
   * have just clicked — so the remark you wanted to read was covered by the buttons for the thing
   * it was about. A portal puts it above everything, in screen coordinates, where a popover belongs.
   */
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  const found = () => {
    const out: Array<{ agentId: string; agentName: string; id: string; text: string; quote: string }> = [];
    for (const el of Object.values(store.getState().elements)) {
      if (el.type !== "agent") continue;
      for (const r of el.remarks ?? []) if (r.about === id) out.push({ agentId: el.id, agentName: el.name || "Agent", ...r });
    }
    return out;
  };

  /**
   * Answering a remark removes it from the board and leaves a trace behind, so the fleet can say
   * later whether this agent was worth having (§5.28).
   */
  const answer = (agentId: string, remarkId: string, outcome: "kept" | "dismissed") => {
    const s = store.getState();
    const agent = s.elements[agentId];
    if (!agent || agent.type !== "agent") return;
    s.updateElements({ [agentId]: { remarks: (agent.remarks ?? []).filter((r) => r.id !== remarkId) } as never });
    void recordRemarkOutcome({
      workspaceId: s.workspaceId,
      boardId: s.boardId,
      agentElementId: agentId,
      agentName: agent.name || "Unnamed agent",
      outcome,
    }).catch(() => undefined);
  };

  /**
   * The bubble is drawn at the top of the page rather than inside the object.
   *
   * Inside the card it lived in the canvas's transformed world, underneath the selection toolbar
   * that appears over whatever you have just clicked — so the remark you wanted to read was
   * covered by the buttons for the thing it was about. A portal puts it above everything and lets
   * it be positioned in screen coordinates, where a popover belongs.
   */
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (at) { setAt(null); return; }
    const box = e.currentTarget.getBoundingClientRect();
    setAt({
      x: Math.min(box.right + 10, window.innerWidth - 316),
      y: Math.min(box.top, window.innerHeight - 240),
    });
  };

  if (count === 0) return null;

  const keep = (text: string, remark: { agentId: string; id: string }) => {
    const about = store.getState().elements[id];
    if (!about || about.type === "connector") return;
    store.getState().addElements([{
      id: nanoid(10),
      type: "sticky",
      x: about.x + about.w + 24,
      y: about.y,
      w: 260, h: 140,
      title: "",
      text,
      color: "#fde68a",
      z: about.z + 1,
    }], { history: true });
    answer(remark.agentId, remark.id, "kept");
    setAt(null);
  };

  return (
    <>
      <button
        type="button"
        className="fact-remark-badge"
        data-remark-badge
        title={`${count} remark${count === 1 ? "" : "s"} from an agent`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
      >
        <Bot size={11} /> {count}
      </button>
      {at && createPortal(
        <div className="remark-bubble" style={{ left: at.x, top: at.y }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          {found().map((r) => (
            <article key={r.id}>
              <header><Bot size={12} /> {r.agentName}</header>
              <p>{r.text}</p>
              <blockquote>“{r.quote}”</blockquote>
              <div>
                <button type="button" onClick={() => keep(r.text, r)}>Keep as a note</button>
                <button type="button" className="ghost" onClick={() => answer(r.agentId, r.id, "dismissed")}>Dismiss</button>
              </div>
            </article>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
