"use client";

import { useState, useTransition } from "react";
import { Check, Columns3, GitMerge, ListPlus, SpellCheck, Sparkles, Tag, Trash2, Type, Unlink, X } from "lucide-react";
import type { Proposal } from "@/lib/graph-types";
import { acceptProposal, dismissProposal } from "@/lib/actions";

const ICONS: Record<Proposal["type"], React.ReactNode> = {
  merge: <GitMerge size={16} />,
  kind: <Tag size={16} />,
  untyped: <Type size={16} />,
  relation: <Unlink size={16} />,
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
  orphan: "Delete",
  attributeKey: "Rename key",
  attributeValue: "Normalise",
  attributeMissing: "Set value",
};

/** Agent proposals: deterministic suggestions with accept / dismiss (LeanFlow panel styling). */
export function ProposalsPanel({ workspaceId, proposals }: { workspaceId: string; proposals: Proposal[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
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
              ? "Nothing to propose right now — the graph is consistent."
              : `${proposals.length} suggestion${proposals.length === 1 ? "" : "s"} from the resolution rules${counts.high ? ` · ${counts.high} high confidence` : ""}. Accept to apply, dismiss to remember your decision.`}
          </p>
        </div>
        <span className="proposal-legend">Rules today · LLM-backed agents plug into the same accept / dismiss flow</span>
      </div>
      {proposals.length > 0 && (
        <div className="proposal-list">
          {visible.map((p) => {
            const needsInput = (p.type === "untyped" || p.type === "relation" || p.type === "attributeMissing");
            const value = inputs[p.key] ?? (p.action.kind === "setKind" || p.action.kind === "setRelationKind" || p.action.kind === "setAttribute" ? p.action.to : "");
            return (
              <article key={p.key} className={`proposal-card ${p.confidence}`}>
                <div className="proposal-icon">{ICONS[p.type]}</div>
                <div className="proposal-body">
                  <div className="proposal-head">
                    <strong>{p.title}</strong>
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
