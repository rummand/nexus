"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Copy, KeyRound, Plug, Plus, Trash2 } from "lucide-react";
import { forgetKey, issueKey, revokeKey } from "@/lib/mcp/actions";
import { SCOPE_NOTE, SCOPES, type Scope, type TokenSummary } from "@/lib/mcp/tokens";

/**
 * Letting something outside Nexus ask.
 *
 * The estate model is the thing other people's agents most want to read, and this is where somebody
 * decides to let them. Two things this screen has to get right.
 *
 * The key is **shown once**. Not because it is fashionable but because we store a hash: there is no
 * way to show it again, and a screen that implied otherwise would be lying about its own security.
 *
 * And the boundary has to be **stated in the same words as it is enforced**. A read key can ask
 * anything and change nothing; a propose key can additionally leave a suggestion where a person
 * decides on it. There is no third option, and this page should make it obvious there is no third
 * option, because "can it write to our architecture model" is the question a security review opens
 * with.
 */

const when = (iso: string | null) => {
  if (!iso) return "never used";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "used today" : days === 1 ? "used yesterday" : `used ${days} days ago`;
};

export function Connections({ slug, workspaceId, workspaceName, tokens, origin }: {
  slug: string;
  workspaceId: string;
  workspaceName: string;
  tokens: TokenSummary[];
  origin: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("read");
  const [issued, setIssued] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const url = `${origin}/api/mcp`;

  const issue = () => {
    setMessage(null);
    setIssued(null);
    start(async () => {
      const result = await issueKey(workspaceId, name, scope);
      if ("error" in result) setMessage(result.error);
      else { setIssued(result.token); setName(""); }
      router.refresh();
    });
  };

  const snippet = `{
  "mcpServers": {
    "nexus": {
      "type": "http",
      "url": "${url}",
      "headers": { "Authorization": "Bearer ${issued ?? "nxs_your_key_here"}" }
    }
  }
}`;

  return (
    <section className="studio-home-main" aria-label="Connections">
      <header className="studio-home-topbar">
        <div>
          <span>Letting something outside ask</span>
          <h1>Connections</h1>
          <p className="roadmap-lede">
            Nexus speaks MCP, so another team&apos;s assistant — or your own coding agent — can ask {workspaceName} what
            depends on what, what is out of support, and what this organisation calls things. It cannot change
            anything: the most it can do is leave a suggestion in the review queue for a person to accept.
          </p>
        </div>
      </header>

      {message && <p className="agent-fleet-warning" data-connection-message><AlertTriangle size={13} /> {message}</p>}

      {issued && (
        <div className="mcp-issued" data-issued-key>
          <b><KeyRound size={13} /> Copy this now. It is not shown again.</b>
          <code>{issued}</code>
          <button type="button" className="ghost-button" onClick={() => navigator.clipboard?.writeText(issued)}><Copy size={13} /> Copy</button>
          <small>Nexus stores only a hash of it, so nothing — including this page — can print it back.</small>
        </div>
      )}

      <section className="mcp-new" aria-label="Issue a key">
        <h2><Plus size={14} /> Issue a key</h2>
        <div className="mcp-new-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is it for — “Claude Code on my laptop”"
            aria-label="Key name"
            data-key-name
          />
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="What it may do">
            {SCOPES.map((s) => <option key={s} value={s}>{s === "read" ? "Read the model" : "Read, and may propose"}</option>)}
          </select>
          <button type="button" className="primary-home-button" disabled={pending || !name.trim()} onClick={issue} data-issue-key>Issue</button>
        </div>
        <p className="model-hint">{SCOPE_NOTE[scope]}</p>
        {scope === "propose" && (
          <p className="model-hint">
            A key that may propose speaks as an agent: it appears in <Link href={`/w/${slug}/agents`}>Agents</Link> with a
            scope, a budget and how often people keep what it says — measured exactly like the agents you write yourself.
          </p>
        )}
      </section>

      <section className="mcp-keys" aria-label="Keys">
        <h2>Keys</h2>
        {tokens.length === 0 ? (
          <div className="roadmap-empty"><p>No keys yet. Nothing outside this workspace can reach the model.</p></div>
        ) : (
          <ul data-keys>
            {tokens.map((t) => (
              <li key={t.id} className={t.revokedAt ? "revoked" : ""} data-key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <i className={`model-status ${t.revokedAt ? "off" : t.scope === "propose" ? "warn" : "ok"}`}>
                    {t.revokedAt ? "revoked" : t.scope === "propose" ? "read + propose" : "read"}
                  </i>
                  <code>{t.prefix}…</code>
                  <span>{when(t.lastUsedAt)}</span>
                </div>
                {t.revokedAt ? (
                  <button type="button" className="ghost-button" disabled={pending} onClick={() => start(async () => { await forgetKey(t.id); router.refresh(); })}>
                    <Trash2 size={13} /> Forget
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={pending}
                    data-revoke={t.id}
                    onClick={() => { if (confirm(`Revoke “${t.name}”? Anything using it stops being answered immediately.`)) start(async () => { await revokeKey(t.id); router.refresh(); }); }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mcp-connect" aria-label="How to connect">
        <h2><Plug size={14} /> Pointing something at it</h2>
        <p>
          The endpoint is <code>{url}</code>, spoken as MCP over HTTP. Most clients take a block like this in their
          configuration:
        </p>
        <pre>{snippet}</pre>
        <p className="model-hint">
          Six tools: search the model, describe an object, follow what depends on what, read the vocabulary, read the
          health score, and — with a propose key — leave a suggestion. Ask it to call <code>list_kinds</code> first;
          an agent that has read your vocabulary suggests in your words.
        </p>
      </section>
    </section>
  );
}
