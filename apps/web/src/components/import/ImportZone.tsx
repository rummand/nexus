"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ClipboardPaste, FileSpreadsheet, FileText, Library, Server, Trash2, Upload } from "lucide-react";
import { createBatch, createPastedBatch, deleteBatch, stageFromLeanIx, stageFromServer } from "@/lib/import/actions";
import { askServer } from "@/lib/mcp/server-actions";
import { simpleFields } from "@/lib/mcp/protocol";
import type { RemoteTool } from "@/lib/mcp/client";

/**
 * Where data arrives — by any of the four routes it actually arrives by.
 *
 * **Files**, because that is what an export is. **Paste**, because the most common thing somebody
 * has is not a file: it is forty rows in a mail, a query result from a console, a list in a chat
 * message, and making them save it as a CSV first is a step whose only purpose is to satisfy the
 * import feature. **A connected system**, because a CMDB that speaks MCP can be asked directly
 * (§5.35) and its answer is just another table. And **an EA repository**, because the organisation
 * that already has one has its estate in there, and asking it is a read, not a migration project
 * (§5.63).
 *
 * All four end in the same place: a staged batch, decided on a canvas, approved by a person. The
 * doors differ; nothing behind them does.
 */

type Door = "files" | "paste" | "server" | "leanix";

export interface ServerOption {
  id: string;
  name: string;
  tools: RemoteTool[];
}

export interface BatchSummary {
  id: string;
  name: string;
  /** files | paste | connected system — where the data came from. */
  origin: string;
  status: "staged" | "approved" | "landed" | "rolled back";
  createdAt: string;
  approvedAt: string | null;
  files: Array<{ name: string; format: string; rows: number; prose: boolean }>;
  records: number;
  created: number;
  updated: number;
}

const STATUS: Record<BatchSummary["status"], { label: string; className: string }> = {
  staged: { label: "waiting for you", className: "staged" },
  approved: { label: "in the graph", className: "approved" },
  landed: { label: "on a branch", className: "landed" },
  "rolled back": { label: "rolled back", className: "undone" },
};

