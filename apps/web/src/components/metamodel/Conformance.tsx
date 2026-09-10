"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CircleCheck } from "lucide-react";
import type { Breach, BreachKind, Conformance as Report } from "@/lib/metamodel-conformance";
import { conformanceLabel } from "@/lib/metamodel-conformance";

/**
 * Where the estate departs from the model it was given (§5.56).
 *
 * A number is not the deliverable. "83% conformant" tells nobody what to do on Monday, so the
 * number is here to be clicked through: every breach names one object, says what is wrong with it
 * in a sentence, and links to the thing itself.
 */

const GROUPS: Array<{ kind: BreachKind; title: string; why: string }> = [
  { kind: "kind-undeclared", title: "Objects of a kind nobody declared", why: "Either the kind is real and should be declared, or these objects are the wrong kind." },
  { kind: "field-missing", title: "Missing a field the type requires", why: "The model says every one of these must have it." },
  { kind: "field-option", title: "A value outside its field's vocabulary", why: "Either the value is a typo or the vocabulary is too narrow." },
  { kind: "field-type", title: "A value that is not the type it was declared as", why: "A date field holding “soon” cannot be sorted, filtered or planned against." },
  { kind: "relation-undeclared", title: "Relations of a type nobody declared", why: "The vocabulary of connections grew without a decision." },
  { kind: "relation-rule", title: "Connections no rule allows", why: "Either the connection is wrong or the rule is too strict." },
];

export function Conformance({ report, slug }: { report: Report; slug: string }) {
  const [open, setOpen] = useState<BreachKind | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<BreachKind, Breach[]>();
    for (const b of report.breaches) {
      const list = map.get(b.kind) ?? [];
      list.push(b);
      map.set(b.kind, list);
    }
    return map;
  }, [report.breaches]);

  const clean = report.breaches.length === 0;

  return (
    <div className="meta-conformance" data-conformance>
      <header className="conformance-head">
        <div>
          <strong>{report.score}%</strong>
          <span>of what could be checked obeys the model</span>
        </div>
        <div>
          <strong>{report.typed}%</strong>
          <span>of the estate is of a declared type at all</span>
        </div>
      </header>
      {/* The sentence rather than the colour: a score nobody can read out loud is a decoration. */}
      <p className="conformance-verdict">{conformanceLabel(report)}</p>

      {clean && (
        <p className="conformance-clean"><CircleCheck size={15} /> Nothing in this estate breaks the declared model.</p>
      )}

      {GROUPS.map(({ kind, title, why }) => {
        const items = grouped.get(kind) ?? [];
        if (!items.length) return null;
        const isOpen = open === kind;
        return (
          <section key={kind} className="conformance-group" data-breach-group={kind}>
            <button type="button" onClick={() => setOpen(isOpen ? null : kind)} aria-expanded={isOpen}>
              <AlertTriangle size={13} />
              <b>{title}</b>
              <i>{items.length}</i>
            </button>
            {isOpen && (
              <>
                <p className="conformance-why">{why}</p>
                <ul>
                  {items.slice(0, 60).map((b, i) => (
                    <li key={`${b.subjectId}-${b.field ?? ""}-${i}`}>
                      {b.subject === "entity"
                        ? <Link href={`/e/${b.subjectId}`}>{b.subjectName}</Link>
                        : <span>{b.subjectName}</span>}
                      <small>{b.detail}</small>
                    </li>
                  ))}
                  {items.length > 60 && <li className="muted">…and {items.length - 60} more of the same.</li>}
                </ul>
              </>
            )}
          </section>
        );
      })}

      {report.byType.some((t) => t.offenders > 0) && (
        <section className="conformance-by-type">
          <h4>By type</h4>
          <table>
            <thead><tr><th>Type</th><th>Instances</th><th>Out of conformance</th></tr></thead>
            <tbody>
              {report.byType.filter((t) => t.offenders > 0).map((t) => (
                <tr key={`${t.kind}-${t.name}`}>
                  <td>{t.name}{!t.declared && <em> · not declared</em>}</td>
                  <td>{t.instances}</td>
                  <td>{t.offenders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="conformance-foot">
        Nothing here has been blocked or changed. A model grows out of the work, so conformance
        reports and leaves the decision to somebody — the data may be wrong, or the model may be.
        {" "}
        <Link href={`/w/${slug}/graph`}>Estate health</Link> asks a different question: whether this
        estate is in good shape by general standards, rather than whether it obeys your own rules.
      </p>
    </div>
  );
}
