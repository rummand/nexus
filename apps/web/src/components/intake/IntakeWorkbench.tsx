"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, CircleHelp, FileText, Flag, Link2, ListChecks,
  LibraryBig, MessageSquareQuote, Play, Plus, Rows3, Sparkles, Trash2, Users, Waypoints,
} from "lucide-react";
import type { ExplorerGraph } from "@/lib/explorer";
import { GraphExplorer } from "@/components/explorer/GraphExplorer";
import type { ConnectionRow } from "@/lib/catalog/read";
import type { ScanReport } from "@/lib/catalog/discovery";
import type { Provider } from "@/lib/catalog/types";
import { SourceCatalog } from "@/components/catalog/SourceCatalog";
import { PROVIDERS, providerById } from "@/lib/catalog/providers";
import { commitSource, deleteSource, runSource } from "@/lib/intake/actions";
import type { Candidate, CandidateRelation, Extraction, SourceKind, Viewpoint } from "@/lib/intake/types";
import { PipelineFlow } from "./PipelineFlow";
import { NewSourceDialog } from "./NewSourceDialog";

/**
 * Intake — the workbench where unconsolidated data becomes graph.
 *
 * Left: the sources this workspace has taken in, and the catalogue of everywhere else it could
 * reach. Right: one source, its pipeline run drawn stage by stage, and everything the run
 * believes, each row carrying the sentence that produced it. Nothing reaches the graph until a
 * person ticks it.
 */

export interface SourceRow {
  id: string;
  name: string;
  kind: SourceKind;
  connector: string;
  status: "new" | "extracted" | "committed";
  characters: number;
  createdAt: string;
  counts: { candidates: number; relations: number; viewpoints: number; committed: number } | null;
}

type Tab = "objects" | "connections" | "viewpoints" | "passages";

const KIND_LABEL: Record<SourceKind, string> = {
  transcript: "Transcript",
  document: "Document",
  table: "Table",
  connector: "Sync",
};