export function ImportZone({ slug, workspaceId, batches, servers }: {
  slug: string;
  workspaceId: string;
  batches: BatchSummary[];
  servers: ServerOption[];
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement | null>(null);
  const [door, setDoor] = useState<Door>("files");
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pasted, setPasted] = useState("");
  const [lxHost, setLxHost] = useState("");
  const [lxToken, setLxToken] = useState("");
  const [pastedName, setPastedName] = useState("");
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const [toolName, setToolName] = useState(servers[0]?.tools[0]?.name ?? "");
  const [args, setArgs] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<string | null>(null);

  const server = servers.find((s) => s.id === serverId);
  const tool = server?.tools.find((t) => t.name === toolName);

  const opened = (id: string) => router.push(`/w/${slug}/import/${id}`);

  const send = () => {
    const data = form.current ? new FormData(form.current) : null;
    if (!data) return;
    data.set("workspaceId", workspaceId);
    setError(null);
    start(async () => {
      const result = await createBatch(data);
      if ("error" in result) { setError(result.error); return; }
      opened(result.id);
    });
  };

  const stagePaste = () => {
    setError(null);
    start(async () => {
      const result = await createPastedBatch(workspaceId, { name: pastedName, text: pasted });
      if ("error" in result) { setError(result.error); return; }
      opened(result.id);
    });
  };

  const ask = () => {
    setError(null);
    setAnswer(null);
    start(async () => {
      const result = await askServer(serverId, toolName, args);
      if ("error" in result) { setError(result.error); return; }
      setAnswer(result.text);
    });
  };

  const stageLeanIx = () => {
    setError(null);
    start(async () => {
      const result = await stageFromLeanIx(workspaceId, { host: lxHost, token: lxToken });
      // Kept on failure: a mistyped host should not cost you the token as well.
      if ("error" in result) { setError(result.error); return; }
      setLxToken("");
      opened(result.id);
    });
  };

  const stageAnswer = () => {
    if (!answer || !server) return;
    setError(null);
    start(async () => {
      const result = await stageFromServer(workspaceId, { server: server.name, tool: toolName, text: answer });
      if ("error" in result) { setError(result.error); return; }
      opened(result.id);
    });
  };

  return (
    <section className="studio-home-main" aria-label="Import">
      <header className="studio-home-topbar">
        <div>
          <span>Data on its way in</span>
          <h1>Import</h1>
          <p className="roadmap-lede">
            A ServiceNow export, an old spreadsheet, a Word document from a governance review, forty rows in a
            mail, or an answer from a system that speaks MCP. Bring them in together and do the deciding on a
            canvas. Nothing enters the model until you say so, and what you take can be put back.
          </p>
        </div>
      </header>

      <nav className="import-doors" aria-label="How the data is arriving">
        <button type="button" className={door === "files" ? "on" : ""} data-door="files" onClick={() => setDoor("files")}>
          <Upload size={14} /> Files
        </button>
        <button type="button" className={door === "paste" ? "on" : ""} data-door="paste" onClick={() => setDoor("paste")}>
          <ClipboardPaste size={14} /> Paste
        </button>
        <button type="button" className={door === "server" ? "on" : ""} data-door="server" onClick={() => setDoor("server")}>
          <Server size={14} /> A connected system
        </button>
        <button type="button" className={door === "leanix" ? "on" : ""} data-door="leanix" onClick={() => setDoor("leanix")}>
          <Library size={14} /> An EA repository
        </button>
      </nav>

      {door === "leanix" && (
        <div className="import-leanix" data-import-leanix>
          <p className="import-leanix-lede">
            Read a LeanIX workspace straight into a staged batch. It then takes the same road as a
            spreadsheet — mapped, matched against what is already here, reviewed row by row, and
            reversible. Nothing enters the model until you approve it.
          </p>
          <div className="import-leanix-fields">
            <label>
              <span>Host</span>
              <input
                value={lxHost}
                onChange={(e) => setLxHost(e.target.value)}
                placeholder="acme.leanix.net"
                aria-label="LeanIX host"
                disabled={pending}
                data-leanix-host
              />
            </label>
            <label>
              <span>API token</span>
              <input
                type="password"
                value={lxToken}
                onChange={(e) => setLxToken(e.target.value)}
                placeholder="Administration → API tokens"
                aria-label="LeanIX API token"
                autoComplete="off"
                disabled={pending}
                data-leanix-token
              />
            </label>
          </div>
          <div className="import-drop-actions">
            <button
              type="button"
              className="primary-home-button"
              disabled={pending || !lxHost.trim() || !lxToken.trim()}
              data-stage-leanix
              onClick={stageLeanIx}
            >
              {pending ? "Reading the workspace…" : "Read the workspace"}
            </button>
            <span className="import-leanix-note">
              The token is used for this one read and never stored. A large workspace takes a
              minute; the whole estate arrives as one batch you can throw away.
            </span>
          </div>
          {error && <p className="form-error" data-import-error><AlertTriangle size={13} /> {error}</p>}
        </div>
      )}

      {door === "paste" && (
        <div className="import-paste" data-import-paste>
          <input
            value={pastedName}
            onChange={(e) => setPastedName(e.target.value)}
            placeholder="What is this? — “Servers from Erik's mail”"
            aria-label="What this is"
            data-paste-name
          />
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={9}
            placeholder={"Paste rows here. A header line and anything below it — commas, tabs or semicolons, or a JSON list.\n\nName,Kind,Owner\nMaximo,Application,Asset Management"}
            aria-label="Paste the data"
            data-paste-text
          />
          <div className="import-drop-actions">
            <button type="button" className="primary-home-button" disabled={pending || !pasted.trim()} onClick={stagePaste} data-stage-paste>
              {pending ? "Reading…" : "Stage it"}
            </button>
            <span>
              The shape is worked out from the content: a table if the lines share a delimiter, prose if they do
              not. Prose is kept for reading rather than mapped into columns.
            </span>
          </div>
          {error && <p className="form-error" data-import-error><AlertTriangle size={13} /> {error}</p>}
        </div>
      )}

      {door === "server" && (
        <div className="import-server" data-import-server>
          {servers.length === 0 ? (
            <p className="model-hint">
              No system is connected yet, or none has been asked what it can do. Add one under{" "}
              <Link href={`/w/${slug}/settings/connections`}>Settings → Connections</Link> — anything that speaks
              MCP can be asked here, and what it answers is staged like any other table.
            </p>
          ) : (
            <>
              <div className="import-server-pick">
                <label>
                  <span>System</span>
                  <select value={serverId} onChange={(e) => { setServerId(e.target.value); setToolName(servers.find((s) => s.id === e.target.value)?.tools[0]?.name ?? ""); setArgs({}); setAnswer(null); }} aria-label="Which system">
                    {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>Ask it</span>
                  <select value={toolName} onChange={(e) => { setToolName(e.target.value); setArgs({}); setAnswer(null); }} aria-label="Which tool">
                    {(server?.tools ?? []).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </label>
                {tool && simpleFields(tool.inputSchema).map((field) => (
                  <label key={field.key}>
                    <span>{field.key}{field.required ? " *" : ""}</span>
                    <input
                      value={args[field.key] ?? ""}
                      onChange={(e) => setArgs({ ...args, [field.key]: e.target.value })}
                      placeholder={field.description || field.type}
                      aria-label={field.key}
                      data-arg={field.key}
                    />
                  </label>
                ))}
                <button type="button" className="ghost-button" disabled={pending || !toolName} onClick={ask} data-ask-server>
                  {pending && !answer ? "Asking…" : "Ask it"}
                </button>
              </div>
              {tool?.description && <p className="model-hint">{tool.description}</p>}
              {answer !== null && (
                <div className="import-server-answer">
                  <pre>{answer.slice(0, 3000)}{answer.length > 3000 ? "\n…" : ""}</pre>
                  <div className="import-drop-actions">
                    <button type="button" className="primary-home-button" disabled={pending} onClick={stageAnswer} data-stage-answer>
                      Stage it
                    </button>
                    <span>
                      Rows are mapped and matched like any import. If it is prose rather than a table, keep it as a
                      source under <Link href={`/w/${slug}/settings/connections`}>Connections</Link> instead — intake
                      reads prose for claims.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p className="form-error" data-import-error><AlertTriangle size={13} /> {error}</p>}
        </div>
      )}

      <form
        hidden={door !== "files"}
        ref={form}
        className="import-drop"
        data-import-upload
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <label>
          <Upload size={20} />
          <strong>Choose the files</strong>
          <span>Tables, documents, or a picture of an architecture · CSV, Excel, Word, Markdown, PNG, JPEG · up to 12 files, 12MB each</span>
          <input
            type="file"
            name="files"
            multiple
            data-import-files
            accept=".csv,.tsv,.tab,.json,.xlsx,.xlsm,.docx,.md,.markdown,.txt,text/*,.png,.jpg,.jpeg,.webp,.gif,.svg,image/*"
            onChange={(e) => setChosen([...(e.target.files ?? [])].map((f) => f.name))}
          />
        </label>
        {chosen.length > 0 && (
          <div className="import-chosen">
            {chosen.map((name) => <em key={name}>{name}</em>)}
          </div>
        )}
        <div className="import-drop-actions">
          <button type="submit" className="primary-home-button" disabled={pending || chosen.length === 0}>
            {pending ? "Reading…" : `Stage ${chosen.length || ""} file${chosen.length === 1 ? "" : "s"}`.trim()}
          </button>
          <span>
            The files are read, folded together and checked against the graph. The graph is not touched.
          </span>
        </div>
        {error && <p className="form-error" data-import-error><AlertTriangle size={13} /> {error}</p>}
      </form>

      {batches.length === 0 ? (
        <div className="roadmap-empty">
          <p>
            Nothing has landed yet. When it does, you will get one row per object across all the files — the same
            application in ServiceNow and in a spreadsheet folded into one claim, with both answers kept where they
            disagree — matched against what you already have, and flagged where somebody has to decide.
          </p>
        </div>
      ) : (
        <ol className="import-batches" data-import-batches>
          {batches.map((batch) => (
            <li key={batch.id} className={`import-batch ${STATUS[batch.status].className}`} data-batch={batch.id}>
              <div className="import-batch-body">
                <div className="import-batch-head">
                  <Link href={`/w/${slug}/import/${batch.id}`}><strong>{batch.name}</strong></Link>
                  <i className={`import-status ${STATUS[batch.status].className}`}>{STATUS[batch.status].label}</i>
                  {batch.origin !== "files" && <i className="import-origin">{batch.origin}</i>}
                  <span>{new Date(batch.createdAt).toLocaleString()}</span>
                </div>
                <div className="import-batch-files">
                  {batch.files.map((file) => (
                    <em key={file.name} title={file.format}>
                      {file.prose ? <FileText size={11} /> : <FileSpreadsheet size={11} />}
                      {file.name}
                      {!file.prose && <b>{file.rows.toLocaleString()} rows</b>}
                    </em>
                  ))}
                </div>
                <p>
                  {batch.records.toLocaleString()} object{batch.records === 1 ? "" : "s"} staged
                  {batch.status === "approved" && ` · ${batch.created} created, ${batch.updated} changed`}
                  {batch.status === "landed" && " · waiting to be merged"}
                  {batch.status === "rolled back" && " · put back"}
                </p>
              </div>
              <div className="import-batch-actions">
                <Link className="ghost-button" href={`/w/${slug}/import/${batch.id}`}>
                  {batch.status === "staged" ? "Review" : <><Check size={13} /> Open</>}
                </Link>
                {batch.status === "staged" && (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={pending}
                    title="Throw the batch away. Nothing was written, so there is nothing to undo."
                    onClick={() => { if (confirm(`Discard “${batch.name}”? Nothing was written to the graph.`)) start(async () => { await deleteBatch(batch.id); router.refresh(); }); }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
