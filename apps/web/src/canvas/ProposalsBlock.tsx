"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles, X } from "lucide-react";
import type { Proposal } from "@/lib/graph-types";
import { acceptProposal, dismissProposal } from "@/lib/actions";
import { cardColorForKind, type CanvasElement, type CardElement } from "./document";
import { useCanvas, useCanvasStore, type CanvasStore } from "./store";

/**
 * Agent proposals for the selected card, reviewable without leaving the board. Accepting applies
 * the change in the graph *and* patches the open document the same way, because the board is the
 * client's truth while open and the next autosave would otherwise undo the graph change.
 */
export function ProposalsBlock({ entityId }: { entityId: string }) {
  const store = useCanvasStore();
  const proposals = useCanvas((s) => s.proposalsByEntity[entityId]);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  if (!proposals || proposals.length === 0) return null;

  const refresh = async () => {
    const s = store.getState();
    const data = await fetch(`/api/workspaces/${s.workspaceId}/proposals`).then((r) => (r.ok ? (r.json() as Promise<{ proposals: Proposal[] }>) : null)).catch(() => null);
    if (data?.proposals) s.setProposals(data.proposals);
  };
  const accept = (p: Proposal) => {
    const override = needsInput(p) ? (inputs[p.key] ?? defaultInput(p)) : undefined;
    setBusy(p.key);
    setError(null);
    start(async () => {
      const r = await acceptProposal(store.getState().workspaceId, p, override);
      if (r && "error" in r) setError(r.error);
      else applyLocally(store, p, override);
      await refresh();
      setBusy(null);
    });
  };
  const dismiss = (p: Proposal) => {
    setBusy(p.key);
    start(async () => { await dismissProposal(store.getState().workspaceId, p.key); await refresh(); setBusy(null); });
  };

  return (
    <div className="graph-block proposal-block" data-proposals-block>
      <span className="label"><Sparkles size={12} /> Agent proposals · {proposals.length}</span>
      {proposals.map((p) => (
        <div key={p.key} className={`proposal-mini ${p.confidence}`}>
          <strong>{p.title}</strong>
          <small>{p.detail}</small>
          {needsInput(p) && <input value={inputs[p.key] ?? defaultInput(p)} onChange={(e) => setInputs((v) => ({ ...v, [p.key]: e.target.value }))} placeholder={placeholder(p)} aria-label={placeholder(p)} onKeyDown={(e) => e.stopPropagation()} />}
          <div className="proposal-mini-actions">
            <button type="button" disabled={pending && busy === p.key} onClick={() => accept(p)}><Check size={12} /> {ACCEPT[p.type]}</button>
            <button type="button" className="ghost" disabled={pending && busy === p.key} onClick={() => dismiss(p)}><X size={12} /> Dismiss</button>
          </div>
        </div>
      ))}
      {error && <small className="form-error">{error}</small>}
    </div>
  );
}

const ACCEPT: Record<Proposal["type"], string> = { merge: "Merge", kind: "Rename kind", untyped: "Set kind", relation: "Label", newRelation: "Connect", orphan: "Delete", attributeKey: "Rename key", attributeValue: "Normalise", attributeMissing: "Set value" };

function needsInput(p: Proposal) {
  return p.action.kind === "setKind" || p.action.kind === "setRelationKind" || p.action.kind === "setAttribute" || p.action.kind === "addRelation";
}
function defaultInput(p: Proposal) {
  return p.action.kind === "setKind" || p.action.kind === "setRelationKind" || p.action.kind === "setAttribute" || p.action.kind === "addRelation" ? p.action.to : "";
}
function placeholder(p: Proposal) {
  return p.action.kind === "setKind" ? "Kind, e.g. Application" : p.action.kind === "setAttribute" ? `Value for ${p.action.key}` : "Relation label";
}

/** Mirror an accepted proposal onto the open document so the next autosave agrees with the graph. */
export function applyLocally(store: CanvasStore, p: Proposal, override?: string) {
  const s = store.getState();
  const a = p.action;
  const patch: Record<string, Partial<CanvasElement>> = {};
  const cards = Object.values(s.elements).filter((el): el is CardElement => el.type === "card");
  const byEntity = (id: string) => cards.filter((c) => c.meta?.entityId === id);
  switch (a.kind) {
    case "setKind": {
      const to = (override ?? a.to).trim();
      for (const c of byEntity(a.entityId)) patch[c.id] = { kind: to, color: cardColorForKind(to) };
      break;
    }
    case "renameKind": {
      const to = (override ?? a.to).trim();
      for (const c of cards) if (c.kind === a.from) patch[c.id] = { kind: to, color: cardColorForKind(to) };
      break;
    }
    case "setRelationKind": {
      const to = (override ?? a.to).trim();
      for (const el of Object.values(s.elements)) if (el.type === "connector" && el.meta?.relationId === a.relationId) patch[el.id] = { label: to };
      break;
    }
    case "setAttribute": {
      const to = (override ?? a.to).trim();
      for (const c of byEntity(a.entityId)) patch[c.id] = { attributes: { ...(c.attributes ?? {}), [a.key]: to } };
      break;
    }
    case "renameAttributeKey": {
      for (const c of cards) {
        if (!c.attributes || !(a.from in c.attributes)) continue;
        const moved = c.attributes[a.from] ?? "";
        const rest: Record<string, string> = {};
        for (const [k, v] of Object.entries(c.attributes)) if (k !== a.from) rest[k] = v;
        patch[c.id] = { attributes: a.to in rest ? rest : { ...rest, [a.to]: moved } };
      }
      break;
    }
    case "renameAttributeValue": {
      for (const c of cards) if (c.attributes?.[a.key] === a.from) patch[c.id] = { attributes: { ...(c.attributes ?? {}), [a.key]: a.to } };
      break;
    }
    case "merge": {
      for (const c of cards) if (c.meta?.entityId && a.otherIds.includes(String(c.meta.entityId))) patch[c.id] = { meta: { ...(c.meta ?? {}), entityId: a.survivorId } };
      break;
    }
    case "deleteEntity": {
      for (const c of byEntity(a.entityId)) { const { entityId: _gone, ...meta } = c.meta ?? {}; void _gone; patch[c.id] = { meta }; }
      break;
    }
    case "addRelation":
      // Nothing to mirror: the relation is created in the graph, and a board shows it when the
      // reader asks for relations (Viewpoint → Show all relations). Drawing a connector nobody
      // asked for onto the board they are looking at would be the ruder choice.
      break;
  }
  if (Object.keys(patch).length) s.updateElements(patch, { history: true });
}
