"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle, CalendarDays, Check, ChevronDown, ChevronRight, GitBranch, Link2,
  Lock, Plus, Rocket, Sparkles, Trash2, TrendingDown, TrendingUp, Unlink, X,
} from "lucide-react";
import { addChange, addDependency, createChangeSet, deleteChangeSet, deliverChangeSet, removeChange, removeDependency, updateChangeSet } from "@/lib/change/actions";
import { OP_LABEL, STATUS_LABEL, type ChangeOp, type ChangeSetStatus, type ChangeSummary } from "@/lib/change/types";
import type { Nature } from "@/lib/change/impact";
import { RoadmapTabs } from "./RoadmapTabs";

/**
 * The roadmap.
 *
 * A change set is a named, dated set of intentions about the estate; it is not applied to the
 * graph until somebody delivers it. So this screen has to make two things obvious at a glance:
 * what each plan does, and what it would break. The second is the reason to model an estate at
 * all, and it is the thing a spreadsheet of applications can never answer.
 */

export interface EntityOption {
  id: string;
  name: string;
  kind: string;
}

export interface ChangeSetView {
  id: string;
  name: string;
  description: string;
  status: ChangeSetStatus;
  targetDate: string;
  deliveredAt: string | null;
  summary: ChangeSummary;
  problems: Array<{ changeId: string; message: string }>;
  /** What this waits for, in the words of the roadmap. */
  dependsOn: Array<{ id: string; name: string; status: ChangeSetStatus }>;
  /** Of those, the ones still in the way — transitively, and including abandoned ones. */
  blockedBy: Array<{ id: string; name: string; reason: "not delivered" | "abandoned" }>;
  /** Dated before something it waits for. A contradiction worth pointing at, not an error. */
  scheduleWarning: string | null;
  changes: Array<{ id: string; op: ChangeOp; note: string; entityId: string | null; subject: string; detail: string }>;
  impact: {
    summary: string;
    dependants: Array<{ id: string; name: string; kind: string; nature: Nature; orphaned: boolean }>;
    more: number;
    orphaned: number;
    indirect: number;
  } | null;
}

const OP_ICON: Record<ChangeOp, React.ReactNode> = {
  addEntity: <Plus size={13} />,
  retireEntity: <Trash2 size={13} />,
  setAttribute: <Sparkles size={13} />,
  addRelation: <Link2 size={13} />,
  removeRelation: <Unlink size={13} />,
};

const NATURE_LABEL: Record<Nature, string> = {
  "depends-on": "depends on it",
  "served-by": "is served by it",
  supplies: "feeds it",
  connected: "is connected to it",
};

