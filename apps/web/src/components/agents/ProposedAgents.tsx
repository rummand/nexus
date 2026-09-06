"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Eye, Sparkles, X } from "lucide-react";
import { approveAgent, removeAgent, suggestAgents } from "@/lib/agent/definition-actions";
import { describeScope } from "@/lib/agent/definition";
import type { DefinitionSummary } from "@/lib/agent/definitions";

/**
 * Agents an agent wrote.
 *
 * The whole of "agents building agents" comes down to what this component does: it shows what was
 * suggested, who suggested it, why, and what it would be allowed to do — and then waits. A proposed
 * agent cannot run, not even a dry run, until somebody presses Approve, at which point it becomes
 * an ordinary draft and still has to earn a voice.
 *
 * It is deliberately not a modal or a notification. This is a decision about who works here, and it
 * belongs on the page that lists everyone who does.
 */
export function ProposedAgents({ slug, workspaceId, proposed }: {
  slug: string;
  workspaceId: string;
  proposed: DefinitionSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);

  const ask = () => {
    setMessage(null);
    setDropped([]);
    start(async () => {
      const result = await suggestAgents(workspaceId);
      if ("error" in result) setMessage(result.error);
      else {
        setMessage(
          result.suggested === 0
            ? result.note || "It could not see an agent worth adding. That is a good answer."
            : `${result.suggested} suggested. Nothing runs until you approve it.`,
        );
        setDropped(result.rejected);
      }
      router.refresh();
    });
  };

  return (
    <section className="proposed-agents" aria-label="Suggested agents">
      <div className="proposed-head">
        <button type="button" className="ghost-button" disabled={pending} onClick={ask} data-suggest-agents>
          <Sparkles size={13} /> {pending ? "Thinking…" : "Ask what is missing"}
        </button>
        <small>
          The workspace&apos;s own reviewer looks at the model and the fleet and suggests an agent nobody has written.
          It may not give one a verb or a budget it does not have itself.
        </small>
      </div>

      {message && <p className="model-env" data-suggest-message>{message}</p>}
      {dropped.length > 0 && (
        <details className="agent-run-dropped" data-suggest-dropped>
          <summary>{dropped.length} suggestion{dropped.length === 1 ? "" : "s"} refused</summary>
          <ul>{dropped.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </details>
      )}

      {proposed.length > 0 && (
        <ol className="agent-fleet proposed-list" data-proposed>
          {proposed.map((a) => (
            <li key={a.id} className="agent-fleet-row proposed" data-proposed-agent={a.id}>
              <div className="agent-fleet-face proposed"><Sparkles size={17} /></div>
              <div className="agent-fleet-body">
                <div className="agent-fleet-head">
                  <strong><Link href={`/w/${slug}/agents/${a.id}`}>{a.name}</Link></strong>
                  <i className="model-status warn">proposed</i>
                  <i className="agent-fleet-scope"><Eye size={11} /> {describeScope(a.scope)}</i>
                  {a.parentName && <span className="agent-fleet-when">suggested by {a.parentName}</span>}
                </div>
                <p>{a.purpose}</p>
                <div className="agent-fleet-chips">
                  <em>{a.ownerTeamName || "no owner"}</em>
                  {a.verbs.map((v) => <em key={v}>{v}</em>)}
                  <em className="muted">{a.budget.runsPerDay}/day · {a.budget.maxProposals} a run</em>
                </div>
              </div>
              <div className="proposed-actions">
                <button type="button" className="primary-home-button" disabled={pending} data-approve={a.id} onClick={() => start(async () => { await approveAgent(a.id); router.refresh(); })}>
                  <Check size={13} /> Approve
                </button>
                <button type="button" className="ghost-button" disabled={pending} onClick={() => start(async () => { await removeAgent(a.id); router.refresh(); })}>
                  <X size={13} /> No
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
