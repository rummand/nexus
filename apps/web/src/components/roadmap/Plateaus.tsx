"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, CalendarDays, Flag, Layers, Minus, Plus, Sparkles, Trash2, X,
} from "lucide-react";
import { createPlateau, deletePlateau, excludeFromPlateau, includeInPlateau, updatePlateau } from "@/lib/change/actions";
import type { ChangeSetStatus } from "@/lib/change/types";
import { RoadmapTabs } from "./RoadmapTabs";

/**
 * Plateaus, and the difference between two of them.
 *
 * Looking at one state is mildly useful. Subtracting two is the point: "what changes between today
 * and 2028" is the question a roadmap is actually asked, and nobody answers it by reading two
 * pictures side by side. So the diff is the largest thing on the page and the state summary is a
 * header above it.
 */

export interface PlateauView {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  entities: number;
  relations: number;
  health: number;
  members: Array<{ id: string; name: string; status: ChangeSetStatus }>;
  incoherent: Array<{ name: string; missing: string[] }>;
  problems: number;
}

export interface DiffView {
  summary: string;
  added: Array<{ id: string; name: string; kind: string }>;
  addedMore: number;
  removed: Array<{ id: string; name: string; kind: string }>;
  removedMore: number;
  renamed: Array<{ id: string; before: string; after: string }>;
  attributes: Array<{ id: string; name: string; key: string; before: string; after: string }>;
  attributesMore: number;
  relationsAdded: number;
  relationsRemoved: number;
}

