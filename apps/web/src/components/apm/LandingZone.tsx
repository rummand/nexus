"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, FileSpreadsheet, FileText, Trash2, Upload } from "lucide-react";
import { createBatch, deleteBatch } from "@/lib/apm/actions";

/**
 * Where data arrives.
 *
 * Deliberately not called "import". An import is a thing that happens to you; this is a place data
 * waits while people look at it, and the difference is the whole feature.
 */

export interface BatchSummary {
  id: string;
  name: string;
  status: "staged" | "approved" | "rolled back";
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
  "rolled back": { label: "rolled back", className: "undone" },
};

export function LandingZone({ slug, workspaceId, batches }: { slug: string; workspaceId: string; batches: BatchSummary[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    const data = form.current ? new FormData(form.current) : null;
    if (!data) return;
    data.set("workspaceId", workspaceId);
    setError(null);
    start(async () => {
      const result = await createBatch(data);
      if ("error" in result) { setError(result.error); return; }
      router.push(`/w/${slug}/apm/${result.id}`);
    });
  };

  return (
    <section className="studio-home-main" aria-label="Landing zone">
      <header className="studio-home-topbar">
        <div>
          <span>Data on its way in</span>
          <h1>Landing zone</h1>
          <p className="roadmap-lede">
            A ServiceNow export, an old spreadsheet, a Word document from a governance review. Drop them here
            together and work on them where you can see them. Nothing enters the model until you say so, and
            what you take can be put back.
          </p>
        </div>
      </header>

      <form
        ref={form}
        className="apm-drop"
        data-apm-upload
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <label>
          <Upload size={20} />
          <strong>Choose the files</strong>
          <span>CSV, TSV, JSON, Excel, Word, Markdown or plain text · up to 12 files, 12MB each</span>
          <input
            type="file"
            name="files"
            multiple
            data-apm-files
            accept=".csv,.tsv,.tab,.json,.xlsx,.xlsm,.docx,.md,.markdown,.txt,text/*"
            onChange={(e) => setChosen([...(e.target.files ?? [])].map((f) => f.name))}
          />
        </label>
        {chosen.length > 0 && (
          <div className="apm-chosen">
            {chosen.map((name) => <em key={name}>{name}</em>)}
          </div>
        )}
        <div className="apm-drop-actions">
          <button type="submit" className="primary-home-button" disabled={pending || chosen.length === 0}>
            {pending ? "Reading…" : `Stage ${chosen.length || ""} file${chosen.length === 1 ? "" : "s"}`.trim()}
          </button>
          <span>
            The files are read, folded together and checked against the graph. The graph is not touched.
          </span>
        </div>
        {error && <p className="form-error" data-apm-error><AlertTriangle size={13} /> {error}</p>}
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
        <ol className="apm-batches" data-apm-batches>
          {batches.map((batch) => (
            <li key={batch.id} className={`apm-batch ${STATUS[batch.status].className}`} data-batch={batch.id}>
              <div className="apm-batch-body">
                <div className="apm-batch-head">
                  <Link href={`/w/${slug}/apm/${batch.id}`}><strong>{batch.name}</strong></Link>
                  <i className={`apm-status ${STATUS[batch.status].className}`}>{STATUS[batch.status].label}</i>
                  <span>{new Date(batch.createdAt).toLocaleString()}</span>
                </div>
                <div className="apm-batch-files">
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
                  {batch.status === "rolled back" && " · put back"}
                </p>
              </div>
              <div className="apm-batch-actions">
                <Link className="ghost-button" href={`/w/${slug}/apm/${batch.id}`}>
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
