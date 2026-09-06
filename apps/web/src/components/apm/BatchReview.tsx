"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, Check, CircleHelp, FileSpreadsheet, FileText, Info,
  LayoutGrid, Pause, Undo2, UserRound, X,
} from "lucide-react";
import type { Role } from "@/lib/apm/map";
import type { Decision } from "@/lib/apm/stage";
import type { Issue, Severity } from "@/lib/apm/review";
import type { Change, MatchHow } from "@/lib/apm/match";
import { approveBatch, createBatchBoard, decideRows, remapBatch, rollbackBatch } from "@/lib/apm/actions";

/**
 * The review.
 *
 * The screen this whole feature exists for: everything the files claim, what it would do to the
 * model, and what somebody has to decide before any of it is true. Two rules shape it.
 *
 * The **questions come first**, because a review that opens on four hundred unremarkable rows is a
 * review that gets rubber-stamped. And **nothing is hidden** — the unchanged rows, the losing value
 * of a conflict and the rows a person rejected are all one click away, because the moment somebody
 * cannot see why a number is what it is, they stop trusting the number.
 */

export interface RowView {
  id: string;
  name: string;
  kind: string;
  description: string;
  key: string;
  sources: string[];
  rows: Array<{ source: string; row: number }>;
  attributes: Array<{ key: string; value: string; from: string; others: Array<{ value: string; from: string }> }>;
  personal: Array<{ key: string; value: string; from: string }>;
  relations: Array<{ kind: string; target: string }>;
  match: { how: MatchHow; name: string; kind: string; alternatives: string[] };
  changes: Change[];
  issues: Issue[];
  decision: Decision;
  decidedBy: "default" | "person";
}

export interface FileView {
  name: string;
  format: string;
  note: string | null;
  rows: number;
  text: string | null;
  columns: Array<{ header: string; role: Role; label: string; why: string; sample: string[] }>;
}

const ROLE_CHOICES: Array<{ value: string; label: string }> = [
  { value: "name", label: "name" },
  { value: "kind", label: "kind" },
  { value: "description", label: "description" },
  { value: "key", label: "source key" },
  { value: "attribute", label: "attribute" },
  { value: "date", label: "date" },
  { value: "person", label: "person" },
  { value: "relation", label: "relation" },
  { value: "ignore", label: "ignore" },
];

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  blocker: <AlertTriangle size={12} />,
  question: <CircleHelp size={12} />,
  note: <Info size={12} />,
};

type Filter = "questions" | "new" | "changed" | "all";

