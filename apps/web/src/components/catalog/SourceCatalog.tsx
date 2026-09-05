"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, CircleHelp, CircleSlash, Plus, Radar, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, X,
} from "lucide-react";
import { PROVIDER_CATEGORIES, PROVIDERS } from "@/lib/catalog/providers";
import { declineProvider, grantScopes, registerSource, reopenProvider, revokeProvider, unregisterSource } from "@/lib/catalog/actions";
import { expandScopes, flattenScopes, toggleScope, type Discovery, type Provider, type ScopeNode } from "@/lib/catalog/types";
import type { ScanReport, UnknownSystem } from "@/lib/catalog/discovery";
import { CHANNEL_LABEL, type Signal } from "@/lib/catalog/signals";
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

export function SourceCatalog({ workspaceId, slug, scan, custom, connections }: {
  workspaceId: string;
  slug: string;
  scan: ScanReport | null;
  /** Sources registered in this workspace: the catalogue grows to fit the estate. */
  custom: Provider[];
  connections: ConnectionRow[];
}) {
  const discoveries = useMemo(() => scan?.discoveries ?? [], [scan]);
  const catalogue = useMemo(() => [...custom, ...PROVIDERS], [custom]);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openProvider, setOpenProvider] = useState<string | null>(null);

  const connectionOf = useMemo(() => new Map(connections.map((c) => [c.providerId, c])), [connections]);
  const discoveryOf = useMemo(() => new Map(discoveries.map((d) => [d.providerId, d])), [discoveries]);

  const q = query.trim().toLowerCase();
  const shown = catalogue.filter((p) => {
    if (q && !`${p.name} ${p.vendor} ${p.summary} ${p.signals.join(" ")}`.toLowerCase().includes(q)) return false;
    if (filter === "all") return true;
    if (filter === "granted") return connectionOf.get(p.id)?.status === "granted";
    if (filter === "found") return discoveryOf.has(p.id);
    return p.category === filter;
  });

  const grantedCount = connections.filter((c) => c.status === "granted").length;
  const current = openProvider ? catalogue.find((p) => p.id === openProvider) ?? null : null;

  return (
    <div className="catalog">
      <header className="catalog-head">
        <label className="studio-home-search catalog-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalogue" aria-label="Search the catalogue" />
        </label>
        <div className="catalog-filters" role="tablist" aria-label="Filter the catalogue">
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <em>{catalogue.length}</em></button>
          <button type="button" className={filter === "found" ? "active" : ""} onClick={() => setFilter("found")}><Radar size={12} /> Found here <em>{discoveries.length}</em></button>
          <button type="button" className={filter === "granted" ? "active" : ""} onClick={() => setFilter("granted")}><ShieldCheck size={12} /> Granted <em>{grantedCount}</em></button>
          {PROVIDER_CATEGORIES.map((c) => (
            <button type="button" key={c.id} className={filter === c.id ? "active" : ""} onClick={() => setFilter(c.id)}>
              {c.name} <em>{catalogue.filter((p) => p.category === c.id).length}</em>
            </button>
          ))}
        </div>
      </header>

      {scan && <ScanSummary scan={scan} slug={slug} />}

      {scan && scan.unknown.length > 0 && filter !== "granted" && (
        <UnknownSystems workspaceId={workspaceId} unknown={scan.unknown} />
      )}

      {discoveries.length > 0 && filter !== "granted" && (
        <section className="catalog-discovered" data-discoveries>
          <h3><Radar size={14} /> The agent found these on your estate</h3>
          <p className="catalog-discovered-hint">
            Nothing has been read. Each one is a request: what it wants, why, and the evidence it is going on.
          </p>
          <ul>
            {discoveries.map((d) => {
              const provider = catalogue.find((p) => p.id === d.providerId);
              if (!provider) return null;
              return (
                <li key={d.providerId} data-discovery={d.providerId}>
                  <div className="catalog-discovered-head">
                    <strong>{provider.name}</strong>
                    <span className="catalog-vendor">{provider.vendor}</span>
                    <em className={`intake-confidence ${d.confidence}`}>{d.confidence}</em>
                  </div>
                  <p className="catalog-reason">{d.reason}</p>
                  <SignalList signals={d.signals} />
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
        await declineProvider({ workspaceId, providerId: discovery.providerId, reason: discovery.reason, evidence: discovery.signals });
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
            <SignalList signals={discovery.signals} />
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
          {provider.id.startsWith("custom:") && (
            <button
              type="button"
              className="ghost-button danger spacer"
              disabled={pending}
              onClick={() => run(() => unregisterSource(workspaceId, provider.id.slice("custom:".length)))}
              data-unregister
            >
              <Trash2 size={14} /> Remove from the catalogue
            </button>
          )}
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
                onClick={() => run(() => declineProvider({ workspaceId, providerId: provider.id, note, reason: discovery?.reason, evidence: discovery?.signals }))}
              >
                Decline
              </button>
              <button
                type="button"
                className="primary-home-button"
                disabled={pending || picked.size === 0}
                onClick={() => run(() => grantScopes({ workspaceId, providerId: provider.id, paths: [...picked], note, reason: discovery?.reason, evidence: discovery?.signals }))}
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

/**
 * The scan, reported like the intake pipeline: which channels were read, how much of each, and
 * what came out. A survey of an enterprise that cannot say where it looked is not a survey.
 */
function ScanSummary({ scan, slug }: { scan: ScanReport; slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="scan-summary" data-scan>
      <div className="scan-line">
        <Radar size={14} />
        <strong>
          {scan.scannedRecords.toLocaleString("en")} records read · {scan.totalSignals} signals ·{" "}
          {scan.discoveries.length} system{scan.discoveries.length === 1 ? "" : "s"} recognised ·{" "}
          {scan.unknown.length} unrecognised
        </strong>
        <button type="button" className="ghost-button" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Where it looked"}
        </button>
      </div>
      {open && (
        <>
          <ul className="scan-channels">
            {scan.channels.map((c) => (
              <li key={c.channel} className={c.scanned === 0 ? "empty" : ""} data-channel={c.channel}>
                <span>{c.label}</span>
                <strong>{c.scanned.toLocaleString("en")}</strong>
                <em>{c.signals} signal{c.signals === 1 ? "" : "s"}</em>
              </li>
            ))}
          </ul>
          <p className="scan-note">
            Nexus reads what this workspace already holds — it does not probe your network. Every
            proposal below quotes the exact string that produced it.
          </p>
        </>
      )}
      {scan.unsourced.length > 0 && (
        <p className="scan-gap">
          <AlertTriangle size={13} />
          {scan.unsourced.length} system{scan.unsourced.length === 1 ? "" : "s"} in the graph
          {scan.unsourced.length === 1 ? " has" : " have"} no source behind
          {scan.unsourced.length === 1 ? " it" : " them"} — {scan.unsourced.slice(0, 4).map((u) => u.name).join(", ")}
          {scan.unsourced.length > 4 ? ` and ${scan.unsourced.length - 4} more` : ""}.{" "}
          <Link href={`/w/${slug}/graph`}>Open the graph</Link>
        </p>
      )}
    </section>
  );
}

/**
 * Hosts and endpoints nobody's catalogue claims.
 *
 * Every enterprise runs systems no vendor list contains — the in-house scheduler, the acquired
 * company's portal, the box in the control room. The catalogue has to grow to fit the estate
 * rather than the other way round, so these can be added to it.
 */
function UnknownSystems({ workspaceId, unknown }: { workspaceId: string; unknown: UnknownSystem[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="catalog-unknown" data-unknown>
      <h3>
        <CircleHelp size={14} /> {unknown.length} system{unknown.length === 1 ? "" : "s"} nobody&rsquo;s catalogue knows
        <button type="button" className="ghost-button" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</button>
      </h3>
      <p className="catalog-discovered-hint">
        Hosts and endpoints seen in your own material that match no vendor in the catalogue. These are
        usually the systems that matter most, because nothing off the shelf describes them.
      </p>
      {open && (
        <ul>
          {unknown.slice(0, 12).map((u) => (
            <li key={u.domain} data-unknown-domain={u.domain}>
              <div className="catalog-discovered-head">
                <strong>{u.domain}</strong>
                <span className="catalog-vendor">{u.hosts.length} host{u.hosts.length === 1 ? "" : "s"} · seen {u.sightings.length} time{u.sightings.length === 1 ? "" : "s"}</span>
              </div>
              <p className="catalog-hosts">{u.hosts.slice(0, 4).join(" · ")}{u.hosts.length > 4 ? ` +${u.hosts.length - 4}` : ""}</p>
              <ul className="catalog-evidence">
                {u.sightings.slice(0, 2).map((sight, i) => (
                  <li key={i}><span className={`catalog-origin ${sight.channel}`}>{CHANNEL_LABEL[sight.channel]}</span> {sight.refName}: {sight.context}</li>
                ))}
              </ul>
              <RegisterUnknown workspaceId={workspaceId} unknown={u} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Add an unrecognised system to this workspace's catalogue, seeded with the hosts it was seen at. */
function RegisterUnknown({ workspaceId, unknown }: { workspaceId: string; unknown: UnknownSystem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestName(unknown.domain));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="catalog-discovered-actions">
        <button type="button" className="ghost-button" onClick={() => setOpen(true)}><Plus size={14} /> Add to the catalogue</button>
      </div>
    );
  }
  return (
    <div className="catalog-register">
      <label>
        <span>Call it</span>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Source name" />
      </label>
      <button
        type="button"
        className="primary-home-button"
        disabled={pending || !name.trim()}
        onClick={() => start(async () => {
          const r = await registerSource({
            workspaceId,
            name,
            vendor: "",
            category: "systems",
            summary: `Seen at ${unknown.hosts.slice(0, 3).join(", ")} in your own material.`,
            signals: [...unknown.hosts, unknown.domain],
          });
          if ("error" in r && r.error) { setError(r.error); return; }
          setOpen(false);
          router.refresh();
        })}
      >
        Add
      </button>
      <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
      {error && <p className="intake-error">{error}</p>}
    </div>
  );
}

/** "kamstrup-api.internal" → "Kamstrup Api". A starting point, not a decision. */
function suggestName(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return label.split(/[-_]/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** The strongest signals behind a proposal, quoted. */
function SignalList({ signals }: { signals: Signal[] }) {
  return (
    <ul className="catalog-evidence">
      {signals.map((s, i) => (
        <li key={i}>
          <span className={`catalog-origin ${s.channel}`}>{CHANNEL_LABEL[s.channel]}</span>
          <b>{s.match}</b> — {s.note}, in “{s.refName}”
          {(s.occurrences ?? 1) > 1 && <em className="catalog-times">and {s.occurrences! - 1} more place{s.occurrences! - 1 === 1 ? "" : "s"}</em>}
          {s.context && <span className="catalog-context">{s.context}</span>}
        </li>
      ))}
    </ul>
  );
}
