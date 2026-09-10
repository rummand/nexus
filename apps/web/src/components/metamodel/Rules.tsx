"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { addRule, deleteRule } from "@/lib/metamodel-actions";
import {
  blockedFrom, filterTriples, ruleSummary, triples,
  type RuleFilter, type Triple,
} from "@/lib/metamodel-rules";
import type { MetaModel } from "@/lib/metamodel";

/**
 * Relationship rules, one triple to a row (§5.67).
 *
 * The whole screen is one sentence repeated: *source → relationship → target*, with a status and
 * a count. That is the shape of the question a meta-model answers about connections, and it was
 * previously only visible by opening one relationship type at a time and reading two separate
 * lists inside it.
 *
 * The observed rows are the point. Every other tool treats "the data does something the model
 * does not allow" as a violation to be cleaned up; here it is the estate proposing the rest of
 * the model, and promoting it is one click. That is §2.2 at the grain of a single statement.
 */

const STATUS: Record<Triple["status"], { label: string; hint: string }> = {
  "in-use": { label: "in use", hint: "Declared, and the estate does it." },
  unused: { label: "unused", hint: "Declared, and nothing does it yet. A future that has not arrived, or a gap." },
  observed: { label: "observed", hint: "The data does this and nobody declared it." },
};

export function Rules({ model, slug }: { model: MetaModel; slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<RuleFilter>("all");

  const all = useMemo(() => triples(model), [model]);
  const summary = useMemo(() => ruleSummary(all), [all]);
  const shown = useMemo(() => filterTriples(all, query, only), [all, query, only]);

  const run = (fn: () => Promise<{ error?: string } | unknown>, said?: string) => {
    setError(null);
    setNote(null);
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && "error" in r && r.error) { setError(r.error); return; }
      if (said) setNote(said);
      router.refresh();
    });
  };

  const chip = (key: RuleFilter, n: number, label: string) => (
    <button
      type="button"
      className={`meta-chip ${only === key ? "on" : ""} ${key === "observed" && n > 0 ? "live" : ""}`}
      disabled={n === 0 && key !== "all"}
      onClick={() => setOnly(only === key ? "all" : key)}
      data-rule-filter={key}
    >
      <b>{n}</b> {label}
    </button>
  );

  return (
    <section className="meta-rules" data-meta-rules>
      <div className="meta-rules-head">
        <p className="meta-verdict" data-rules-verdict>{summary.verdict}</p>
        <div className="meta-chips">
          {chip("in-use", summary.inUse, "in use")}
          {chip("unused", summary.unused, "unused")}
          {chip("observed", summary.observed, "observed")}
        </div>
      </div>

      <input
        className="meta-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a source, a relationship or a target"
        aria-label="Search rules"
        data-rules-search
      />

      {error && <p className="form-error"><AlertTriangle size={13} /> {error}</p>}
      {note && <p className="admin-note"><Check size={13} /> {note}</p>}

      {shown.length === 0 ? (
        <p className="meta-empty" data-rules-empty>
          {all.length === 0
            ? "No relationships yet. Connect two things on a board and the pairing shows up here, ready to be made a rule."
            : "Nothing matches."}
        </p>
      ) : (
        <table className="meta-rules-table" data-rules-table>
          <thead>
            <tr>
              <th>Source</th>
              <th />
              <th>Relationship</th>
              <th />
              <th>Target</th>
              <th className="num">Connections</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const blocked = blockedFrom(t);
              return (
                <tr key={t.id} className={t.status} data-triple={t.id}>
                  <td><b>{t.from}</b></td>
                  <td className="arrow"><ArrowRight size={12} /></td>
                  <td className="rel">
                    {t.relation}
                    {t.cardinality && <em title="Cardinality this rule declares">{t.cardinality}</em>}
                  </td>
                  <td className="arrow"><ArrowRight size={12} /></td>
                  <td><b>{t.to}</b></td>
                  <td className="num">{t.instances ? t.instances.toLocaleString() : "—"}</td>
                  <td>
                    <i className={`meta-triple-status ${t.status}`} title={STATUS[t.status].hint}>
                      {STATUS[t.status].label}
                    </i>
                  </td>
                  <td className="act">
                    {t.status === "observed" ? (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={pending || Boolean(blocked)}
                        title={blocked ?? `Make "${t.from} ${t.relation} ${t.to}" a rule of the model`}
                        data-declare-rule
                        onClick={() => run(
                          () => addRule(t.relationTypeId!, t.from, t.to),
                          `"${t.from} ${t.relation} ${t.to}" is a rule now.`,
                        )}
                      >
                        <Plus size={13} /> Make it a rule
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost-button danger"
                        disabled={pending}
                        aria-label={`Remove the rule ${t.from} ${t.relation} ${t.to}`}
                        title={t.instances
                          ? `Remove this rule. The ${t.instances.toLocaleString()} connections stay; they stop being ones the model allows.`
                          : "Remove this rule. Nothing does it."}
                        data-remove-rule
                        onClick={() => run(() => deleteRule(t.ruleId!), "Rule removed. Nothing in the estate was touched.")}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="meta-rules-foot">
        Nothing here blocks anybody. A connection the model does not allow is still drawn, still
        saved, and still counted — it appears as <b>observed</b> until somebody decides whether
        the data is wrong or the model is. <a href={`/w/${slug}/graph`}>Estate health</a> asks the
        other question: whether the estate is in good shape by standards nobody here chose.
      </p>
    </section>
  );
}