export function IntakeWorkbench({ workspaceId, slug, sources, selected, extraction, view, landscape, scan, customProviders, connections }: {
  workspaceId: string;
  slug: string;
  sources: SourceRow[];
  selected: SourceRow | null;
  extraction: Extraction | null;
  view: "workbench" | "landscape" | "catalog";
  landscape: ExplorerGraph | null;
  scan: ScanReport | null;
  customProviders: Provider[];
  connections: ConnectionRow[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => ({
    committed: sources.filter((s) => s.status === "committed").length,
    characters: sources.reduce((n, s) => n + s.characters, 0),
  }), [sources]);

  const run = (fn: () => Promise<{ error?: string } | unknown>) => {
    setError(null);
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && "error" in r && r.error) setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="intake-shell">
      <header className="meta-topbar">
        <div className="meta-title">
          <h1>Intake</h1>
          <p>
            {sources.length} source{sources.length === 1 ? "" : "s"} · {totals.characters.toLocaleString("en")} characters read ·{" "}
            {totals.committed} committed to the graph
          </p>
        </div>
        <div className="panel-tabs intake-view-tabs" role="tablist" aria-label="Intake view">
          <Link href={`/w/${slug}/intake${selected ? `?source=${selected.id}` : ""}`} role="tab" className={view === "workbench" ? "active" : ""}>
            <Rows3 size={13} /> Workbench
          </Link>
          <Link href={`/w/${slug}/intake?view=landscape`} role="tab" className={view === "landscape" ? "active" : ""}>
            <Waypoints size={13} /> Landscape
          </Link>
          <Link href={`/w/${slug}/intake?view=catalog`} role="tab" className={view === "catalog" ? "active" : ""}>
            <LibraryBig size={13} /> Catalogue
          </Link>
        </div>
        <Link className="ghost-button" href={`/w/${slug}/graph`}>Knowledge graph →</Link>
      </header>

      <div className="intake-body">
        <aside className="intake-rail">
          <button type="button" className="primary-home-button intake-new" onClick={() => setDialog("transcript")}>
            <Plus size={15} /> New source
          </button>

          <div className="meta-tree-section">Sources <small>{sources.length}</small></div>
          {sources.length === 0 && <p className="intake-hint">Nothing taken in yet. A meeting transcript is the fastest way to see this work.</p>}
          <ul className="intake-sources">
            {sources.map((s) => (
              <li key={s.id}>
                <Link href={`/w/${slug}/intake?source=${s.id}`} className={`intake-source ${selected?.id === s.id ? "active" : ""}`} data-source-row>
                  <FileText size={14} />
                  <span className="intake-source-name">{s.name}</span>
                  <em className={`intake-status ${s.status}`}>{s.status}</em>
                  <small>{KIND_LABEL[s.kind]} · {s.counts ? `${s.counts.candidates + s.counts.relations + s.counts.viewpoints} objects` : "not read"}</small>
                </Link>
              </li>
            ))}
          </ul>

          <div className="meta-tree-section">Sources it can reach <small>{PROVIDERS.length}</small></div>
          <Link className="intake-catalog-card" href={`/w/${slug}/intake?view=catalog`}>
            <strong>{PROVIDERS.filter((p) => p.status === "available").length} connected · {PROVIDERS.filter((p) => p.status === "planned").length} in the catalogue</strong>
            <span>Browse the catalogue, review what the agent has found on the estate, and grant it what it may read.</span>
            <em>Open the catalogue →</em>
          </Link>
        </aside>

        <main className={`intake-main ${view === "landscape" ? "landscape" : ""}`}>
          {error && <p className="intake-error">{error}</p>}

          {view === "catalog" && (
            <SourceCatalog workspaceId={workspaceId} slug={slug} scan={scan} custom={customProviders} connections={connections} />
          )}

          {view === "landscape" && (
            landscape && landscape.nodes.length > 0 ? (
              <GraphExplorer
                graph={landscape}
                embedded
                title="What has been taken in"
                subtitle={`${landscape.nodes.length} objects from ${sources.filter((s2) => s2.status === "committed").length} committed source${sources.filter((s2) => s2.status === "committed").length === 1 ? "" : "s"} · ${landscape.edges.length} connections. Click a person to see the meetings they were in.`}
              />
            ) : (
              <div className="intake-empty">
                <Waypoints size={22} />
                <h2>Nothing committed yet</h2>
                <p>Once a source has been read and accepted, this shows everything it brought in — the meetings, who was in them, the subjects they covered and the systems they touched — as one graph you can walk.</p>
              </div>
            )
          )}

          {view === "workbench" && !selected && (
            <div className="intake-empty">
              <Sparkles size={22} />
              <h2>Bring something in</h2>
              <p>
                Upload a meeting transcript, paste minutes, or drop a CSV. Nexus reads it, proposes the objects,
                connections and decisions it found, and shows you the sentence behind each one before anything
                reaches the graph.
              </p>
              <button type="button" className="primary-home-button" onClick={() => setDialog("transcript")}><Plus size={15} /> New source</button>
            </div>
          )}

          {view === "workbench" && selected && (
            <>
              <div className="intake-source-head">
                <div>
                  <h2>{selected.name}</h2>
                  <p>
                    {KIND_LABEL[selected.kind]} · via {providerById(selected.connector)?.name ?? selected.connector} ·{" "}
                    {selected.characters.toLocaleString("en")} characters
                    {extraction?.speakers.length ? ` · ${extraction.speakers.length} speakers` : ""}
                  </p>
                </div>
                <button type="button" className="ghost-button" disabled={pending} onClick={() => run(() => runSource(selected.id))}>
                  <Play size={14} /> {extraction ? "Run again" : "Run pipeline"}
                </button>
                {selected.status === "committed" && <Link className="ghost-button" href={`/w/${slug}/graph`}><Link2 size={14} /> In the graph</Link>}
                <button
                  type="button"
                  className="ghost-button danger"
                  disabled={pending}
                  onClick={() => run(async () => { const r = await deleteSource(selected.id); router.push(`/w/${slug}/intake`); return r; })}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>

              <PipelineFlow stages={extraction?.stages ?? []} running={pending} />

              {extraction && (
                <Review
                  key={`${selected.id}:${extraction.stages.map((s) => s.out).join("-")}`}
                  sourceId={selected.id}
                  extraction={extraction}
                  committed={selected.status === "committed"}
                  onCommitted={() => router.refresh()}
                />
              )}
            </>
          )}
        </main>
      </div>

      {dialog && (
        <NewSourceDialog
          workspaceId={workspaceId}
          connectorId={providerById(dialog)?.status === "available" ? dialog : "transcript"}
          onClose={() => setDialog(null)}
          onCreated={(id) => { setDialog(null); router.push(`/w/${slug}/intake?source=${id}`); router.refresh(); }}
        />
      )}
    </div>
  );
}

/**
 * Everything the run believes, with the evidence, waiting for a decision.
 *
 * Remounted per run (keyed by the caller) so a fresh extraction starts from fresh ticks rather
 * than inheriting the last run's choices.
 */
