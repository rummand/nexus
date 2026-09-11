"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowRight, Check, CircleHelp, FileSpreadsheet, FileText, GitBranch, Info, Scale,
  LayoutGrid, Pause, RefreshCw, Undo2, UserRound, X,
} from "lucide-react";
import type { Role } from "@/lib/import/map";
import type { Decision } from "@/lib/import/stage";
import type { Issue, Severity } from "@/lib/import/review";
import type { Change, MatchHow } from "@/lib/import/match";
import { approveBatch, createBatchBoard, decideRows, redrawBatchBoard, remapBatch, rollbackBatch } from "@/lib/import/actions";
import { deliverChangeSet, switchRefAction } from "@/lib/change/actions";
import { divergenceWords, type Divergence } from "@/lib/change/ref";
import { Refused } from "@/components/checks/Refused";
import type { Refusal } from "@/lib/checks/gate";

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
  attributes: Array<{ key: string; value: string; from: string; quote?: string; others: Array<{ value: string; from: string; quote?: string }> }>;
  personal: Array<{ key: string; value: string; from: string }>;
  relations: Array<{ kind: string; target: string }>;
  /** What this object would sit inside, when a column was mapped as a parent (§5.74). */
  parent: string;
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
  /** What the rows in this file are, when no column says (§5.36). */
  kind: string;
  /** For a prose file: how it was read, and what came out of it (§5.38). */
  claimsNote: string | null;
  kindWhy: string;
  kindFromRows: boolean;
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
  { value: "parent", label: "parent" },
  { value: "relation", label: "relation" },
  { value: "ignore", label: "ignore" },
];

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  blocker: <AlertTriangle size={12} />,
  question: <CircleHelp size={12} />,
  note: <Info size={12} />,
};

type Filter = "questions" | "new" | "changed" | "all";

