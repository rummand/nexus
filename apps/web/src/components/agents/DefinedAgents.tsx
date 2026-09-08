import Link from "next/link";
import { Bot, Clock3, Coins, Eye, Plus, ScrollText } from "lucide-react";
import { acceptance, verdict } from "@/lib/agent/fleet";
import { describeScope, TRIGGER_LABEL, type AgentStatus, type Trigger } from "@/lib/agent/definition";
import { nextDue } from "@/lib/agent/schedule";
import type { DefinitionSummary } from "@/lib/agent/definitions";
import type { RunSummary } from "@/lib/agent/fleet-types";
import { ProposedAgents } from "./ProposedAgents";

/**
 * The agents somebody has written down.
 *
 * Board agents (§5.27) are placed where the work is and are described by where they sit. These are
 * described in words instead: a purpose, an owner, a scope, verbs and a budget. They are listed
 * above the board agents because they are the ones that can be governed — and because "what is
 * running against our model" is the first question anybody asks about a fleet.
 */

const STATUS_CLASS: Record<AgentStatus, string> = { proposed: "warn", draft: "unknown", active: "ok", paused: "warn", retired: "off" };

const when = (iso: string | null) => {
  if (!iso) return "never run";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "ran today" : days === 1 ? "ran yesterday" : `ran ${days} days ago`;
};

/**
 * The same idea pointing forwards. `when` phrases the past, and "next ran today" is nonsense.
 *
 * The clock lives in here rather than in the JSX: calling `Date.now()` during render is impure,
 * the React Compiler says so, and it is right — a row that renders differently on every pass is a
 * row that cannot be memoised.
 */
const soon = (agent: { trigger: Trigger; status: string; lastRunAt: string | null }) => {
  const iso = nextDue({ id: "", workspaceId: "", name: "", ...agent }, Date.now());
  if (!iso) return "not scheduled";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 60_000) return "due now";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
};

export function DefinedAgents({ slug, workspaceId, agents, runs }: {
  slug: string;
  workspaceId: string;
  agents: DefinitionSummary[];
  runs: RunSummary[];
}) {
  // An agent nobody has approved is not part of the fleet yet, and listing it as though it were
  // would overstate what is running here.
  const written = agents.filter((a) => a.status !== "proposed");
  const proposed = agents.filter((a) => a.status === "proposed");
  return (
    <section className="defined-agents" aria-label="Described agents">
      <header className="defined-agents-head">
        <h2><ScrollText size={15} /> Described agents</h2>
        <Link className="primary-home-button" href={`/w/${slug}/agents/new`} data-new-agent><Plus size={13} /> Describe an agent</Link>
      </header>
      <p className="defined-agents-lede">
        An agent written down: what it is for, who owns it, what it may read, what it may propose and what it may
        spend. It starts as a draft — it runs, and you read what it would have said before it is allowed to say it.
      </p>

      <ProposedAgents slug={slug} workspaceId={workspaceId} proposed={proposed} />

      {written.length === 0 ? (
        <div className="roadmap-empty">
          <p>
            None yet. The <strong>Model reviewer</strong> appears here the first time somebody asks the agent to
            look at the graph; after that you can narrow it, or write one of your own for a corner of the estate
            that needs watching.
          </p>
        </div>
      ) : (
        <ol className="agent-fleet" data-defined>
          {written.map((a) => {
            const rate = acceptance({ kept: a.accepted, dismissed: a.dismissed });
            const answered = a.accepted + a.dismissed;
            return (
              <li key={a.id} className="agent-fleet-row" data-defined-agent={a.id}>
                <div className="agent-fleet-face"><Bot size={18} /></div>
                <div className="agent-fleet-body">
                  <div className="agent-fleet-head">
                    <strong><Link href={`/w/${slug}/agents/${a.id}`}>{a.name}</Link></strong>
                    <i className={`model-status ${STATUS_CLASS[a.status]}`}>{a.status}</i>
                    <i className="agent-fleet-scope"><Eye size={11} /> {describeScope(a.scope)}</i>
                    <span className="agent-fleet-when">{when(a.lastRunAt)}</span>
                  </div>
                  <p>{a.purpose || <em>Nobody has said what this one is for yet.</em>}</p>
                  <div className="agent-fleet-chips">
                    <em>{a.ownerTeamName || "no owner"}</em>
                    {a.verbs.map((v) => <em key={v} className={v === "merge" ? "dismissed" : ""}>{v}</em>)}
                    <em className="muted"><Coins size={11} /> {a.budget.runsPerDay}/day · {a.budget.maxProposals} a run</em>
                    {/*
                      A schedule is the difference between an agent you remember to run and one
                      that works while you are away (§5.42), so it says so on the row — and says
                      when it goes next, because "daily" alone never answers the question people
                      actually have.
                    */}
                    {a.trigger !== "manual" && (
                      <em className="scheduled" data-schedule={a.trigger}>
                        <Clock3 size={11} /> {TRIGGER_LABEL[a.trigger].toLowerCase()}
                        {a.status === "active" ? <> · {soon(a)}</> : " · not while it is not active"}
                      </em>
                    )}
                    {a.open > 0 && <em className="open">{a.open} waiting</em>}
                  </div>
                </div>
                <div className={`agent-fleet-score ${rate === null ? "unknown" : rate >= 60 ? "good" : rate >= 25 ? "mixed" : "poor"}`}>
                  <b>{rate === null ? "—" : `${rate}%`}</b>
                  <small>{verdict(rate, answered)}</small>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {runs.length > 0 && (
        <section className="agent-activity" aria-label="Recent runs">
          <h3>What has run</h3>
          <ul data-activity>
            {runs.map((r) => (
              <li key={r.id}>
                <b>{r.agentName || "an agent"}</b>
                <i className={`model-status ${r.outcome === "ok" ? "ok" : r.outcome === "refused" ? "unknown" : "bad"}`}>
                  {r.dryRun && r.outcome === "ok" ? "dry run" : r.outcome}
                </i>
                <span>
                  {r.outcome === "ok"
                    ? `${r.proposed} proposal${r.proposed === 1 ? "" : "s"} from ${r.objectsRead} object${r.objectsRead === 1 ? "" : "s"}${r.rejected ? `, ${r.rejected} thrown away in checking` : ""}`
                    : r.error || r.note}
                </span>
                <time>{new Date(r.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