export function Plateaus({ workspaceId, slug, plateaus, selectedId, baselineId, asIs, changeSets, diff }: {
  workspaceId: string;
  slug: string;
  plateaus: PlateauView[];
  selectedId: string | null;
  baselineId: string;
  asIs: { entities: number; relations: number; health: number };
  changeSets: Array<{ id: string; name: string; status: ChangeSetStatus; targetDate: string }>;
  diff: DiffView | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = plateaus.find((p) => p.id === selectedId) ?? null;
  const baseline = plateaus.find((p) => p.id === baselineId) ?? null;

  const go = (next: { p?: string; vs?: string }) => {
    const params = new URLSearchParams();
    const p = next.p ?? selectedId ?? "";
    const vs = next.vs ?? baselineId;
    if (p) params.set("p", p);
    if (vs) params.set("vs", vs);
    router.push(`/w/${slug}/roadmap/plateaus${params.size ? `?${params}` : ""}`);
  };

  return (
    <section className="studio-home-main roadmap" aria-label="Plateaus">
      <header className="studio-home-topbar">
        <div>
          <span>Change over time</span>
          <h1>Plateaus</h1>
          <p className="roadmap-lede">
            A plateau is a state of the estate somebody can name: today, plus the change sets that have landed by then.
            It stores a name, a date and a membership — never a copy of the graph — so unlike the slide it replaces, it
            cannot drift from the model.
          </p>
        </div>
        <div className="studio-home-actions">
          <button type="button" className="primary-home-button" onClick={() => setCreating(true)} data-new-plateau><Plus size={16} /> New plateau</button>
        </div>
      </header>

      <RoadmapTabs slug={slug} active="plateaus" />

      {message && <p className="roadmap-message">{message}</p>}

      {creating && (
        <NewPlateau
          pending={pending}
          onCancel={() => setCreating(false)}
          onCreate={(input) => start(async () => {
            const r = await createPlateau({ workspaceId, ...input });
            setCreating(false);
            go({ p: r.id });
          })}
        />
      )}

      <ol className="plateau-strip" data-plateau-strip>
        <li className={baselineId === "" ? "active" : ""}>
          <button type="button" onClick={() => go({ vs: "" })} title="Compare against the estate as it is today">
            <small><CalendarDays size={11} /> today</small>
            <strong>As-is</strong>
            <span>{asIs.entities} objects · {asIs.relations} relations</span>
            <em className={band(asIs.health)}>health {asIs.health}</em>
          </button>
        </li>
        {plateaus.map((p) => (
          <li key={p.id} className={p.id === selectedId ? "selected" : p.id === baselineId ? "active" : ""}>
            <button type="button" onClick={() => go({ p: p.id })} data-plateau={p.id}>
              <small><Flag size={11} /> {p.targetDate || "undated"}</small>
              <strong>{p.name}</strong>
              <span>{p.entities} objects · {p.relations} relations</span>
              <em className={band(p.health)}>health {p.health}</em>
            </button>
          </li>
        ))}
      </ol>

      {plateaus.length === 0 && !creating && (
        <div className="roadmap-empty">
          <p>
            No plateaus yet. Name the states you talk about — “after the platform migration”, “target 2028” — and pick
            which change sets have landed by each. The tool will then tell you what actually differs between them, and
            what the estate scores at each one.
          </p>
          <button type="button" className="primary-home-button" onClick={() => setCreating(true)}><Plus size={16} /> New plateau</button>
        </div>
      )}

      {selected && (
        <>
          <div className="plateau-detail" data-plateau-detail>
            <div className="plateau-detail-head">
              <div>
                <h2>{selected.name}</h2>
                {selected.description && <p>{selected.description}</p>}
              </div>
              <div className="plateau-detail-actions">
                <label className="roadmap-status-picker">
                  Date
                  <input type="date" defaultValue={selected.targetDate} disabled={pending} onChange={(e) => start(async () => { await updatePlateau(selected.id, { targetDate: e.target.value }); })} />
                </label>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete the plateau “${selected.name}”? The change sets in it are not affected.`)) return;
                    start(async () => { await deletePlateau(selected.id); go({ p: "" }); });
                  }}
                ><Trash2 size={14} /> Delete</button>
              </div>
            </div>

            {selected.incoherent.length > 0 && (
              <div className="roadmap-problems">
                <b><AlertTriangle size={13} /> This state cannot happen as it stands</b>
                <ul>
                  {selected.incoherent.map((i) => (
                    <li key={i.name}>“{i.name}” waits for {i.missing.map((m) => `“${m}”`).join(", ")}, which {i.missing.length === 1 ? "is" : "are"} not in this plateau.</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="plateau-members">
              <b><Layers size={12} /> Landed by then</b>
              {selected.members.length === 0 ? (
                <span className="roadmap-depends-none">nothing yet — this state is the same as today</span>
              ) : (
                <ul>
                  {selected.members.map((m) => (
                    <li key={m.id}>
                      <span>{m.name}</span>
                      <small>{m.status}</small>
                      <button type="button" className="ghost-button" disabled={pending} aria-label={`Remove ${m.name}`} onClick={() => start(async () => {
                        const r = await excludeFromPlateau(selected.id, m.id);
                        if ("error" in r) setMessage(r.error);
                      })}><Minus size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <IncludePicker
                pending={pending}
                options={changeSets.filter((c) => !selected.members.some((m) => m.id === c.id))}
                onInclude={(id) => start(async () => {
                  const r = await includeInPlateau(selected.id, id);
                  if ("error" in r) setMessage(r.error);
                  else if (r.alsoIncluded > 0) setMessage(`Added, along with ${r.alsoIncluded} change set${r.alsoIncluded === 1 ? "" : "s"} it waits for.`);
                })}
              />
            </div>
          </div>

          {diff && (
            <div className="plateau-diff" data-diff>
              <div className="plateau-diff-head">
                <h2>
                  <span>{baseline?.name ?? "As-is"}</span>
                  <ArrowRight size={16} />
                  <span>{selected.name}</span>
                </h2>
                <label className="roadmap-status-picker">
                  Compare with
                  <select value={baselineId} disabled={pending} onChange={(e) => go({ vs: e.target.value })}>
                    <option value="">As-is — today</option>
                    {plateaus.filter((p) => p.id !== selected.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              </div>
              <p className="plateau-diff-summary">{diff.summary}</p>
              <div className="plateau-diff-health">
                <span>Estate health</span>
                <b className={band(baseline?.health ?? asIs.health)}>{baseline?.health ?? asIs.health}</b>
                <ArrowRight size={13} />
                <b className={band(selected.health)}>{selected.health}</b>
                <em>{selected.health >= (baseline?.health ?? asIs.health) ? "better" : "worse"} by {Math.abs(selected.health - (baseline?.health ?? asIs.health))}</em>
              </div>

              <div className="plateau-diff-columns">
                <DiffColumn title="Arrives" tone="added" items={diff.added.map((e) => ({ id: e.id, main: e.name, sub: e.kind }))} more={diff.addedMore} empty="Nothing new." />
                <DiffColumn title="Goes" tone="removed" items={diff.removed.map((e) => ({ id: e.id, main: e.name, sub: e.kind }))} more={diff.removedMore} empty="Nothing is retired." />
                <DiffColumn
                  title="Changes"
                  tone="changed"
                  items={[
                    ...diff.renamed.map((r) => ({ id: r.id, main: r.after, sub: `was ${r.before}` })),
                    ...diff.attributes.map((a) => ({ id: a.id, main: a.name, sub: `${a.key}: ${a.before || "—"} → ${a.after || "—"}` })),
                  ]}
                  more={diff.attributesMore}
                  empty="Nothing changes hands."
                />
              </div>
              <p className="plateau-diff-relations">
                <Sparkles size={12} /> {diff.relationsAdded} connection{diff.relationsAdded === 1 ? "" : "s"} made, {diff.relationsRemoved} severed.
                {" "}
                <Link href={`/w/${slug}/roadmap`}>See the change sets behind this</Link>.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const band = (score: number) => (score >= 90 ? "good" : score >= 70 ? "fair" : score >= 50 ? "poor" : "bad");

function DiffColumn({ title, tone, items, more, empty }: {
  title: string;
  tone: "added" | "removed" | "changed";
  items: Array<{ id: string; main: string; sub: string }>;
  more: number;
  empty: string;
}) {
  return (
    <section className={`plateau-diff-column ${tone}`}>
      <h3>{title} <em>{items.length + more}</em></h3>
      {items.length === 0 ? (
        <p className="plateau-diff-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.id}><b>{i.main}</b><small>{i.sub}</small></li>
          ))}
          {more > 0 && <li className="plateau-diff-more">and {more} more</li>}
        </ul>
      )}
    </section>
  );
}

function IncludePicker({ options, pending, onInclude }: {
  options: Array<{ id: string; name: string; status: ChangeSetStatus; targetDate: string }>;
  pending: boolean;
  onInclude: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  if (!options.length) return null;
  return (
    <div className="roadmap-depends-add" data-include>
      <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Add a change set to this plateau">
        <option value="">Add a change set…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.targetDate ? ` · ${o.targetDate}` : ""}</option>)}
      </select>
      <button type="button" className="ghost-button" disabled={pending || !value} onClick={() => { onInclude(value); setValue(""); }}><Plus size={13} /> Add</button>
    </div>
  );
}

function NewPlateau({ pending, onCancel, onCreate }: {
  pending: boolean;
  onCancel: () => void;
  onCreate: (input: { name: string; description: string; targetDate: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  return (
    <form className="roadmap-new" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate({ name, description, targetDate }); }}>
      <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Target architecture 2028" autoFocus /></label>
      <label className="field"><span>Date</span><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
      <label className="field wide"><span>What holds true at this state</span><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One paragraph. What is true of the estate here that is not true today." /></label>
      <div className="roadmap-new-actions">
        <button type="submit" className="primary-home-button" disabled={pending || !name.trim()}>Create</button>
        <button type="button" className="ghost-button" onClick={onCancel}><X size={14} /> Cancel</button>
      </div>
    </form>
  );
}