export function Roadmap({ workspaceId, slug, sets, entities, order, asIs, toBe }: {
  workspaceId: string;
  slug: string;
  sets: ChangeSetView[];
  entities: EntityOption[];
  /** Delivery order — blockers before dependents — used to number the plans. */
  order: string[];
  asIs: { entities: number; relations: number };
  toBe: { entities: number; relations: number };
}) {
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(sets[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);

  const delta = { entities: toBe.entities - asIs.entities, relations: toBe.relations - asIs.relations };
  const planned = sets.filter((s) => s.status === "draft" || s.status === "planned");
  const position = new Map(order.map((id, i) => [id, i + 1]));
  const blockedCount = sets.filter((s) => s.status !== "delivered" && s.blockedBy.length > 0).length;

  return (
    <section className="studio-home-main roadmap" aria-label="Roadmap">
      <header className="studio-home-topbar">
        <div>
          <span>Change over time</span>
          <h1>Roadmap</h1>
          <p className="roadmap-lede">
            The graph is the estate as it is. A change set is what you intend to do to it — and it stays intent
            until you deliver it, so a plan is free to be wrong without the record of today becoming wrong with it.
          </p>
        </div>
        <div className="studio-home-actions">
          <button type="button" className="primary-home-button" onClick={() => setCreating(true)} data-new-change-set>
            <Plus size={16} /> New change set
          </button>
        </div>
      </header>

      <RoadmapTabs slug={slug} active="changes" />

      <div className="roadmap-states" data-states>
        <div className="roadmap-state">
          <small>As-is</small>
          <b>{asIs.entities}</b>
          <span>objects · {asIs.relations} relations</span>
        </div>
        <div className="roadmap-arrow" aria-hidden>
          <GitBranch size={18} />
          <em>
            {planned.length} change set{planned.length === 1 ? "" : "s"} planned
            {blockedCount > 0 && <><br />{blockedCount} waiting on another</>}
          </em>
        </div>
        <div className="roadmap-state to-be">
          <small>To-be, if everything planned lands</small>
          <b>{toBe.entities}</b>
          <span>
            objects · {toBe.relations} relations
            {(delta.entities !== 0 || delta.relations !== 0) && (
              <i className={delta.entities < 0 ? "down" : "up"}>
                {delta.entities < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                {delta.entities >= 0 ? "+" : ""}{delta.entities} objects, {delta.relations >= 0 ? "+" : ""}{delta.relations} relations
              </i>
            )}
          </span>
        </div>
      </div>

      {message && <p className="roadmap-message">{message}</p>}
      {creating && (
        <NewChangeSet
          workspaceId={workspaceId}
          pending={pending}
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            start(async () => {
              const r = await createChangeSet(input);
              setOpenId(r.id);
              setCreating(false);
            });
          }}
        />
      )}

      {sets.length === 0 && !creating && (
        <div className="roadmap-empty">
          <p>
            No change sets yet. A roadmap here is not a slide: it is the systems you will introduce, the ones you
            will retire and what changes hands — held against the real graph, so the tool can tell you what each
            one breaks.
          </p>
          <button type="button" className="primary-home-button" onClick={() => setCreating(true)}><Plus size={16} /> New change set</button>
        </div>
      )}

      <ol className="roadmap-timeline">
        {sets.map((set) => (
          <li key={set.id} className={`roadmap-item ${set.status}`} data-change-set={set.id}>
            <div className="roadmap-when">
              <CalendarDays size={13} />
              {set.targetDate || "undated"}
            </div>
            <article className="roadmap-card">
              <button type="button" className="roadmap-card-head" onClick={() => setOpenId(openId === set.id ? null : set.id)} aria-expanded={openId === set.id}>
                {openId === set.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span className="roadmap-order" title="Delivery order: blockers before dependents">{position.get(set.id) ?? "—"}</span>
                <strong>{set.name}</strong>
                <i className={`roadmap-status ${set.status}`}>{STATUS_LABEL[set.status]}</i>
                {set.status !== "delivered" && set.blockedBy.length > 0 && (
                  <i className="roadmap-status blocked" title={set.blockedBy.map((b) => b.name).join(", ")}><Lock size={10} /> waiting</i>
                )}
                <SummaryChips summary={set.summary} />
              </button>

              {openId === set.id && (
                <div className="roadmap-card-body">
                  {set.description && <p className="roadmap-description">{set.description}</p>}

                  {set.scheduleWarning && (
                    <p className="roadmap-schedule-warning"><CalendarDays size={13} /> {set.scheduleWarning}</p>
                  )}

                  <Dependencies
                    set={set}
                    all={sets}
                    pending={pending}
                    onAdd={(dependsOnId) => start(async () => {
                      const r = await addDependency(set.id, dependsOnId);
                      if ("error" in r) setMessage(r.error);
                    })}
                    onRemove={(dependsOnId) => start(async () => { await removeDependency(set.id, dependsOnId); })}
                  />

                  {set.problems.length > 0 && (
                    <div className="roadmap-problems">
                      <b><AlertTriangle size={13} /> {set.problems.length} change{set.problems.length === 1 ? "" : "s"} no longer fit the graph</b>
                      <ul>{set.problems.map((p) => <li key={p.changeId}>{p.message}</li>)}</ul>
                    </div>
                  )}

                  {set.impact && (
                    <div className="roadmap-impact" data-impact>
                      <b>What it breaks</b>
                      <p>{set.impact.summary}</p>
                      {set.impact.dependants.length > 0 && (
                        <ul>
                          {set.impact.dependants.map((d) => (
                            <li key={d.id}>
                              <span className={`impact-nature ${d.nature}`}>{NATURE_LABEL[d.nature]}</span>
                              <b>{d.name}</b>
                              <small>{d.kind}</small>
                              {d.orphaned && <em>left connected to nothing</em>}
                            </li>
                          ))}
                          {set.impact.more > 0 && <li className="impact-more">and {set.impact.more} more</li>}
                        </ul>
                      )}
                    </div>
                  )}

                  <ul className="roadmap-changes">
                    {set.changes.map((change) => (
                      <li key={change.id} data-change>
                        <span className={`change-op ${change.op}`}>{OP_ICON[change.op]} {OP_LABEL[change.op]}</span>
                        <b>{change.subject}</b>
                        {change.detail && <small>{change.detail}</small>}
                        {change.note && <em>{change.note}</em>}
                        {set.status !== "delivered" && (
                          <button type="button" className="ghost-button" disabled={pending} aria-label="Remove this change" onClick={() => start(async () => { await removeChange(change.id); })}>
                            <X size={13} />
                          </button>
                        )}
                      </li>
                    ))}
                    {set.changes.length === 0 && <li className="roadmap-no-changes">Nothing in this change set yet.</li>}
                  </ul>

                  {set.status !== "delivered" && (
                    <AddChange changeSetId={set.id} entities={entities} pending={pending} start={start} />
                  )}

                  <div className="roadmap-actions">
                    {set.status !== "delivered" && (
                      <>
                        <label className="roadmap-status-picker">
                          Status
                          <select
                            value={set.status}
                            disabled={pending}
                            onChange={(e) => start(async () => {
                              const r = await updateChangeSet(set.id, { status: e.target.value as ChangeSetStatus });
                              if (r && "error" in r) setMessage(r.error);
                            })}
                          >
                            <option value="draft">Draft</option>
                            <option value="planned">Planned</option>
                            <option value="abandoned">Abandoned</option>
                          </select>
                        </label>
                        <label className="roadmap-status-picker">
                          Target
                          <input
                            type="date"
                            defaultValue={set.targetDate}
                            disabled={pending}
                            onChange={(e) => start(async () => { await updateChangeSet(set.id, { targetDate: e.target.value }); })}
                          />
                        </label>
                        <button
                          type="button"
                          className="primary-home-button"
                          disabled={pending || set.changes.length === 0 || set.blockedBy.length > 0}
                          title={set.blockedBy.length ? `Waiting for ${set.blockedBy.map((b) => b.name).join(", ")}` : undefined}
                          data-deliver
                          onClick={() => {
                            const s2 = set.summary;
                            const warning = `Deliver “${set.name}”? This applies it to the graph: ${s2.additions} introduced, ${s2.retirements} retired, ${s2.attributeChanges} changed, ${s2.severedRelations} relations severed. Retired systems keep their node with lifecycle “retired”.`;
                            if (!confirm(warning)) return;
                            start(async () => {
                              const r = await deliverChangeSet(set.id);
                              setMessage("error" in r ? r.error : `Delivered: ${r.introduced} introduced, ${r.retired} retired, ${r.altered} changed, ${r.connected} connected, ${r.severed} relations severed.`);
                            });
                          }}
                        >
                          <Rocket size={14} /> Deliver
                        </button>
                      </>
                    )}
                    {set.status === "delivered" && (
                      <span className="roadmap-delivered"><Check size={14} /> Delivered {set.deliveredAt?.slice(0, 10)} — the graph carries this now.</span>
                    )}
                    <a className="ghost-button" href={`/w/${slug}/graph`}>Open the graph</a>
                    {set.status !== "delivered" && (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Delete “${set.name}” and its ${set.changes.length} change${set.changes.length === 1 ? "" : "s"}?`)) return;
                          start(async () => { await deleteChangeSet(set.id); });
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * What this plan waits for.
 *
 * Shown on every change set, not just the ones that have a dependency, because the absence of one
 * is also information — a plan that waits for nothing is a plan somebody can start.
 */
function Dependencies({ set, all, pending, onAdd, onRemove }: {
  set: ChangeSetView;
  all: ChangeSetView[];
  pending: boolean;
  onAdd: (dependsOnId: string) => void;
  onRemove: (dependsOnId: string) => void;
}) {
  const [adding, setAdding] = useState("");
  const taken = new Set([set.id, ...set.dependsOn.map((d) => d.id)]);
  const candidates = all.filter((c) => !taken.has(c.id));
  const blocked = new Set(set.blockedBy.map((b) => b.id));

  return (
    <div className="roadmap-depends" data-depends>
      <b><Lock size={12} /> Waits for</b>
      {set.dependsOn.length === 0 ? (
        <span className="roadmap-depends-none">nothing — this can start whenever you like</span>
      ) : (
        <ul>
          {set.dependsOn.map((d) => (
            <li key={d.id} className={blocked.has(d.id) ? "outstanding" : "satisfied"}>
              <span>{d.name}</span>
              <small>{d.status === "delivered" ? "delivered" : d.status === "abandoned" ? "abandoned — this plan is stranded" : "not delivered yet"}</small>
              {set.status !== "delivered" && (
                <button type="button" className="ghost-button" disabled={pending} aria-label={`Stop waiting for ${d.name}`} onClick={() => onRemove(d.id)}><X size={12} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {set.status !== "delivered" && candidates.length > 0 && (
        <div className="roadmap-depends-add">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Wait for another change set">
            <option value="">Wait for…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="ghost-button" disabled={pending || !adding} onClick={() => { onAdd(adding); setAdding(""); }}>Add</button>
        </div>
      )}
    </div>
  );
}

function SummaryChips({ summary }: { summary: ChangeSummary }) {
  const chips: Array<[number, string]> = [
    [summary.additions, "introduced"],
    [summary.retirements, "retired"],
    [summary.attributeChanges, "changed"],
    [summary.newRelations, "connected"],
    [summary.severedRelations, "severed"],
  ];
  return (
    <span className="roadmap-chips">
      {chips.filter(([n]) => n > 0).map(([n, label]) => <em key={label}>{n} {label}</em>)}
      {summary.problems > 0 && <em className="warn">{summary.problems} stale</em>}
      {chips.every(([n]) => n === 0) && <em className="muted">empty</em>}
    </span>
  );
}

function NewChangeSet({ workspaceId, pending, onCancel, onCreate }: {
  workspaceId: string;
  pending: boolean;
  onCancel: () => void;
  onCreate: (input: { workspaceId: string; name: string; description: string; targetDate: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  return (
    <form
      className="roadmap-new"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate({ workspaceId, name, description, targetDate });
      }}
    >
      <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Retire Maximo, move work orders to SAP PM" autoFocus /></label>
      <label className="field"><span>Target date</span><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
      <label className="field wide"><span>What is this change, and why</span><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One paragraph. The reasoning is the part somebody will need in two years." /></label>
      <div className="roadmap-new-actions">
        <button type="submit" className="primary-home-button" disabled={pending || !name.trim()}>Create</button>
        <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** Adding one intention. Deliberately four narrow forms rather than one clever one. */
function AddChange({ changeSetId, entities, pending, start }: {
  changeSetId: string;
  entities: EntityOption[];
  pending: boolean;
  start: (fn: () => void) => void;
}) {
  const [op, setOp] = useState<ChangeOp>("retireEntity");
  const [entityId, setEntityId] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Application");
  const [key, setKey] = useState("owner");
  const [value, setValue] = useState("");
  const [toId, setToId] = useState("");
  const [relationKind, setRelationKind] = useState("depends on");
  const [note, setNote] = useState("");

  const submit = () => {
    const payload =
      op === "addEntity" ? { kind, name }
        : op === "setAttribute" ? { key, value }
          : op === "addRelation" ? { fromEntityId: entityId, toEntityId: toId, kind: relationKind }
            : {};
    if (op === "addEntity" && !name.trim()) return;
    if (op !== "addEntity" && !entityId) return;
    if (op === "addRelation" && !toId) return;
    start(async () => {
      await addChange({ changeSetId, op, entityId: op === "addEntity" ? null : entityId, payload, note });
      setNote("");
      setName("");
      setValue("");
    });
  };

  return (
    <div className="roadmap-add" data-add-change>
      <select value={op} onChange={(e) => setOp(e.target.value as ChangeOp)} aria-label="What kind of change">
        <option value="retireEntity">Retire a system</option>
        <option value="addEntity">Introduce something new</option>
        <option value="setAttribute">Change an attribute</option>
        <option value="addRelation">Connect two things</option>
      </select>

      {op === "addEntity" ? (
        <>
          <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Kind" aria-label="Kind" className="roadmap-add-kind" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" />
        </>
      ) : (
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)} aria-label="Which object">
          <option value="">Choose an object…</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name}{e.kind ? ` · ${e.kind}` : ""}</option>)}
        </select>
      )}

      {op === "setAttribute" && (
        <>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Attribute" aria-label="Attribute key" className="roadmap-add-kind" />
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="New value (empty clears it)" aria-label="Attribute value" />
        </>
      )}

      {op === "addRelation" && (
        <>
          <input value={relationKind} onChange={(e) => setRelationKind(e.target.value)} placeholder="Relation" aria-label="Relation kind" className="roadmap-add-kind" />
          <select value={toId} onChange={(e) => setToId(e.target.value)} aria-label="To which object">
            <option value="">…to</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </>
      )}

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (optional)" aria-label="Why" className="roadmap-add-note" />
      <button type="button" className="ghost-button" disabled={pending} onClick={submit}><Plus size={13} /> Add</button>
    </div>
  );
}
