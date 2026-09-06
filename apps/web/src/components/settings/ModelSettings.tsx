"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Cpu, Info, KeyRound, Plus, ServerCog, Trash2, Wifi, X } from "lucide-react";
import { addProvider, assignTask, checkProvider, removeProvider, updateProvider } from "@/lib/models/actions";
import { PRESETS, TASKS, TASK_LABEL, type Dialect, type Provider, type Task } from "@/lib/models/types";

/**
 * Choosing what Nexus thinks with.
 *
 * Three things this screen has to do that a settings page usually does not.
 *
 * It has to make a **sovereign** deployment a first-class choice rather than an escape hatch — a
 * model on the organisation's own hardware sits in the same list as Anthropic, described the same
 * way, and needs no key.
 *
 * It has to be **honest about the key**. If `NEXUS_SECRET_KEY` is not set the keys are stored as
 * they are, and this page says so at the top in plain words rather than implying a protection that
 * is not there.
 *
 * And it has to let somebody **try it**, because every other signal — a reachable host, a key of
 * the right shape — answers a question nobody asked.
 */

const STATUS: Record<Provider["status"], { label: string; className: string; icon: React.ReactNode }> = {
  unknown: { label: "not tried", className: "unknown", icon: <Info size={11} /> },
  ok: { label: "answering", className: "ok", icon: <Check size={11} /> },
  unauthorised: { label: "key refused", className: "bad", icon: <X size={11} /> },
  unreachable: { label: "no answer", className: "bad", icon: <AlertTriangle size={11} /> },
};