export function BatchReview({ slug, workspaceId, batch, files, rows, counts, missing, written, kinds }: {
  slug: string;
  workspaceId: string;
  batch: {
    id: string; name: string; status: "staged" | "approved" | "landed" | "rolled back";
    createdAt: string; approvedAt: string | null; includePersonal: boolean; boardId: string | null;
    /** The branch it landed on, resolved. Null when it was written straight through (§5.89). */
    branch: { id: string; name: string; status: string; divergence: Divergence } | null;
  };
  /** The kinds this workspace already uses, so an import speaks its vocabulary rather than ours. */
  kinds: string[];
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
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const staged = batch.status === "staged";
  const landed = batch.status === "landed";

  const questions = useMemo(() => rows.filter((r) => r.issues.some((i) => i.severity !== "note")), [rows]);
  const shown = useMemo(() => {
    switch (filter) {
      case "questions": return questions;
      case "new": return rows.filter((r) => r.match.how === "none" && r.decision === "accept");
      case "changed": return rows.filter((r) => r.changes.length > 0);
      default: return rows;
    }
  }, [filter, questions, rows]);

  /**
   * Merge the branch this batch landed on — the gesture that used to be "approve" (§5.89).
   *
   * It goes through the same gate everything else does (§5.88), which is the point: an import is
   * the largest change anybody ever makes to the model, and it should be the *least* privileged
   * path into it, not a side door with its own rules.
   */
  const merge = (anyway: boolean) => {
    if (!batch.branch) return;
    setRefusal(null);
    start(async () => {
      const r = await deliverChangeSet(batch.branch!.id, { anyway });
      if ("error" in r) {
        setMessage(r.error);
        setRefusal(r.refusal ?? null);
        return;
      }
      setMessage(`Merged: ${r.introduced} introduced, ${r.altered} changed, ${r.moved} moved, ${r.connected} connected.`);
      router.refresh();
    });
  };

  const decide = (ids: string[], decision: Decision) => {
    setMessage(null);
    start(async () => {
      const r = await decideRows(batch.id, ids.map((id) => ({ id, decision })));
      if ("error" in r) setMessage(r.error);
      router.refresh();
    });
  };

  const setKind = (file: string, kind: string) => {
    start(async () => {
      const r = await remapBatch(batch.id, { kinds: [{ file, kind }] });
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
          <span>{staged ? "Nothing here is in the model yet" : landed ? "On a branch, not in the model" : batch.status === "approved" ? "In the model" : "Put back"}</span>
          <h1>{batch.name}</h1>
          <p className="roadmap-lede">
            {staged
              ? "Everything the files claim, folded into one object per thing, matched against what you already have. Settle what the columns mean here, then do the deciding on the board — the lanes there are the decision."
              : landed
                ? `This landed on “${batch.branch?.name ?? "a branch"}”${batch.branch ? `: ${divergenceWords(batch.branch.divergence) || "nothing"}` : ""}. `
                  + "The estate everybody reads has not moved. Stand on the branch to see it from the inside, run the checks against it, then merge — or never merge, which is what undoing an import now means."
              : batch.status === "approved"
                ? `Approved ${batch.approvedAt ? new Date(batch.approvedAt).toLocaleString() : ""}: ${written.created} created, ${written.updated} changed, ${written.relations} connected. It can still be put back.`
                : "This batch was approved and then rolled back. What it wrote has been undone, except where somebody had since built on it."}
          </p>
        </div>
        <div className="studio-home-actions">
          {staged && batch.boardId && (
            <button
              type="button"
              className="ghost-button"
              disabled={pending}
              data-redraw-board
              title="Lay the cards out again from what the batch now says. An arrangement you made by hand is replaced."
              onClick={() => start(async () => { const r = await redrawBatchBoard(batch.id); setMessage("error" in r ? r.error : `Board redrawn: ${r.drawn} cards.`); router.refresh(); })}
            >
              <RefreshCw size={15} /> Redraw the board
            </button>
          )}
          <button
            type="button"
            className={staged ? "primary-home-button" : "ghost-button"}
            disabled={pending}
            data-draw-batch
            onClick={() => start(async () => { const r = await createBatchBoard(batch.id); if (r && "error" in r) setMessage(r.error); })}
          >
            <LayoutGrid size={15} /> {batch.boardId ? "Open the board" : "Work on the canvas"}
          </button>
          {/*
            Two destinations, and the branch is the primary one (§5.89). An import is somebody
            else's claim about your estate; putting it on a branch first is what lets it be
            reviewed, checked and walked away from. Writing straight in stays, because a
            forty-row correction to objects you already own does not need a review round — but
            it is the second button now, not the only one.
          */}
          {staged && (
            <>
              {/*
                The rules first (§5.90). Which destination a claim belongs in follows from what
                the claim is, so the primary action applies the rules rather than asking; the
                two explicit destinations stay for an operator who has a reason.
              */}
              <button
                type="button"
                className="primary-home-button"
                disabled={pending || counts.create + counts.update === 0}
                data-apply-rules
                onClick={() => {
                  if (!confirm("Apply the rules? Routine updates from a source that owns the field land in the model; everything new or contested waits on a branch.")) return;
                  start(async () => {
                    const r = await approveBatch(batch.id, { onto: "auto" });
                    setMessage("error" in r ? r.error : r.split ? r.split.words : "Nothing to do.");
                    router.refresh();
                  });
                }}
              >
                <Scale size={15} /> Apply the rules
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={pending || counts.create + counts.update === 0}
                data-land-batch
                onClick={() => {
                  if (!confirm(`Land all of it on a branch of its own? ${counts.create} new objects and ${counts.update} changed become a change set nobody has merged. The model does not move until somebody merges it.`)) return;
                  start(async () => {
                    const r = await approveBatch(batch.id, { onto: "branch" });
                    setMessage("error" in r
                      ? r.error
                      : `Landed on a branch: ${r.created} to introduce, ${r.updated} to change, ${r.connected} to connect`
                        + (r.nested ? `, ${r.nested} to place in the hierarchy.` : "."));
                    router.refresh();
                  });
                }}
              >
                <GitBranch size={15} /> Land it on a branch
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={pending || counts.create + counts.update === 0}
                data-approve-batch
                onClick={() => {
                  if (!confirm(`Write this straight into the model? ${counts.create} new objects, ${counts.update} changed. ${counts.held + counts.rejected} rows are left alone. You can roll this back.`)) return;
                  start(async () => {
                    const r = await approveBatch(batch.id);
                    setMessage("error" in r
                      ? r.error
                      : `Written: ${r.created} created, ${r.updated} changed, ${r.connected} connected`
                        + (r.nested ? `, ${r.nested} placed in the hierarchy.` : "."));
                    router.refresh();
                  });
                }}
              >
                <Check size={15} /> Write it straight in
              </button>
            </>
          )}
          {landed && batch.branch && (
            <>
              <button
                type="button"
                className="ghost-button"
                disabled={pending}
                data-stand-on-branch
                onClick={() => start(async () => {
                  const r = await switchRefAction(workspaceId, batch.branch!.id);
                  if ("error" in r) setMessage(r.error);
                  router.refresh();
                })}
              >
                <GitBranch size={15} /> Stand on it
              </button>
              <a className="ghost-button" href={`/w/${slug}/checks`}>Run the checks</a>
              {batch.branch.status !== "delivered" ? (
                <button
                  type="button"
                  className="primary-home-button"
                  disabled={pending}
                  data-merge-batch
                  onClick={() => merge(false)}
                >
                  <Check size={15} /> Merge it
                </button>
              ) : (
                <span className="import-merged"><Check size={15} /> Merged</span>
              )}
            </>
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

      {message && <p className="proposal-bulk-result" data-import-result>{message}</p>}
      {refusal && <Refused slug={slug} refusal={refusal} pending={pending} onAnyway={() => merge(true)} />}
      {notes.length > 0 && (
        <details className="proposal-rejected" open>
          <summary>{notes.length} thing{notes.length === 1 ? "" : "s"} the rollback would not touch</summary>
          <ul>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
        </details>
      )}

      <div className="import-counts" data-import-counts>
        <b>{counts.total.toLocaleString()}</b> object{counts.total === 1 ? "" : "s"} staged ·
        <em className="create"> {counts.create} new</em> ·
        <em className="update"> {counts.update} changed</em> ·
        <em className="quiet"> {counts.unchanged} unchanged</em>
        {counts.held > 0 && <em className="held"> · {counts.held} held</em>}
        {counts.rejected > 0 && <em className="quiet"> · {counts.rejected} rejected</em>}
        {questions.length > 0 && <em className="question"> · {questions.length} need you</em>}
      </div>

      <datalist id="import-kinds">{kinds.map((k) => <option key={k} value={k} />)}</datalist>

      <section className="import-files" aria-label="Files in this batch">
        {files.map((file) => (
          <article key={file.name} className="import-file">
            <header>
              {file.text ? <FileText size={14} /> : <FileSpreadsheet size={14} />}
              <strong>{file.name}</strong>
              <i>{file.format}{file.rows ? ` · ${file.rows.toLocaleString()} rows` : ""}</i>
            </header>
            {file.note && <p className="import-file-note"><Info size={12} /> {file.note}</p>}
            {file.text === null && (
              <div className={`import-file-kind ${file.kind || file.kindFromRows ? "" : "unanswered"}`} data-file-kind={file.name}>
                <span>What are these rows?</span>
                {file.kindFromRows ? (
                  <i>Each row says for itself.</i>
                ) : (
                  <>
                    <input
                      list="import-kinds"
                      defaultValue={file.kind}
                      placeholder="Application, Server, Capability…"
                      disabled={!staged || pending}
                      aria-label={`What the rows in ${file.name} are`}
                      onBlur={(e) => e.target.value.trim() !== file.kind && setKind(file.name, e.target.value)}
                    />
                    <small>{file.kindWhy}</small>
                  </>
                )}
              </div>
            )}
            {file.text !== null ? (
              <p className="import-file-prose">
                {file.claimsNote ?? "Prose, not a table. It is kept with the batch."}
                <span>{file.text}…</span>
              </p>
            ) : (
              <div className="import-columns">
                {file.columns.map((column) => (
                  <div key={column.header} className={`import-column ${column.role.as}`} title={column.why}>
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
        <label className="import-personal-toggle">
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
        <section className="import-missing" data-import-missing>
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
        <p className="import-empty">
          {filter === "questions" ? "Nothing here needs a decision. Look through “All” before you approve." : "Nothing in this view."}
        </p>
      ) : (
        <ol className="import-rows" data-import-rows>
          {shown.slice(0, 300).map((row) => (
            <li key={row.id} className={`import-row ${row.decision}`} data-import-row={row.id}>
              <button type="button" className="import-row-head" onClick={() => setOpen(open === row.id ? null : row.id)} aria-expanded={open === row.id}>
                <strong>{row.name || "(no name)"}</strong>
                {row.kind && <i className="import-kind">{row.kind}</i>}
                <Outcome row={row} />
                <span className="import-row-sources">{row.sources.join(" + ")}</span>
                {row.issues.filter((i) => i.severity !== "note").length > 0 && (
                  <i className="import-flag">{row.issues.filter((i) => i.severity !== "note").length}</i>
                )}
              </button>

              {open === row.id && (
                <div className="import-row-body">
                  {row.issues.map((issue, i) => (
                    <p key={i} className={`import-issue ${issue.severity}`}>{SEVERITY_ICON[issue.severity]} {issue.message}</p>
                  ))}

                  {row.changes.length > 0 && (
                    <div className="import-changes">
                      {row.changes.map((change) => (
                        <span key={change.key}><b>{change.key}</b> {change.from || "—"} <ArrowRight size={11} /> {change.to}</span>
                      ))}
                    </div>
                  )}

                  <div className="import-values">
                    {row.attributes.map((attribute) => (
                      <div key={attribute.key} className={attribute.others.length ? "conflict" : ""}>
                        <b>{attribute.key}</b>
                        <span>{attribute.value}</span>
                        <small>{attribute.from}</small>
                        {/* A value read from prose shows the sentence: an unquotable claim is an assertion (§5.38). */}
                        {attribute.quote && <q className="import-quote">{attribute.quote}</q>}
                        {attribute.others.map((other, i) => (
                          <em key={i} title="Kept, but not written — the file above it in the trust order won">
                            {other.value} · {other.from}
                            {other.quote && <q className="import-quote">{other.quote}</q>}
                          </em>
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

                  {(row.relations.length > 0 || row.parent) && (
                    <div className="import-relations">
                      {/* Containment first, and worded as containment: it is where the thing lives,
                          not something it points at. */}
                      {row.parent && <span className="import-parent" data-row-parent>inside <ArrowRight size={10} /> {row.parent}</span>}
                      {row.relations.map((relation, i) => <span key={i}>{relation.kind} <ArrowRight size={10} /> {relation.target}</span>)}
                    </div>
                  )}

                  <p className="import-provenance">
                    {row.rows.map((r) => `${r.source} row ${r.row}`).join(" · ")}
                    {row.key && ` · key ${row.key}`}
                  </p>

                  {staged && (
                    <div className="import-decide">
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

      {shown.length > 300 && <p className="import-empty">Showing the first 300 of {shown.length}. Narrow it with the filters above, or draw it on a board.</p>}

      {staged && shown.length > 0 && filter === "questions" && (
        <div className="import-bulk">
          <button type="button" className="ghost-button" disabled={pending} onClick={() => decide(shown.map((r) => r.id), "accept")}>
            <Check size={13} /> Accept all {shown.length} of these
          </button>
          <button type="button" className="ghost-button" disabled={pending} onClick={() => decide(shown.map((r) => r.id), "hold")}>
            <Pause size={13} /> Hold them all
          </button>
        </div>
      )}
      <p className="import-footnote">
        Batch {batch.id} · staged {new Date(batch.createdAt).toLocaleString()} · <a href={`/w/${slug}/import`}>all batches</a>
      </p>
    </section>
  );
}

function Outcome({ row }: { row: RowView }) {
  if (row.decision === "hold") return <i className="import-outcome held">held</i>;
  if (row.decision === "reject") return <i className="import-outcome rejected">rejected</i>;
  if (row.match.how === "none") return <i className="import-outcome create">new</i>;
  if (row.changes.length) return <i className="import-outcome update">changes {row.changes.length}</i>;
  return <i className="import-outcome quiet">unchanged</i>;
}
