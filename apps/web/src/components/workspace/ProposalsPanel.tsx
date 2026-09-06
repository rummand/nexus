"use client";

import { useState, useTransition } from "react";
import { BookOpen, Bot, Check, Columns3, GitMerge, Link2, ListPlus, SpellCheck, Sparkles, Tag, Trash2, Type, Unlink, X } from "lucide-react";
import type { Proposal } from "@/lib/graph-types";
import { acceptProposal, acceptProposals, dismissProposal } from "@/lib/actions";
import { askTheAgent, forgetAgentRun } from "@/lib/agent/actions";

const ICONS: Record<Proposal["type"], React.ReactNode> = {
  merge: <GitMerge size={16} />,
  kind: <Tag size={16} />,
  untyped: <Type size={16} />,
  relation: <Unlink size={16} />,
  newRelation: <Link2 size={16} />,
  orphan: <Trash2 size={16} />,
  attributeKey: <Columns3 size={16} />,
  attributeValue: <SpellCheck size={16} />,
  attributeMissing: <ListPlus size={16} />,
};

const ACCEPT_LABEL: Record<Proposal["type"], string> = {
  merge: "Merge",
  kind: "Rename",
  untyped: "Set kind",
  relation: "Label",
  newRelation: "Connect",
  orphan: "Delete",
  attributeKey: "Rename key",
  attributeValue: "Normalise",
  attributeMissing: "Set value",
};

/** Whether the model can be asked, and what it said last time. Resolved on the server. */
export interface AgentState {
  ready: boolean;
  /** Why it cannot be asked, in words somebody can act on. */
  hint: string;
  lastAskedAt: string | null;
  grounded: string[];
}

