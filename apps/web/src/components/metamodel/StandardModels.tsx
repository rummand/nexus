"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check } from "lucide-react";
import type { MetaModel } from "@/lib/metamodel";
import { STANDARD_MODELS, planApply, planSummary } from "@/lib/metamodel-standards";
import { applyStandardModel } from "@/lib/metamodel-actions";

/**
 * Start from a standard rather than from nothing (§5.56).
 *
 * A workspace's model could only ever grow from whatever got imported, which is the right default
 * and a poor starting point: the vocabulary of the estate ends up being the column headings of
 * somebody else's spreadsheet. Each of these says what question it answers, so an architect can
 * tell whether it is theirs, and exactly what applying it would add — worked out against the model
 * as it stands, so the answer is true for *this* workspace rather than for an empty one.
 */
export function StandardModels({ model, workspaceId, onApplied }: { model: MetaModel; workspaceId: string; onApplied: () => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="standard-models" data-standard-models>
      <p className="muted">
        A model grows out of the work here, so nothing below is required. But an architect starting an
        application portfolio should not have to rediscover that an application has an owner and a
        lifecycle — these are the smallest models that are still useful, and applying one only ever
        <strong> adds</strong>: anything you have already declared is left exactly as it is.
      </p>

      {STANDARD_MODELS.map((std) => {
        const plan = planApply(std, model);
        const open = chosen === std.id;
        return (
          <section key={std.id} className={open ? "standard-model open" : "standard-model"} data-standard={std.id}>
            <button type="button" onClick={() => { setChosen(open ? null : std.id); setError(null); }} aria-expanded={open}>
              <BookOpen size={14} />
              <span>
                <b>{std.name}</b>
                <small>{std.blurb}</small>
              </span>
              {plan.noop && <i className="standard-done"><Check size={12} /> in place</i>}
            </button>

            {open && (
              <div className="standard-body">
                <p className="standard-answers"><b>Answers:</b> {std.answers}</p>
                <p className="standard-grounding">{std.grounding}</p>
                <div className="standard-lists">
                  <div>
                    <h5>Object types</h5>
                    <ul>
                      {std.nodeTypes.map((t) => (
                        <li key={t.name}>
                          <span style={{ background: t.color }} />
                          <b>{t.name}</b>
                          <small>{t.fields.length ? t.fields.map((f) => f.key).join(" · ") : "no fields"}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5>Relation types</h5>
                    <ul>
                      {std.relationTypes.map((t) => (
                        <li key={t.name}>
                          <b>{t.name}</b>
                          <small>{t.rules.map((r) => `${r.from} → ${r.to}`).join(" · ")}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="standard-apply">
                  <span>{planSummary(plan)}</span>
                  <button
                    type="button"
                    className="primary-home-button"
                    disabled={pending || plan.noop}
                    data-apply-standard={std.id}
                    onClick={() => start(async () => {
                      const r = await applyStandardModel(workspaceId, std.id);
                      if ("error" in r) { setError(r.error); return; }
                      setDone(std.id);
                      onApplied();
                    })}
                  >
                    {plan.noop ? "Already applied" : pending ? "Applying…" : "Apply to this workspace"}
                  </button>
                </div>
                {done === std.id && <p className="standard-ok">Applied. Nothing was renamed and no object was touched.</p>}
                {error && <p className="form-error">{error}</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
