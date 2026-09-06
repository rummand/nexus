import Link from "next/link";
import { Bot, Check, Frame as FrameIcon, Globe, Link2, MessageSquare, X } from "lucide-react";
import { acceptance, verdict, type Fleet, type FleetAgent } from "@/lib/agent/fleet";
import type { DefinitionSummary } from "@/lib/agent/definitions";
import type { RunSummary } from "@/lib/agent/fleet-types";
import { DefinedAgents } from "./DefinedAgents";

/**
 * Every agent in the workspace, and whether it earns its place.
 *
 * The number this page leads with is not runs, tokens or remarks made. It is how often a person
 * kept what an agent said — because that is the only measure that says whether the thing is helping
 * a human think, which is the whole point of having it. An agent nobody keeps is not quiet and
 * cheap; it is noise with a running cost, and this page is where that becomes visible.
 */

const SCOPE: Record<FleetAgent["scope"], { label: string; icon: React.ReactNode }> = {
  board: { label: "the whole board", icon: <Globe size={11} /> },
  frame: { label: "the frame it sits in", icon: <FrameIcon size={11} /> },
  connected: { label: "what it is joined to", icon: <Link2 size={11} /> },
};

const when = (iso: string | null) => {
  if (!iso) return "never woken";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "read today" : days === 1 ? "read yesterday" : `read ${days} days ago`;
};

export function AgentFleet({ slug, workspaceId, fleet, model, graphAgent, defined, runs }: {
  slug: string;
  workspaceId: string;
  fleet: Fleet;
  model: { ready: boolean; hint: string };
  graphAgent: { lastAskedAt: string | null; grounded: string[] };
  defined: DefinitionSummary[];
  runs: RunSummary[];
}) {
  const answered = fleet.totals.kept + fleet.totals.dismissed;
  const overall = acceptance({ kept: fleet.totals.kept, dismissed: fleet.totals.dismissed });

  return (
    <section className="studio-home-main" aria-label="Agents">
      <header className="studio-home-topbar">
        <div>
          <span>Who else is working here</span>
          <h1>Agents</h1>
          <p className="roadmap-lede">
            Agents are scattered on purpose — one beside a frame, one on a board, one asked from a selection.
            This is the one place that says how many there are, what each is watching, and whether anybody is
            listening to them.
          </p>
        </div>
      </header>

      {!model.ready && (
        <p className="agent-fleet-warning" data-no-model>{model.hint || "No model is configured, so no agent here can be woken."}</p>
      )}

      <DefinedAgents slug={slug} workspaceId={workspaceId} agents={defined} runs={runs} />

      <div className="agent-fleet-note">
        <Bot size={14} />
        <p>
          What the described agents propose lands in the review queue on the{" "}
          <Link href={`/w/${slug}/graph#proposals`}>Knowledge graph</Link> page.
          {graphAgent.lastAskedAt ? " There is a run waiting there now." : " Nothing is waiting there."}
        </p>
      </div>

      <h2 className="fleet-section-title">On the boards</h2>
      <p className="defined-agents-lede">
        These are not described in words but by where they sit: put one beside the systems it should watch, or
        inside the frame that scopes it. They answer with remarks pinned to what they read, and change nothing
        by speaking.
      </p>

      <div className="roadmap-states" data-fleet-totals>
        <div className="roadmap-state">
          <small>On the boards</small>
          <b>{fleet.totals.agents}</b>
          <span>agent{fleet.totals.agents === 1 ? "" : "s"} · {fleet.totals.open} remark{fleet.totals.open === 1 ? "" : "s"} waiting</span>
        </div>
        <div className="roadmap-arrow" aria-hidden>
          <MessageSquare size={18} />
          <em>{answered} answered</em>
        </div>
        <div className="roadmap-state to-be">
          <small>Kept, of what people answered</small>
          <b className={overall === null ? "quiet" : ""}>{overall === null ? "—" : `${overall}%`}</b>
          <span>{verdict(overall, answered)}</span>
        </div>
      </div>



      {fleet.agents.length === 0 ? (
        <div className="roadmap-empty">
          <p>
            No agents on any board yet. Open a board, press <kbd>A</kbd>, and put one where the work is — beside
            the systems it should watch, or inside the frame that scopes it. Tell it what to look for in your own
            words; it answers with remarks pinned to the objects it read, and changes nothing by speaking.
          </p>
        </div>
      ) : (
        <ol className="agent-fleet" data-fleet>
          {fleet.agents.map((a) => {
            const rate = acceptance(a);
            const said = a.kept + a.dismissed;
            return (
              <li key={`${a.boardId}:${a.id}`} className="agent-fleet-row" data-agent-row={a.id}>
                <div className="agent-fleet-face"><Bot size={18} /></div>
                <div className="agent-fleet-body">
                  <div className="agent-fleet-head">
                    <strong>{a.name}</strong>
                    <Link href={`/b/${a.boardId}`}>{a.boardName}</Link>
                    <i className="agent-fleet-scope">{SCOPE[a.scope].icon} watches {SCOPE[a.scope].label}</i>
                    <span className="agent-fleet-when">{when(a.lastRunAt)}</span>
                  </div>
                  <p>{a.purpose || <em>Nobody has said what this one is for yet.</em>}</p>
                  <div className="agent-fleet-chips">
                    {a.open > 0 && <em className="open"><MessageSquare size={11} /> {a.open} waiting</em>}
                    {a.kept > 0 && <em className="kept"><Check size={11} /> {a.kept} kept</em>}
                    {a.dismissed > 0 && <em className="dismissed"><X size={11} /> {a.dismissed} dismissed</em>}
                    {said === 0 && a.open === 0 && <em className="muted">nothing said yet</em>}
                  </div>
                </div>
                <div className={`agent-fleet-score ${rate === null ? "unknown" : rate >= 60 ? "good" : rate >= 25 ? "mixed" : "poor"}`}>
                  <b>{rate === null ? "—" : `${rate}%`}</b>
                  <small>{verdict(rate, said)}</small>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {fleet.gone.length > 0 && (
        <section className="agent-fleet-gone">
          <h2>Agents you have deleted</h2>
          <p>Removing an agent does not erase how it did. Worth reading before writing the same one again.</p>
          <ul>
            {fleet.gone.map((g) => (
              <li key={g.agentElementId}>
                <strong>{g.name}</strong>
                <span>{g.kept} kept · {g.dismissed} dismissed</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
