"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check, CircleSlash, Radar, RotateCcw, Search, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { PROVIDER_CATEGORIES, PROVIDERS, providerById } from "@/lib/catalog/providers";
import { declineProvider, grantScopes, reopenProvider, revokeProvider } from "@/lib/catalog/actions";
import { expandScopes, flattenScopes, toggleScope, type Discovery, type Provider, type ScopeNode } from "@/lib/catalog/types";
import type { ConnectionRow } from "@/lib/catalog/read";
import { ScopeTree } from "./ScopeTree";

/**
 * The source catalogue.
 *
 * A library rather than a settings page: browse what Nexus can reach, see what the agent has
 * found on this estate and what it is asking for, and grant it — module by module, object by
 * object — with the payoff written next to every box.
 */

type Filter = "all" | "granted" | "found" | Provider["category"];

export function SourceCatalog({ workspaceId, discoveries, connections }: {
  workspaceId: string;
  discoveries: Discovery[];
  connections: ConnectionRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openProvider, setOpenProvider] = useState<string | null>(null);

  const connectionOf = useMemo(() => new Map(connections.map((c) => [c.providerId, c])), [connections]);
  const discoveryOf = useMemo(() => new Map(discoveries.map((d) => [d.providerId, d])), [discoveries]);

  const q = query.trim().toLowerCase();
  const shown = PROVIDERS.filter((p) => {
    if (q && !`${p.name} ${p.vendor} ${p.summary} ${p.signals.join(" ")}`.toLowerCase().includes(q)) return false;
    if (filter === "all") return true;
    if (filter === "granted") return connectionOf.get(p.id)?.status === "granted";
    if (filter === "found") return discoveryOf.has(p.id);
    return p.category === filter;
  });

  const grantedCount = connections.filter((c) => c.status === "granted").length;
  const current = openProvider ? providerById(openProvider) ?? null : null;

  return (
    <div className="catalog">
      <header className="catalog-head">
        <label className="studio-home-search catalog-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalogue" aria-label="Search the catalogue" />
        </label>
        <div className="catalog-filters" role="tablist" aria-label="Filter the catalogue">
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <em>{PROVIDERS.length}</em></button>
          <button type="button" className={filter === "found" ? "active" : ""} onClick={() => setFilter("found")}><Radar size={12} /> Found here <em>{discoveries.length}</em></button>
          <button type="button" className={filter === "granted" ? "active" : ""} onClick={() => setFilter("granted")}><ShieldCheck size={12} /> Granted <em>{grantedCount}</em></button>
          {PROVIDER_CATEGORIES.map((c) => (
            <button type="button" key={c.id} className={filter === c.id ? "active" : ""} onClick={() => setFilter(c.id)}>
              {c.name} <em>{PROVIDERS.filter((p) => p.category === c.id).length}</em>
            </button>
          ))}
        </div>
      </header>

      {discoveries.length > 0 && filter !== "granted" && (
        <section className="catalog-discovered" data-discoveries>
          <h3><Radar size={14} /> The agent found these on your estate</h3>
          <p className="catalog-discovered-hint">
            Nothing has been read. Each one is a request: what it wants, why, and the evidence it is going on.
          </p>
          <ul>
            {discoveries.map((d) => {
              const provider = providerById(d.providerId);
              if (!provider) return null;
              return (
                <li key={d.providerId} data-discovery={d.providerId}>
                  <div className="catalog-discovered-head">
                    <strong>{provider.name}</strong>
                    <span className="catalog-vendor">{provider.vendor}</span>
                    <em className={`intake-confidence ${d.confidence}`}>{d.confidence}</em>
                  </div>
                  <p className="catalog-reason">{d.reason}</p>
                  <ul className="catalog-evidence">
                    {d.evidence.map((e, i) => (
                      <li key={i}><span className={`catalog-origin ${e.origin}`}>{e.origin}</span> {e.detail}</li>
                    ))}
                  </ul>
                  <div className="catalog-discovered-actions">
                    <button type="button" className="primary-home-button" onClick={() => setOpenProvider(d.providerId)}>
                      Review what it may read
                    </button>
                    <DeclineButton workspaceId={workspaceId} discovery={d} onDone={() => router.refresh()} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="catalog-grid">
        {shown.map((p) => {
          const connection = connectionOf.get(p.id);
          const discovery = discoveryOf.get(p.id);
          return (
            <button type="button" className="catalog-card" key={p.id} onClick={() => setOpenProvider(p.id)} data-provider={p.id}>
              <header>
                <strong>{p.name}</strong>
                <ProviderBadge provider={p} connection={connection} discovered={!!discovery} />
              </header>
              <span className="catalog-vendor">{p.vendor}</span>
              <p>{p.summary}</p>
              <footer>
                {p.scopes.length > 0
                  ? <span>{flattenScopes(p.scopes).length} grantable scopes</span>
                  : <span>{p.mode === "upload" ? "Upload or paste" : "No scopes yet"}</span>}
                {connection?.status === "granted" && <span className="catalog-granted-count">{connection.paths.length} granted</span>}
              </footer>
            </button>
          );
        })}
        {shown.length === 0 && <p className="intake-hint">Nothing in the catalogue matches that.</p>}
      </div>

      {current && (
        <ProviderPanel
          workspaceId={workspaceId}
          provider={current}
          discovery={discoveryOf.get(current.id) ?? null}
          connection={connectionOf.get(current.id) ?? null}
          onClose={() => setOpenProvider(null)}
          onDone={() => { setOpenProvider(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ProviderBadge({ provider, connection, discovered }: { provider: Provider; connection?: ConnectionRow; discovered: boolean }) {
  if (connection?.status === "granted") return <em className="catalog-badge granted"><ShieldCheck size={11} /> granted</em>;
  if (connection?.status === "declined") return <em className="catalog-badge declined"><CircleSlash size={11} /> declined</em>;
  if (connection?.status === "revoked") return <em className="catalog-badge declined">revoked</em>;
  if (discovered) return <em className="catalog-badge found"><Radar size={11} /> found here</em>;
  if (provider.status === "available") return <em className="catalog-badge available">ready</em>;
  return <em className="catalog-badge planned">planned</em>;
}

function DeclineButton({ workspaceId, discovery, onDone }: { workspaceId: string; discovery: Discovery; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="ghost-button"
      disabled={pending}
      onClick={() => start(async () => {
        await declineProvider({ workspaceId, providerId: discovery.providerId, reason: discovery.reason, evidence: discovery.evidence });
        onDone();
      })}
    >
      <X size={14} /> Not this one
    </button>
  );
}

/** The grant panel: the case for reading a system, and the tree of what it may read. */
function ProviderPanel({ workspaceId, provider, discovery, connection, onClose, onDone }: {
  workspaceId: string;
  provider: Provider;
  discovery: Discovery | null;
  connection: ConnectionRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const wanted = useMemo(() => new Set(discovery?.wants ?? []), [discovery]);
  const [picked, setPicked] = useState<Set<string>>(() => expandScopes(provider.scopes, connection?.paths ?? discovery?.wants ?? []));
  const [note, setNote] = useState(connection?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (node: ScopeNode, on: boolean) => setPicked((prev) => toggleScope(provider.scopes, prev, node.path, on));

  const run = (fn: () => Promise<{ error?: string } | unknown>) => {
    setError(null);
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && "error" in r && r.error) { setError(r.error); return; }
      onDone();
    });
  };

  const sensitive = [...picked].filter((p) => flattenScopes(provider.scopes).find((n) => n.path === p)?.sensitivity === "personal");

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card catalog-panel" data-provider-panel={provider.id}>
        <header>
          <div>
            <h2>{provider.name}</h2>
            <span className="catalog-vendor">{provider.vendor} · {provider.category}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <p className="catalog-rationale">{provider.rationale}</p>
        <p className="catalog-auth"><ShieldCheck size={13} /> {provider.auth}</p>

        {discovery && (
          <div className="catalog-ask">
            <strong><Sparkles size={13} /> What the agent is asking for</strong>
            <p>{discovery.reason}</p>
            <ul className="catalog-evidence">
              {discovery.evidence.map((e, i) => <li key={i}><span className={`catalog-origin ${e.origin}`}>{e.origin}</span> {e.detail}</li>)}
            </ul>
          </div>
        )}

        {provider.scopes.length === 0 ? (
          <p className="intake-hint">
            {provider.mode === "upload"
              ? "This source needs no grant — a file is uploaded or pasted, and nothing is read on its own."
              : "No scopes are modelled for this source yet."}
          </p>
        ) : (
          <>
            <div className="catalog-scope-head">
              <strong>What it may read</strong>
              <span className="muted">{picked.size} of {flattenScopes(provider.scopes).length} scopes · nothing outside this list is ever fetched</span>
            </div>
            <div className="catalog-scopes">
              <ScopeTree nodes={provider.scopes} picked={picked} wanted={wanted} onToggle={toggle} />
            </div>
            {sensitive.length > 0 && (
              <p className="catalog-warning">
                {sensitive.length} of the selected scopes contain personal data. That is a decision with a legal basis behind it — say what it is in the note.
              </p>
            )}
            <label className="catalog-note">
              <span>Note (why this was granted, and by whom it was agreed)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agreed with the data owner on…" />
            </label>
          </>
        )}

        {error && <p className="intake-error">{error}</p>}

        <div className="modal-actions">
          {connection?.status === "granted" && (
            <button type="button" className="ghost-button danger spacer" disabled={pending} onClick={() => run(() => revokeProvider(workspaceId, provider.id))}>
              Revoke everything
            </button>
          )}
          {(connection?.status === "declined" || connection?.status === "revoked") && (
            <button type="button" className="ghost-button spacer" disabled={pending} onClick={() => run(() => reopenProvider(workspaceId, provider.id))}>
              <RotateCcw size={14} /> Reconsider
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          {provider.scopes.length > 0 && (
            <>
              <button
                type="button"
                className="ghost-button"
                disabled={pending}
                onClick={() => run(() => declineProvider({ workspaceId, providerId: provider.id, note, reason: discovery?.reason, evidence: discovery?.evidence }))}
              >
                Decline
              </button>
              <button
                type="button"
                className="primary-home-button"
                disabled={pending || picked.size === 0}
                onClick={() => run(() => grantScopes({ workspaceId, providerId: provider.id, paths: [...picked], note, reason: discovery?.reason, evidence: discovery?.evidence }))}
              >
                <Check size={15} /> {connection?.status === "granted" ? `Update the grant (${picked.size})` : `Grant ${picked.size} scope${picked.size === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