export function ModelSettings({ slug, workspaceId, providers, tasks, secretConfigured, environment }: {
  slug: string;
  workspaceId: string;
  providers: Provider[];
  tasks: Record<string, { providerId: string | null; model: string }>;
  secretConfigured: boolean;
  environment: { key: boolean; model: string; baseUrl: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [keyFor, setKeyFor] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const enabled = providers.filter((p) => p.enabled);
  const usingEnvironment = enabled.length === 0 && environment.key && environment.model;

  const run = (fn: () => Promise<{ error?: string } | unknown>) => {
    setMessage(null);
    start(async () => {
      const result = (await fn()) as { error?: string } | undefined;
      if (result && typeof result === "object" && "error" in result && result.error) setMessage(result.error);
      router.refresh();
    });
  };

  return (
    <section className="studio-home-main model-page" aria-label="Models">
      <header className="studio-home-topbar">
        <div>
          <span>Where the thinking happens</span>
          <h1>Models</h1>
          <p className="roadmap-lede">
            Nexus can think with Claude, with GPT, or with a model on your own hardware — and with different ones
            for different jobs. Nothing here is required: every part of the product works without a model, and says
            so where a model would have helped.
          </p>
        </div>
      </header>

      {message && <p className="proposal-bulk-result" data-model-message>{message}</p>}

      {!secretConfigured && providers.some((p) => p.hasKey) && (
        <p className="agent-fleet-warning" data-key-warning>
          <AlertTriangle size={13} /> API keys here are stored <strong>as they are</strong>, not encrypted, because
          <code> NEXUS_SECRET_KEY</code> is not set on the server. Set it to a long random value and re-enter the keys.
          Anyone who can read the database can read them until you do.
        </p>
      )}

      {usingEnvironment && (
        <p className="model-env" data-model-env>
          <Info size={13} /> No provider is configured here, so Nexus is using the environment:
          <code> {environment.model}</code>{environment.baseUrl && <> at <code>{environment.baseUrl}</code></>}. Adding
          a provider below takes over from it.
        </p>
      )}

      <section className="model-list" aria-label="Providers">
        {providers.map((provider) => (
          <article key={provider.id} className={`model-card ${provider.enabled ? "" : "off"}`} data-provider={provider.id}>
            <div className="model-card-main">
              <header>
                {provider.dialect === "anthropic" ? <Cpu size={15} /> : <ServerCog size={15} />}
                <input
                  className="model-name"
                  defaultValue={provider.name}
                  aria-label="Provider name"
                  onBlur={(e) => e.target.value !== provider.name && run(() => updateProvider(provider.id, { name: e.target.value }))}
                />
                <i className={`model-status ${STATUS[provider.status].className}`} title={provider.statusDetail}>
                  {STATUS[provider.status].icon} {STATUS[provider.status].label}
                </i>
              </header>

              <div className="model-fields">
                <label>
                  <span>Speaks</span>
                  <select
                    defaultValue={provider.dialect}
                    onChange={(e) => run(() => updateProvider(provider.id, { dialect: e.target.value as Dialect }))}
                  >
                    <option value="anthropic">Anthropic Messages</option>
                    <option value="openai">OpenAI-compatible</option>
                  </select>
                </label>
                <label>
                  <span>Base URL</span>
                  <input
                    defaultValue={provider.baseUrl}
                    placeholder={provider.dialect === "anthropic" ? "https://api.anthropic.com" : "http://localhost:11434/v1"}
                    onBlur={(e) => e.target.value !== provider.baseUrl && run(() => updateProvider(provider.id, { baseUrl: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Model</span>
                  <input
                    defaultValue={provider.model}
                    placeholder="claude-sonnet-4-5"
                    onBlur={(e) => e.target.value !== provider.model && run(() => updateProvider(provider.id, { model: e.target.value }))}
                  />
                </label>
              </div>

              {provider.statusDetail && <p className={`model-detail ${STATUS[provider.status].className}`}>{provider.statusDetail}</p>}

              {keyFor === provider.id ? (
                <div className="model-key-edit">
                  <input
                    type="password"
                    autoFocus
                    value={keyValue}
                    placeholder="Paste the key. Leave empty to remove it."
                    aria-label="API key"
                    onChange={(e) => setKeyValue(e.target.value)}
                  />
                  <button type="button" className="primary-home-button" disabled={pending} onClick={() => { run(() => updateProvider(provider.id, { apiKey: keyValue })); setKeyFor(null); setKeyValue(""); }}>Save</button>
                  <button type="button" className="ghost-button" onClick={() => { setKeyFor(null); setKeyValue(""); }}>Cancel</button>
                </div>
              ) : (
                <div className="model-key">
                  <KeyRound size={12} />
                  {provider.hasKey
                    ? <>A key is stored{provider.keyEncrypted ? ", encrypted" : ", unencrypted"}. It is never shown again.</>
                    : <>No key. Right for a model on your own hardware; needed for a hosted one.</>}
                  <button type="button" onClick={() => { setKeyFor(provider.id); setKeyValue(""); }}>{provider.hasKey ? "Replace" : "Add a key"}</button>
                </div>
              )}
            </div>

            <div className="model-card-actions">
              <button type="button" className="ghost-button" disabled={pending} data-check={provider.id} onClick={() => run(() => checkProvider(provider.id))}>
                <Wifi size={13} /> Try it
              </button>
              <label className="model-enable">
                <input type="checkbox" checked={provider.enabled} onChange={(e) => run(() => updateProvider(provider.id, { enabled: e.target.checked }))} />
                enabled
              </label>
              <button
                type="button"
                className="ghost-button"
                disabled={pending}
                title="Remove this provider"
                onClick={() => { if (confirm(`Remove “${provider.name}”? Any job pointed at it falls back to the next provider.`)) run(() => removeProvider(provider.id)); }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="model-add" aria-label="Add a provider">
        <h2><Plus size={14} /> Add a provider</h2>
        <div className="model-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={adding === preset.id ? "on" : ""}
              disabled={pending}
              data-preset={preset.id}
              onClick={() => {
                setAdding(preset.id);
                run(() => addProvider(workspaceId, { name: preset.name, dialect: preset.dialect, baseUrl: preset.baseUrl, model: preset.model || "set-a-model-id" }));
              }}
            >
              <strong>{preset.name}</strong>
              <span>{preset.note}</span>
              {!preset.needsKey && <em>no key needed</em>}
            </button>
          ))}
        </div>
        <p className="model-hint">
          Anything that speaks the OpenAI API works: Ollama, vLLM, llama.cpp, a LiteLLM gateway, an in-country cloud.
          Pick the closest one and correct the base URL — nothing leaves your network if the URL does not.
        </p>
      </section>

      <section className="model-tasks" aria-label="Which model does which job">
        <h2>Which model does which job</h2>
        <p>
          These are genuinely different work. Reading a fifty-page transcript is not answering a question about two
          cards, and it is reasonable to send one to a local model and keep the other on a frontier one.
        </p>
        {TASKS.map((task: Task) => {
          const current = tasks[task];
          return (
            <div key={task} className="model-task" data-task={task}>
              <b>{TASK_LABEL[task]}</b>
              <select
                value={current?.providerId ?? ""}
                disabled={pending || providers.length === 0}
                aria-label={`Provider for ${task}`}
                onChange={(e) => run(() => assignTask(workspaceId, task, e.target.value || null, current?.model ?? ""))}
              >
                <option value="">whichever is first</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.enabled ? "" : " (disabled)"}</option>)}
              </select>
              <input
                defaultValue={current?.model ?? ""}
                placeholder="same model as the provider"
                aria-label={`Model for ${task}`}
                disabled={pending}
                onBlur={(e) => e.target.value !== (current?.model ?? "") && run(() => assignTask(workspaceId, task, current?.providerId ?? null, e.target.value))}
              />
            </div>
          );
        })}
      </section>

      <p className="apm-footnote">
        Keys are stored on the server and never sent to the browser. <a href={`/w/${slug}/docs/models`}>How this works</a>
      </p>
    </section>
  );
}
