"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Bot, Check, Play, Save, Sparkles, Trash2 } from "lucide-react";
import { createAgent, removeAgent, runAgent, scopeSize, setAgentStatus, suggestAgents, updateAgent } from "@/lib/agent/definition-actions";
import {
  CONSEQUENTIAL,
  GROUNDINGS,
  GROUNDING_LABEL,
  STATUSES,
  STATUS_NOTE,
  VERBS,
  VERB_LABEL,
  type AgentDefinition,
  type AgentStatus,
  type Grounding,
  type Verb,
} from "@/lib/agent/definition";
import type { RunSummary } from "@/lib/agent/fleet-types";

/**
 * Writing an agent down.
 *
 * Every field on this form is the answer to a question somebody will be asked about the fleet:
 * what is it for, who is answerable for it, what may it read, what may it say, what may it spend.
 * The form is therefore not a wrapper around a config file — it is the governance, and the
 * refusals are written to teach rather than to scold.
 *
 * The one deliberate friction: a new agent starts as a **draft**, which runs but says nothing. You
 * read its first opinions before you give it a voice, exactly as you would with a new colleague.
 */

const STATUS_CLASS: Record<AgentStatus, string> = { proposed: "warn", draft: "unknown", active: "ok", paused: "warn", retired: "off" };

