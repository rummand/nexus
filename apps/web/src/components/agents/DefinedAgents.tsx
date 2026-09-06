import Link from "next/link";
import { Bot, Coins, Eye, Plus, ScrollText } from "lucide-react";
import { acceptance, verdict } from "@/lib/agent/fleet";
import { describeScope, type AgentStatus } from "@/lib/agent/definition";
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
