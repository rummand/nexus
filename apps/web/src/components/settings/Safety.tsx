import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { AuditRow } from "@/lib/source/audit";

/**
 * The read-only safety audit (#111, §5.99).
 *
 * "Can this tool change our LeanIX workspace?" is the first question every EA tooling buyer asks,
 * and until this page existed the answer was a sentence somebody at Nexus wrote. A sentence is not
 * evidence. This page gives two things instead: **the rule**, stated per connector in the same
 * words the code enforces, and **the log** of every read that was actually made.
 *
 * A server component on purpose — there is nothing to press. A control on this page would imply
 * the promise is a setting somebody can turn off, and it is not: it is in the client, above the
 * fetch, and the only way to change it is to change the code and fail its test.
 */

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
};

const num = (n: number) => n.toLocaleString("en-GB");

export function Safety({ rows }: { rows: AuditRow[] }) {
  return (
    <section className="studio-home-main" aria-label="Safety" data-safety>
      <header className="studio-home-topbar">
        <div>
          <span>What Nexus may do to your systems</span>
          <h1>Safety</h1>
          <p className="roadmap-lede">
            Nexus reads systems of record. It does not write to them — and that is a rule in the
            code rather than a habit of it. Below: the rule per connector, in the words it is
            enforced in, and every read that has actually been made.
          </p>
        </div>
      </header>

      <div className="safety-contracts">
        {rows.map((row) => (
          <article
            key={row.connector}
            /* The honest connector is the one that says where the promise stops. */
            className={row.guaranteed ? "safety-card" : "safety-card open"}
            data-contract={row.connector}
          >
            <h2>
              {row.guaranteed ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              {row.label}
              <span>{row.guaranteed ? "Read-only, enforced" : "Not a read-only guarantee"}</span>
            </h2>
            <p className="safety-rule">{row.enforcement}</p>

            {row.reads.length === 0 ? (
              <p className="safety-empty">Nothing has been read through this yet.</p>
            ) : (
              <table className="safety-reads" data-reads={row.connector}>
                <thead>
                  <tr><th>When</th><th>From</th><th>Read</th><th>By</th></tr>
                </thead>
                <tbody>
                  {row.reads.map((read) => (
                    <tr key={read.id}>
                      <td title={read.at}>{ago(read.at)}</td>
                      <td>{read.host || "—"}</td>
                      <td>
                        {num(read.objects)} object{read.objects === 1 ? "" : "s"}
                        {read.relations ? `, ${num(read.relations)} relations` : ""}
                        {read.ms ? <small> · {(read.ms / 1000).toFixed(1)}s</small> : null}
                      </td>
                      <td>{read.by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        ))}
      </div>

      <p className="safety-foot">
        Every request to a source of record is checked before it is sent. A write is refused inside
        Nexus rather than declined by the far end, so it never reaches the network — and a document
        the check cannot recognise is refused too, rather than forwarded and hoped about.
      </p>
    </section>
  );
}