export function AgentEditor({ slug, workspaceId, teams, providers, agent, runs }: {
  slug: string;
  workspaceId: string;
  teams: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string; enabled: boolean }>;
  agent: AgentDefinition | null;
  runs: RunSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(agent?.name ?? "");
  const [purpose, setPurpose] = useState(agent?.purpose ?? "");
  const [ownerTeamId, setOwnerTeamId] = useState(agent?.ownerTeamId ?? teams[0]?.id ?? "");
  const [scope, setScope] = useState(agent?.scope ?? "");
  const [verbs, setVerbs] = useState<Verb[]>(agent?.verbs ?? ["setKind"]);
  const [grounding, setGrounding] = useState<Grounding>(agent?.grounding ?? "modelling");
  const [providerId, setProviderId] = useState(agent?.providerId ?? "");
  const [model, setModel] = useState(agent?.model ?? "");
  const [runsPerDay, setRunsPerDay] = useState(agent?.budget.runsPerDay ?? 12);
  const [maxProposals, setMaxProposals] = useState(agent?.budget.maxProposals ?? 15);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [matches, setMatches] = useState<{ count: number; explanation: string } | null>(null);

  const input = {
    name,
    purpose,
    ownerTeamId: ownerTeamId || null,
    scope,
    verbs: verbs as string[],
    grounding,
    providerId: providerId || null,
    model,
    budget: { runsPerDay, maxProposals },
    status: agent?.status ?? "draft",
  };

  const toggle = (verb: Verb) => setVerbs((was) => (was.includes(verb) ? was.filter((v) => v !== verb) : [...was, verb]));

  const check = () => {
    setMatches(null);
    start(async () => setMatches(await scopeSize(workspaceId, scope)));
  };

  const save = () => {
    setMessage(null);
    setWarnings([]);
    start(async () => {
      const result = agent ? await updateAgent(agent.id, input) : await createAgent(workspaceId, input);
      if ("error" in result) { setMessage(result.error); return; }
      setWarnings("warnings" in result ? result.warnings : []);
      if ("id" in result) router.push(`/w/${slug}/agents/${result.id}`);
      else router.refresh();
    });
  };

  const changeStatus = (status: AgentStatus) => {
    if (!agent) return;
    setMessage(null);
    start(async () => {
      const result = await setAgentStatus(agent.id, status);
      if ("error" in result) setMessage(result.error);
      router.refresh();
    });
  };

  /**
   * Asking this agent what agent is missing. Its own verbs and budget are the ceiling for anything
   * it suggests, so a narrow agent can only ever propose a narrower one.
   */
  const suggest = () => {
    if (!agent) return;
    setMessage(null);
    setWarnings([]);
    start(async () => {
      const result = await suggestAgents(workspaceId, agent.id);
      if ("error" in result) setMessage(result.error);
      else {
        setMessage(
          result.suggested === 0
            ? result.note || "It could not see an agent worth adding within what it may do itself."
            : `${result.suggested} suggested, waiting for approval on the Agents page.`,
        );
        setWarnings(result.rejected);
      }
      router.refresh();
    });
  };

  const run = () => {
    if (!agent) return;
    setMessage(null);
    start(async () => {
      const result = await runAgent(agent.id);
      // A run that never started and a run that failed both come back with something to say; only
      // the shape differs, and the reader should not have to care which.
      if (!("outcome" in result)) setMessage(result.error);
      else if (result.outcome === "failed") setMessage(result.error ?? "the model could not be reached");
      else if (result.outcome === "refused") setMessage(result.note);
      router.refresh();
    });
  };

  return (
    <section className="studio-home-main" aria-label={agent ? agent.name : "Describe an agent"}>
      <header className="studio-home-topbar">
        <div>
          <span><Link href={`/w/${slug}/agents`} className="agent-back"><ArrowLeft size={11} /> Agents</Link></span>
          <h1>{agent ? agent.name : "Describe an agent"}</h1>
          <p className="roadmap-lede">
            {agent
              ? STATUS_NOTE[agent.status]
              : "An agent is a purpose, an owner, what it may read, what it may propose and what it may spend. It starts as a draft: it runs, and you read what it would have said before it is allowed to say it."}
          </p>
        </div>
        {agent && <i className={`model-status ${STATUS_CLASS[agent.status]}`} data-agent-status>{agent.status}</i>}
      </header>

      {message && <p className="agent-fleet-warning" data-agent-message><AlertTriangle size={13} /> {message}</p>}
      {warnings.map((w) => <p key={w} className="model-env" data-agent-warning>{w}</p>)}

      <div className="agent-form" data-agent-form>
        <label className="agent-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vocabulary reviewer" aria-label="Agent name" data-agent-name />
        </label>

        <label className="agent-field">
          <span>What it is for</span>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            placeholder="Find objects whose kind is spelled two ways, and say which spelling this workspace uses."
            aria-label="What this agent is for"
            data-agent-purpose
          />
          <small>This sentence is the instruction it gets. Two agents are two agents because of what is written here.</small>
        </label>

        <div className="agent-field-row">
          <label className="agent-field">
            <span>Owner</span>
            <select value={ownerTeamId} onChange={(e) => setOwnerTeamId(e.target.value)} aria-label="Owning team">
              <option value="">choose a team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <small>Somebody has to be answerable for it.</small>
          </label>

          <label className="agent-field">
            <span>Grounded in</span>
            <select value={grounding} onChange={(e) => setGrounding(e.target.value as Grounding)} aria-label="Grounding">
              {GROUNDINGS.map((g) => <option key={g || "none"} value={g}>{GROUNDING_LABEL[g]}</option>)}
            </select>
            <small>Doctrine from the EA knowledge base, cited in what it proposes.</small>
          </label>
        </div>

        <label className="agent-field">
          <span>What it may read</span>
          <div className="agent-scope">
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder='kind:Application missing:owner'
              aria-label="Scope query"
              data-agent-scope
            />
            <button type="button" className="ghost-button" disabled={pending || !scope.trim()} onClick={check}>Count them</button>
          </div>
          <small>
            A graph query — <code>kind:Application</code>, <code>missing:owner</code>, <code>on:&quot;OT landscape&quot;</code>.
            Write <code>*</code> only for an agent that really should read the whole model.
          </small>
          {matches && <p className="agent-scope-count" data-scope-count>{matches.count} object{matches.count === 1 ? "" : "s"} — {matches.explanation}</p>}
        </label>

        <fieldset className="agent-field">
          <span>What it may propose</span>
          <div className="agent-verbs">
            {VERBS.map((verb) => (
              <label key={verb} className={verbs.includes(verb) ? "on" : ""} data-verb={verb}>
                <input type="checkbox" checked={verbs.includes(verb)} onChange={() => toggle(verb)} />
                <b>{verb}</b>
                <span>{VERB_LABEL[verb]}{CONSEQUENTIAL.has(verb) ? " — hard to unpick afterwards" : ""}</span>
              </label>
            ))}
          </div>
          <small>Nothing here writes anything: every one of them is a proposal a person still has to accept.</small>
        </fieldset>

        <div className="agent-field-row">
          <label className="agent-field">
            <span>Model</span>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} aria-label="Model provider">
              <option value="">whatever the graph agent uses</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.enabled ? "" : " (disabled)"}</option>)}
            </select>
            <small><Link href={`/w/${slug}/settings/models`}>Settings → Models</Link> decides the default.</small>
          </label>
          <label className="agent-field">
            <span>Model id</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="same as the provider" aria-label="Model id" />
          </label>
        </div>

        <div className="agent-field-row">
          <label className="agent-field">
            <span>Runs a day</span>
            <input type="number" min={1} max={96} value={runsPerDay} onChange={(e) => setRunsPerDay(Number(e.target.value))} aria-label="Runs a day" />
          </label>
          <label className="agent-field">
            <span>Proposals a run</span>
            <input type="number" min={1} max={40} value={maxProposals} onChange={(e) => setMaxProposals(Number(e.target.value))} aria-label="Proposals a run" />
            <small>A reviewer who is shown forty stops reading.</small>
          </label>
        </div>

        <div className="agent-form-actions">
          <button type="button" className="primary-home-button" disabled={pending} onClick={save} data-agent-save>
            <Save size={13} /> {agent ? "Save" : "Create as a draft"}
          </button>
          {agent && (
            <>
              <button type="button" className="ghost-button" disabled={pending} onClick={run} data-agent-run>
                <Play size={13} /> {agent.status === "draft" ? "Dry run" : "Run now"}
              </button>
              {agent.status !== "proposed" && (
                <button type="button" className="ghost-button" disabled={pending} onClick={suggest} data-agent-suggest title="What agent is this workspace missing? It may not suggest one that can do more than it can.">
                  <Sparkles size={13} /> Ask what is missing
                </button>
              )}
              {STATUSES.filter((st) => st !== agent.status && st !== "proposed").map((st) => (
                <button key={st} type="button" className="ghost-button" disabled={pending} data-set-status={st} onClick={() => changeStatus(st)}>
                  {st === "active" ? <><Check size={13} /> Give it a voice</> : st === "draft" ? "Back to draft" : st === "paused" ? "Pause" : "Retire"}
                </button>
              ))}
              <button
                type="button"
                className="ghost-button"
                disabled={pending}
                onClick={() => { if (confirm(`Delete “${agent.name}”? Its runs go with it; anything a person already accepted stays in the model.`)) start(async () => { await removeAgent(agent.id); router.push(`/w/${slug}/agents`); }); }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {agent && (
        <section className="agent-runs" aria-label="Runs">
          <h2>Runs</h2>
          <p>Every run, whatever happened — including the ones a budget or a pause refused before they cost anything.</p>
          {runs.length === 0 ? (
            <div className="roadmap-empty"><p>It has not run yet. A dry run costs one call and tells you more than any amount of rewriting the sentence above.</p></div>
          ) : (
            <ol className="agent-run-list" data-agent-runs>
              {runs.map((r) => (
                <li key={r.id} className={`agent-run ${r.outcome}`} data-run={r.id}>
                  <header>
                    <b>{new Date(r.createdAt).toLocaleString()}</b>
                    <i className={`model-status ${r.outcome === "ok" ? "ok" : r.outcome === "refused" ? "unknown" : "bad"}`}>{r.dryRun && r.outcome === "ok" ? "dry run" : r.outcome}</i>
                    <span>{r.objectsRead} object{r.objectsRead === 1 ? "" : "s"} read{r.model ? ` · ${r.model}` : ""}{r.ms ? ` · ${(r.ms / 1000).toFixed(1)}s` : ""}</span>
                  </header>
                  {r.note && <p className="agent-run-note">{r.note}</p>}
                  {r.error && <p className="agent-run-error">{r.error}</p>}
                  {r.proposals.length > 0 && (
                    <ul className="agent-run-proposals">
                      {r.proposals.map((p, i) => (
                        <li key={i}>
                          <b>{p.title}</b>
                          <span>{p.detail}</span>
                          {p.evidence[0] && <em>{p.evidence[0]}</em>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.detail.length > 0 && (
                    <details className="agent-run-dropped">
                      <summary>{r.detail.length} thrown away in checking</summary>
                      <ul>{r.detail.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </details>
                  )}
                  {r.dryRun && r.outcome === "ok" && (
                    <p className="agent-run-dry"><Bot size={12} /> This was a dry run: nothing reached the review queue. Give it a voice above when you like what it says.</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </section>
  );
}