/** Agent proposals: rule-derived and model-derived suggestions, with accept / dismiss. */
export function ProposalsPanel({ workspaceId, proposals, agent }: { workspaceId: string; proposals: Proposal[]; agent: AgentState }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const fromAgent = proposals.filter((p) => p.source === "agent");
  const grounded = fromAgent[0]?.grounded ?? agent.grounded;
  /**
   * Only the ones that need no judgement: high confidence, deterministic, and no field for a human
   * to fill in. A model's suggestion is never in here however sure it sounds — bulk-accepting a
   * guess fifty at a time is the fastest way to lose the trust the queue depends on.
   */
  const bulk = proposals.filter((p) => p.confidence === "high" && p.source !== "agent" && p.action.kind !== "setKind" && p.action.kind !== "setRelationKind");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? proposals : proposals.slice(0, 6);
  const counts = proposals.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.confidence]: (acc[p.confidence] ?? 0) + 1 }), {});

  const act = (p: Proposal, override?: string) => {
    setBusy(p.key);
    start(async () => {
      const r = await acceptProposal(workspaceId, p, override);
      if (r && "error" in r) setErrors((e) => ({ ...e, [p.key]: r.error }));
      setBusy(null);
    });
  };

  return (
    <section className="studio-board-browser" aria-label="Agent proposals">
      <div className="studio-board-browser-title">
        <div>
          <h2 className="flex items-center gap-2"><Sparkles size={20} style={{ color: "var(--blue)" }} /> Agent proposals</h2>
          <p>
            {proposals.length === 0
              ? "Nothing to propose right now — the graph is consistent. Ask the agent to read it if you want a second opinion."
              : `${proposals.length} suggestion${proposals.length === 1 ? "" : "s"}${fromAgent.length ? `, ${fromAgent.length} from the agent` : " from the resolution rules"}${counts.high ? ` · ${counts.high} high confidence` : ""}. Accept to apply, dismiss to remember your decision.`}
          </p>
        </div>
        <div className="proposal-header-actions">
          {bulk.length > 1 && (
            <button
              type="button"
              className="primary-home-button"
              disabled={pending}
              data-accept-all
              onClick={() => {
                // Bulk accept can merge dozens of entities at once. Say how many objects it
                // touches before it touches them, the way the Compose rebuild does.
                const touched = new Set(bulk.flatMap((p) => p.entityIds)).size;
                const merges = bulk.filter((p) => p.action.kind === "merge").length;
                const warning = merges
                  ? `Accept ${bulk.length} proposals? ${merges} of them merge entities together, which cannot be undone. ${touched} objects are affected.`
                  : `Accept ${bulk.length} proposals, affecting ${touched} objects?`;
                if (!confirm(warning)) return;
                setBusy("all");
                start(async () => {
                  const r = await acceptProposals(workspaceId, bulk);
                  setBulkResult(`${r.applied} applied${r.failed.length ? `, ${r.failed.length} could not be: ${r.failed.slice(0, 2).join("; ")}` : ""}.`);
                  setBusy(null);
                });
              }}
            >
              Accept the {bulk.length} confident ones
            </button>
          )}
          {agent.ready ? (
            <button
              type="button"
              className="ghost-button"
              disabled={pending}
              data-ask-agent
              onClick={() => {
                setBusy("agent");
                setRunResult(null);
                start(async () => {
                  const r = await askTheAgent(workspaceId);
                  setBusy(null);
                  if ("error" in r) { setRunResult(r.error); setRejected([]); return; }
                  setRejected(r.rejected);
                  setRunResult(
                    [
                      r.note,
                      `${r.proposed} proposal${r.proposed === 1 ? "" : "s"} survived checking${r.rejected.length ? `, ${r.rejected.length} thrown away` : ""}.`,
                      r.sampled ? "The graph was too big to send whole, so it read the objects most in need of attention." : "",
                    ].filter(Boolean).join(" "),
                  );
                });
              }}
            >
              <Bot size={16} /> {busy === "agent" && pending ? "Reading the graph…" : "Ask the agent"}
            </button>
          ) : (
            <span className="proposal-legend" data-agent-unavailable>{agent.hint || "No model configured — the rules run on their own."}</span>
          )}
          {fromAgent.length > 0 && (
            <button type="button" className="ghost-button" disabled={pending} onClick={() => { setBusy("forget"); start(async () => { await forgetAgentRun(workspaceId); setRunResult(null); setRejected([]); setBusy(null); }); }}>
              <X size={14} /> Clear the agent&rsquo;s run
            </button>
          )}
        </div>
      </div>
      {bulkResult && <p className="proposal-bulk-result">{bulkResult}</p>}
      {runResult && <p className="proposal-bulk-result" data-agent-result>{runResult}</p>}
      {grounded.length > 0 && (
        <p className="proposal-grounding"><BookOpen size={13} /> Grounded in: {grounded.join(" · ")}</p>
      )}
      {rejected.length > 0 && (
        <details className="proposal-rejected">
          <summary>{rejected.length} claim{rejected.length === 1 ? "" : "s"} thrown away before you saw {rejected.length === 1 ? "it" : "them"}</summary>
          <ul>{rejected.slice(0, 12).map((line, i) => <li key={i}>{line}</li>)}</ul>
        </details>
      )}
      {proposals.length > 0 && (
        <div className="proposal-list">
          {visible.map((p) => {
            const needsInput = (p.type === "untyped" || p.type === "relation" || p.type === "newRelation" || p.type === "attributeMissing");
            const value = inputs[p.key] ?? (p.action.kind === "setKind" || p.action.kind === "setRelationKind" || p.action.kind === "setAttribute" || p.action.kind === "addRelation" ? p.action.to : "");
            return (
              <article key={p.key} className={`proposal-card ${p.confidence}`}>
                <div className="proposal-icon">{ICONS[p.type]}</div>
                <div className="proposal-body">
                  <div className="proposal-head">
                    <strong>{p.title}</strong>
                    {p.source === "agent" && <i className="proposal-source"><Bot size={11} /> {p.agentName || "agent"}</i>}
                    <i className={`confidence ${p.confidence}`}>{p.confidence}</i>
                  </div>
                  <p>{p.detail}</p>
                  {p.evidence && (
                    <ul className="proposal-evidence">
                      {p.evidence.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  )}
                  {needsInput && (
                    <input className="proposal-input" value={value} onChange={(e) => setInputs((v) => ({ ...v, [p.key]: e.target.value }))} placeholder={p.type === "untyped" ? "Kind, e.g. Application" : p.type === "attributeMissing" && p.action.kind === "setAttribute" ? `Value for ${p.action.key}` : "Relation label, e.g. depends on"} />
                  )}
                  {errors[p.key] && <p className="form-error">{errors[p.key]}</p>}
                </div>
                <div className="proposal-actions">
                  <button type="button" className="primary-home-button" disabled={pending && busy === p.key} onClick={() => act(p, needsInput ? value : undefined)}><Check size={14} /> {ACCEPT_LABEL[p.type]}</button>
                  <button type="button" className="ghost-button" disabled={pending && busy === p.key} onClick={() => { setBusy(p.key); start(async () => { await dismissProposal(workspaceId, p.key); setBusy(null); }); }}><X size={14} /> Dismiss</button>
                </div>
              </article>
            );
          })}
          {proposals.length > 6 && (
            <button type="button" className="ghost-button" style={{ justifySelf: "start" }} onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${proposals.length}`}</button>
          )}
        </div>
      )}
    </section>
  );
}