function Review({ sourceId, extraction, committed, onCommitted }: {
  sourceId: string;
  extraction: Extraction;
  committed: boolean;
  onCommitted: () => void;
}) {
  const [tab, setTab] = useState<Tab>("objects");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  // Low-confidence guesses start unticked: the emergent ones are worth showing and not worth
  // committing to the graph on the extractor's word alone.
  const [picked, setPicked] = useState<Set<string>>(() => new Set([
    ...extraction.candidates.filter((c) => c.confidence !== "low").map((c) => c.key),
    ...extraction.relations.filter((r) => r.confidence !== "low").map((r) => r.key),
    ...extraction.viewpoints.filter((v) => v.confidence !== "low").map((v) => v.key),
  ]));

  const toggle = (key: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const setMany = (keys: string[], on: boolean) => setPicked((prev) => {
    const next = new Set(prev);
    for (const k of keys) { if (on) next.add(k); else next.delete(k); }
    return next;
  });

  const chosen = {
    candidates: extraction.candidates.filter((c) => picked.has(c.key)),
    relations: extraction.relations.filter((r) => picked.has(r.key)),
    viewpoints: extraction.viewpoints.filter((v) => picked.has(v.key)),
  };
  const total = chosen.candidates.length + chosen.relations.length + chosen.viewpoints.length;

  const commit = () => {
    setResult(null);
    start(async () => {
      const r = await commitSource(sourceId, {
        candidates: chosen.candidates.map((c) => c.key),
        // a connection is meaningless unless both ends are going in
        relations: chosen.relations.filter((rel) => picked.has(rel.from) && picked.has(rel.to)).map((rel) => rel.key),
        viewpoints: chosen.viewpoints.map((v) => v.key),
      });
      if ("error" in r && r.error) { setResult(r.error); return; }
      if ("entitiesCreated" in r) {
        setResult(`${r.entitiesCreated} new object${r.entitiesCreated === 1 ? "" : "s"}, ${r.entitiesLinked} linked to what was already there, ${r.relationsCreated} connections, ${r.viewpointsCreated} viewpoints.`);
      }
      onCommitted();
    });
  };

  return (
    <section className="intake-review">
      <div className="panel-tabs intake-tabs" role="tablist">
        <button type="button" role="tab" className={tab === "objects" ? "active" : ""} onClick={() => setTab("objects")}>
          <ListChecks size={13} /> Objects <em>{extraction.candidates.length}</em>
        </button>
        <button type="button" role="tab" className={tab === "connections" ? "active" : ""} onClick={() => setTab("connections")}>
          <Link2 size={13} /> Connections <em>{extraction.relations.length}</em>
        </button>
        <button type="button" role="tab" className={tab === "viewpoints" ? "active" : ""} onClick={() => setTab("viewpoints")}>
          <MessageSquareQuote size={13} /> Viewpoints <em>{extraction.viewpoints.length}</em>
        </button>
        <button type="button" role="tab" className={tab === "passages" ? "active" : ""} onClick={() => setTab("passages")}>
          <Users size={13} /> Source <em>{extraction.passages.length}</em>
        </button>
      </div>

      {tab === "objects" && (
        <CandidateList
          candidates={extraction.candidates}
          picked={picked}
          onToggle={toggle}
          onAll={(on) => setMany(extraction.candidates.map((c) => c.key), on)}
        />
      )}
      {tab === "connections" && (
        <RelationList
          relations={extraction.relations}
          candidates={extraction.candidates}
          picked={picked}
          onToggle={toggle}
          onAll={(on) => setMany(extraction.relations.map((r) => r.key), on)}
        />
      )}
      {tab === "viewpoints" && (
        <ViewpointList
          viewpoints={extraction.viewpoints}
          picked={picked}
          onToggle={toggle}
          onAll={(on) => setMany(extraction.viewpoints.map((v) => v.key), on)}
        />
      )}
      {tab === "passages" && (
        <ul className="intake-passages">
          {extraction.passages.map((p) => (
            <li key={p.id}>
              <b>{p.speaker || "—"}</b>
              {p.at && <small>{p.at}</small>}
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      )}

      <footer className="intake-commit">
        {result && <span className="intake-result"><CheckCircle2 size={14} /> {result}</span>}
        <span className="muted">{total} of {extraction.candidates.length + extraction.relations.length + extraction.viewpoints.length} selected</span>
        <button type="button" className="primary-home-button" disabled={pending || total === 0} onClick={commit}>
          {pending ? "Writing…" : committed ? `Update the graph (${total})` : `Add ${total} to the graph`}
        </button>
      </footer>
    </section>
  );
}

function Confidence({ level }: { level: Candidate["confidence"] }) {
  return <em className={`intake-confidence ${level}`}>{level}</em>;
}

function Evidence({ mentions }: { mentions: Candidate["mentions"] }) {
  const first = mentions[0];
  if (!first) return null;
  return (
    <blockquote className="intake-quote">
      “{first.quote}”
      {first.speaker && <cite>— {first.speaker}</cite>}
      {mentions.length > 1 && <small>+{mentions.length - 1} more</small>}
    </blockquote>
  );
}

function SelectAll({ onAll }: { onAll: (on: boolean) => void }) {
  return (
    <div className="intake-selectall">
      <button type="button" className="ghost-button" onClick={() => onAll(true)}>Select all</button>
      <button type="button" className="ghost-button" onClick={() => onAll(false)}>None</button>
    </div>
  );
}

function CandidateList({ candidates, picked, onToggle, onAll }: {
  candidates: Candidate[];
  picked: Set<string>;
  onToggle: (key: string) => void;
  onAll: (on: boolean) => void;
}) {
  if (candidates.length === 0) return <p className="intake-hint">No objects found in this source.</p>;
  return (
    <>
      <SelectAll onAll={onAll} />
      <ul className="intake-list">
        {candidates.map((c) => (
          <li key={c.key} className={picked.has(c.key) ? "picked" : ""} data-candidate>
            <label>
              <input type="checkbox" checked={picked.has(c.key)} onChange={() => onToggle(c.key)} aria-label={`Accept ${c.name}`} />
              <span className="intake-name">{c.name}</span>
              <span className={`intake-kind ${c.kind ? "" : "untyped"}`}>{c.kind || "no kind yet"}</span>
              <Confidence level={c.confidence} />
              {c.existingEntityId && <span className="intake-badge"><Link2 size={11} /> exists</span>}
            </label>
            <p className="intake-reason">{c.reason}</p>
            <Evidence mentions={c.mentions} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RelationList({ relations, candidates, picked, onToggle, onAll }: {
  relations: CandidateRelation[];
  candidates: Candidate[];
  picked: Set<string>;
  onToggle: (key: string) => void;
  onAll: (on: boolean) => void;
}) {
  const nameOf = new Map(candidates.map((c) => [c.key, c.name]));
  if (relations.length === 0) return <p className="intake-hint">Nothing in this source connected two things explicitly.</p>;
  return (
    <>
      <SelectAll onAll={onAll} />
      <ul className="intake-list">
        {relations.map((r) => {
          const bothEnds = picked.has(r.from) && picked.has(r.to);
          return (
            <li key={r.key} className={picked.has(r.key) ? "picked" : ""} data-relation>
              <label>
                <input type="checkbox" checked={picked.has(r.key)} onChange={() => onToggle(r.key)} aria-label={`Accept ${r.kind}`} />
                <span className="intake-name">{nameOf.get(r.from) ?? r.from}</span>
                <span className="intake-rel">{r.kind}</span>
                <span className="intake-name">{nameOf.get(r.to) ?? r.to}</span>
                <Confidence level={r.confidence} />
                {!bothEnds && picked.has(r.key) && (
                  <span className="intake-badge warn"><AlertTriangle size={11} /> needs both ends</span>
                )}
              </label>
              <Evidence mentions={r.mentions} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

const VIEWPOINT_ICON = {
  decision: CheckCircle2,
  action: ListChecks,
  risk: Flag,
  question: CircleHelp,
  need: Sparkles,
} as const;

function ViewpointList({ viewpoints, picked, onToggle, onAll }: {
  viewpoints: Viewpoint[];
  picked: Set<string>;
  onToggle: (key: string) => void;
  onAll: (on: boolean) => void;
}) {
  if (viewpoints.length === 0) return <p className="intake-hint">Nobody decided, asked for or worried about anything in this source.</p>;
  return (
    <>
      <SelectAll onAll={onAll} />
      <ul className="intake-list">
        {viewpoints.map((v) => {
          const Icon = VIEWPOINT_ICON[v.type];
          return (
            <li key={v.key} className={picked.has(v.key) ? "picked" : ""} data-viewpoint>
              <label>
                <input type="checkbox" checked={picked.has(v.key)} onChange={() => onToggle(v.key)} aria-label={`Accept ${v.type}`} />
                <span className={`intake-viewpoint ${v.type}`}><Icon size={12} /> {v.type}</span>
                {v.speaker && <span className="intake-speaker">{v.speaker}</span>}
                <Confidence level={v.confidence} />
              </label>
              <p className="intake-viewpoint-text">{v.text}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
