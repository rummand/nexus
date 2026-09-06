"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Download, Plus, Server, Trash2, Wifi } from "lucide-react";
import { addServer, askServer, checkServer, keepAsSource, removeServer, type ServerSummary } from "@/lib/mcp/server-actions";
import { simpleFields } from "@/lib/mcp/protocol";

/**
 * Servers Nexus may ask.
 *
 * The important thing this screen does is refuse to be a pipeline. A tool is called, its answer is
 * shown as text, and only then can somebody keep it — as an intake source, which is read for
 * claims, quoted and reviewed before anything reaches the model. A one-click "sync" would be
 * shorter and would quietly make a remote system an author of the architecture.
 */

const STATUS: Record<string, { label: string; className: string }> = {
  unknown: { label: "not tried", className: "unknown" },
  ok: { label: "answering", className: "ok" },
  unauthorised: { label: "key refused", className: "bad" },
  unreachable: { label: "no answer", className: "bad" },
};

export function OutboundServers({ slug, workspaceId, servers }: { slug: string; workspaceId: string; servers: ServerSummary[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ serverId: string; tool: string } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<{ serverId: string; tool: string; text: string } | null>(null);
  const [kept, setKept] = useState<string | null>(null);

  const add = () => {
    setMessage(null);
    start(async () => {
      const result = await addServer(workspaceId, { name, url, apiKey: key });
      if ("error" in result) setMessage(result.error);
      else { setName(""); setUrl(""); setKey(""); }
      router.refresh();
    });
  };

  const ask = (serverId: string, tool: string) => {
    setMessage(null);
    setAnswer(null);
    setKept(null);
    start(async () => {
      const result = await askServer(serverId, tool, values);
      if ("error" in result) setMessage(result.error);
      else setAnswer({ serverId, tool, text: result.text });
    });
  };

  return (
    <section className="mcp-out" aria-label="Servers Nexus can ask">
      <h2><Server size={14} /> Servers Nexus can ask</h2>
      <p>
        The other direction. A system of yours that speaks MCP — a CMDB, a wiki, a ticket tracker — can be asked
        here, and what it answers goes into <Link href={`/w/${slug}/intake`}>Intake</Link>: read for claims, every
        claim quoted, and reviewed by a person before any of it reaches the model. Nothing a remote server says is
        taken as true.
      </p>

      {message && <p className="agent-fleet-warning" data-server-message><AlertTriangle size={13} /> {message}</p>}

      <div className="mcp-out-add">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What system it is" aria-label="Server name" data-server-name />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/mcp" aria-label="Server URL" data-server-url />
        <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="Key, if it needs one" aria-label="Server key" />
        <button type="button" className="primary-home-button" disabled={pending || !name.trim() || !url.trim()} onClick={add} data-add-server>
          <Plus size={13} /> Add
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="roadmap-empty"><p>No servers yet. Nexus asks nothing outside this workspace.</p></div>
      ) : (
        <ul className="mcp-out-list" data-servers>
          {servers.map((server) => (
            <li key={server.id} data-server={server.id}>
              <header>
                <strong>{server.name}</strong>
                <i className={`model-status ${STATUS[server.status]?.className ?? "unknown"}`}>{STATUS[server.status]?.label ?? server.status}</i>
                <code>{server.url}</code>
                <button type="button" className="ghost-button" disabled={pending} data-check-server={server.id} onClick={() => start(async () => { await checkServer(server.id); router.refresh(); })}>
                  <Wifi size={13} /> Ask what it can do
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={pending}
                  title="Remove"
                  onClick={() => { if (confirm(`Remove “${server.name}”? Sources already brought in stay where they are.`)) start(async () => { await removeServer(server.id); router.refresh(); }); }}
                >
                  <Trash2 size={13} />
                </button>
              </header>
              {server.statusDetail && <p className={`model-detail ${STATUS[server.status]?.className ?? "unknown"}`}>{server.statusDetail}</p>}

              {server.tools.length > 0 && (
                <div className="mcp-out-tools">
                  {server.tools.map((tool) => (
                    <button
                      key={tool.name}
                      type="button"
                      className={asking?.serverId === server.id && asking.tool === tool.name ? "on" : ""}
                      data-tool={tool.name}
                      onClick={() => { setAsking({ serverId: server.id, tool: tool.name }); setValues({}); setAnswer(null); }}
                    >
                      <b>{tool.name}</b>
                      <span>{tool.description || "No description given."}</span>
                    </button>
                  ))}
                </div>
              )}

              {asking?.serverId === server.id && (() => {
                const tool = server.tools.find((t) => t.name === asking.tool);
                const fields = tool ? simpleFields(tool.inputSchema) : [];
                return (
                  <div className="mcp-out-call" data-call>
                    {fields.map((field) => (
                      <label key={field.key}>
                        <span>{field.key}{field.required ? " *" : ""}</span>
                        <input
                          value={values[field.key] ?? ""}
                          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                          placeholder={field.description || field.type}
                          aria-label={field.key}
                          data-arg={field.key}
                        />
                      </label>
                    ))}
                    <button type="button" className="primary-home-button" disabled={pending} onClick={() => ask(server.id, asking.tool)} data-run-tool>
                      {pending ? "Asking…" : "Ask it"}
                    </button>
                  </div>
                );
              })()}

              {answer?.serverId === server.id && (
                <div className="mcp-out-answer" data-answer>
                  <pre>{answer.text.slice(0, 4000)}{answer.text.length > 4000 ? "\n…" : ""}</pre>
                  {kept ? (
                    <p className="mcp-out-kept"><Check size={13} /> Kept as a source. <Link href={`/w/${slug}/intake`}>Read it for claims</Link>.</p>
                  ) : (
                    <button
                      type="button"
                      className="primary-home-button"
                      disabled={pending}
                      data-keep-source
                      onClick={() => start(async () => {
                        const result = await keepAsSource(workspaceId, answer.serverId, answer.tool, answer.text);
                        if ("error" in result) setMessage(result.error);
                        else setKept(result.id);
                        router.refresh();
                      })}
                    >
                      <Download size={13} /> Keep this as a source
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