export function BatchReview({ slug, batch, files, rows, counts, missing, written }: {
  slug: string;
  batch: { id: string; name: string; status: "staged" | "approved" | "rolled back"; createdAt: string; approvedAt: string | null; includePersonal: boolean };
  files: FileView[];
  rows: RowView[];
  counts: { total: number; create: number; update: number; unchanged: number; held: number; rejected: number };
  missing: Array<{ name: string; message: string }>;
  written: { created: number; updated: number; relations: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("questions");
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const staged = batch.status === "staged";

  const questions = useMemo(() => rows.filter((r) => r.issues.some((i) => i.severity !== "note")), [rows]);
  const shown = useMemo(() => {
    switch (filter) {
      case "questions": return questions;
      case "new": return rows.filter((r) => r.match.how === "none" && r.decision === "accept");
      case "changed": return rows.filter((r) => r.changes.length > 0);
      default: return rows;
    }
  }, [filter, questions, rows]);

  const decide = (ids: string[], decision: Decision) => {
    setMessage(null);
    start(async () => {
      const r = await decideRows(batch.id, ids.map((id) => ({ id, decision })));
      if ("error" in r) setMessage(r.error);
      router.refresh();
    });
  };

  const setRole = (file: string, header: string, as: string) => {
    const role: Role = as === "attribute" || as === "date" || as === "person"
      ? ({ as, key: header.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim() } as Role)
      : as === "relation"
        ? { as: "relation", kind: "depends on" }
        : ({ as } as Role);
    start(async () => {
      const r = await remapBatch(batch.id, { columns: [{ file, header, role }] });
      if ("error" in r) setMessage(r.error);
      router.refresh();
    });
  };

  return (
    <section className="studio-home-main" aria-label="Batch review">
      <header className="studio-home-topbar">
        <div>
          <span>{staged ? "Nothing here is in the model yet" : batch.status === "approved" ? "In the model" : "Put back"}</span>
          <h1>{batch.name}</h1>
          <p className="roadmap-lede">
            {staged
              ? "Everything the files claim, folded into one object per thing, matched against what you already have. Work through the questions, then approve — or draw it on a board first and walk around it."
              : batch.status === "approved"
                ? `Approved ${batch.approvedAt ? new Date(batch.approvedAt).toLocaleString() : ""}: ${written.created} created, ${written.updated} changed, ${written.relations} connected. It can still be put back.`
                : "This batch was approved and then rolled back. What it wrote has been undone, except where somebody had since built on it."}
          </p>
        </div>
        <div className="studio-home-actions">
          <button type="button" className="ghost-button" disabled={pending} data-draw-batch onClick={() => start(async () => { const r = await createBatchBoard(batch.id); if (r && "error" in r) setMessage(r.error); })}>
            <LayoutGrid size={15} /> Draw it on a board
          </button>
          {staged && (
            <button
              type="button"
              className="primary-home-button"
              disabled={pending || counts.create + counts.update === 0}
              data-approve-batch
              onClick={() => {
                if (!confirm(`Take this into the model? ${counts.create} new objects, ${counts.update} changed. ${counts.held + counts.rejected} rows are left alone. You can roll this back.`)) return;
                start(async () => {
                  const r = await approveBatch(batch.id);
                  setMessage("error" in r ? r.error : `Written: ${r.created} created, ${r.updated} changed, ${r.connected} connected.`);
                  router.refresh();
                });
              }}
            >
              <Check size={15} /> Approve
            </button>
          )}
          {batch.status === "approved" && (
            <button
              type="button"
              className="ghost-button"
              disabled={pending}
              data-rollback-batch
              onClick={() => {
                if (!confirm("Put this batch back? Objects it created are deleted unless something has been built on them since, and fields it changed are restored unless somebody has changed them again.")) return;
                start(async () => {
                  const r = await rollbackBatch(batch.id);
                  if ("error" in r) { setMessage(r.error); return; }
                  setMessage(`${r.deleted} deleted, ${r.restored} field${r.restored === 1 ? "" : "s"} restored${r.kept ? `, ${r.kept} left alone` : ""}.`);
                  setNotes(r.notes);
                  router.refresh();
                });
              }}
            >
              <Undo2 size={15} /> Roll it back
            </button>
          )}
        </div>
      </header>

      {message && <p className="proposal-bulk-result" data-apm-result>{message}</p>}
      {notes.length > 0 && (
        <details className="proposal-rejected" open>
          <summary>{notes.length} thing{notes.length === 1 ? "" : "s"} the rollback would not touch</summary>
          <ul>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
        </details>
      )}

      <div className="apm-counts" data-apm-counts>
        <b>{counts.total.toLocaleString()}</b> object{counts.total === 1 ? "" : "s"} staged ·
        <em className="create"> {counts.create} new</em> ·
        <em className="update"> {counts.update} changed</em> ·
        <em className="quiet"> {counts.unchanged} unchanged</em>
        {counts.held > 0 && <em className="held"> · {counts.held} held</em>}
        {counts.rejected > 0 && <em className="quiet"> · {counts.rejected} rejected</em>}
        {questions.length > 0 && <em className="question"> · {questions.length} need you</em>}
      </div>

      <section className="apm-files" aria-label="Files in this batch">
        {files.map((file) => (
          <article key={file.name} className="apm-file">
            <header>
              {file.text ? <FileText size={14} /> : <FileSpreadsheet size={14} />}
              <strong>{file.name}</strong>
              <i>{file.format}{file.rows ? ` · ${file.rows.toLocaleString()} rows` : ""}</i>
            </header>
            {file.note && <p className="apm-file-note"><Info size={12} /> {file.note}</p>}
            {file.text !== null ? (
              <p className="apm-file-prose">
                Prose, not a table. It is kept with the batch; reading it for claims is the intake pipeline&rsquo;s job.
                <span>{file.text}…</span>
              </p>
            ) : (
              <div className="apm-columns">
                {file.columns.map((column) => (
                  <div key={column.header} className={`apm-column ${column.role.as}`} title={column.why}>
                    <b>{column.header}</b>
                    <select
                      value={column.role.as}
                      disabled={!staged || pending}
                      aria-label={`What “${column.header}” means`}
                      onChange={(e) => setRole(file.name, column.header, e.target.value)}
                    >
                      {ROLE_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                    </select>
                    <small>{column.sample.join(" · ") || "—"}</small>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
        <label className="apm-personal-toggle">
          <input
            type="checkbox"
            checked={batch.includePersonal}
            disabled={!staged || pending}
            onChange={(e) => start(async () => { await remapBatch(batch.id, { includePersonal: e.target.checked }); router.refresh(); })}
          />
          <UserRound size={13} />
          Include the columns that name people. Off by default: an old spreadsheet carries people, and nothing about
          a person should enter the model because nobody looked.
        </label>
      </section>

      {missing.length > 0 && (
        <section className="apm-missing" data-apm-missing>
          <h2><AlertTriangle size={14} /> {missing.length} object{missing.length === 1 ? "" : "s"} the source has stopped claiming</h2>
          <p>Nothing is deleted for you. Retired, moved out of scope, or a filtered export — only you know which.</p>
          <ul>{missing.map((m) => <li key={m.name}><strong>{m.name}</strong> {m.message}</li>)}</ul>
        </section>
      )}

      <nav className="knowledge-tabs" aria-label="Which rows to show">
        {([["questions", `Needs you · ${questions.length}`], ["new", `New · ${counts.create}`], ["changed", `Changed · ${counts.update}`], ["all", `All · ${counts.total}`]] as Array<[Filter, string]>).map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="apm-empty">
          {filter === "questions" ? "Nothing here needs a decision. Look through “All” before you approve." : "Nothing in this view."}
        </p>
      ) : (
        <ol className="apm-rows" data-apm-rows>
          {shown.slice(0, 300).map((row) => (
            <li key={row.id} className={`apm-row ${row.decision}`} data-apm-row={row.id}>
              <button type="button" className="apm-row-head" onClick={() => setOpen(open === row.id ? null : row.id)} aria-expanded={open === row.id}>
                <strong>{row.name || "(no name)"}</strong>
                {row.kind && <i className="apm-kind">{row.kind}</i>}
                <Outcome row={row} />
                <span className="apm-row-sources">{row.sources.join(" + ")}</span>
                {row.issues.filter((i) => i.severity !== "note").length > 0 && (
                  <i className="apm-flag">{row.issues.filter((i) => i.severity !== "note").length}</i>
                )}
              </button>

              {open === row.id && (
                <div className="apm-row-body">
                  {row.issues.map((issue, i) => (
                    <p key={i} className={`apm-issue ${issue.severity}`}>{SEVERITY_ICON[issue.severity]} {issue.message}</p>
                  ))}

                  {row.changes.length > 0 && (
                    <div className="apm-changes">
                      {row.changes.map((change) => (
                        <span key={change.key}><b>{change.key}</b> {change.from || "—"} <ArrowRight size={11} /> {change.to}</span>
                      ))}
                    </div>
                  )}

                  <div className="apm-values">
                    {row.attributes.map((attribute) => (
                      <div key={attribute.key} className={attribute.others.length ? "conflict" : ""}>
                        <b>{attribute.key}</b>
                        <span>{attribute.value}</span>
                        <small>{attribute.from}</small>
                        {attribute.others.map((other, i) => (
                          <em key={i} title="Kept, but not written — the file above it in the trust order won">{other.value} · {other.from}</em>
                        ))}
                      </div>
                    ))}
                    {row.personal.map((p) => (
                      <div key={p.key} className="personal">
                        <b><UserRound size={10} /> {p.key}</b>
                        <span>{p.value}</span>
                        <small>{p.from} · not written</small>
                      </div>
                    ))}
                  </div>

                  {row.relations.length > 0 && (
                    <div className="apm-relations">
                      {row.relations.map((relation, i) => <span key={i}>{relation.kind} <ArrowRight size={10} /> {relation.target}</span>)}
                    </div>
                  )}

                  <p className="apm-provenance">
                    {row.rows.map((r) => `${r.source} row ${r.row}`).join(" · ")}
                    {row.key && ` · key ${row.key}`}
                  </p>

                  {staged && (
                    <div className="apm-decide">
                      {(["accept", "hold", "reject"] as Decision[]).map((decision) => (
                        <button
                          key={decision}
                          type="button"
                          className={row.decision === decision ? "on" : ""}
                          disabled={pending}
                          onClick={() => decide([row.id], decision)}
                        >
                          {decision === "accept" ? <Check size={12} /> : decision === "hold" ? <Pause size={12} /> : <X size={12} />}
                          {decision}
                        </button>
                      ))}
                      {row.decidedBy === "person" && <small>you decided this</small>}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {shown.length > 300 && <p className="apm-empty">Showing the first 300 of {shown.length}. Narrow it with the filters above, or draw it on a board.</p>}

      {staged && shown.length > 0 && filter === "questions" && (
        <div className="apm-bulk">
          <button type="button" className="ghost-button" disabled={pending} onClick={() => decide(shown.map((r) => r.id), "accept")}>
            <Check size={13} /> Accept all {shown.length} of these
          </button>
          <button type="button" className="ghost-button" disabled={pending} onClick={() => decide(shown.map((r) => r.id), "hold")}>
            <Pause size={13} /> Hold them all
          </button>
        </div>
      )}
      <p className="apm-footnote">
        Batch {batch.id} · staged {new Date(batch.createdAt).toLocaleString()} · <a href={`/w/${slug}/apm`}>all batches</a>
      </p>
    </section>
  );
}

function Outcome({ row }: { row: RowView }) {
  if (row.decision === "hold") return <i className="apm-outcome held">held</i>;
  if (row.decision === "reject") return <i className="apm-outcome rejected">rejected</i>;
  if (row.match.how === "none") return <i className="apm-outcome create">new</i>;
  if (row.changes.length) return <i className="apm-outcome update">changes {row.changes.length}</i>;
  return <i className="apm-outcome quiet">unchanged</i>;
}
