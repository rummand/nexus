"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check, Layers, X } from "lucide-react";
import type { MetaModel } from "@/lib/metamodel";
import { FAMILIES, adoptedLine, byFamily, planApply, planSummary } from "@/lib/frameworks";
import { abandonFramework, adoptFramework } from "@/lib/metamodel-actions";

/**
 * Model in somebody's notation, or in none (§5.57).
 *
 * A workspace's model could only ever grow from whatever got imported, which is the right default
 * and a poor starting point: the vocabulary of the estate ends up being the column headings of
 * somebody else's spreadsheet. But the deeper thing an architect chooses is not a set of types —
 * it is a *way of describing systems*, and those have names: C4, UML, DDD, SysML, IT4IT, SAFe.
 *
 * So each entry says what question it answers, where the practice comes from, what its layers are,
 * and exactly what adopting it would add — worked out against the model as it stands, so the answer
 * is true for *this* workspace rather than for an empty one. More than one can be adopted: the
 * software drawn in C4, the domain in DDD, the funding in SAFe.
 */
export function Frameworks({
  model, workspaceId, adopted, onChanged,
}: { model: MetaModel; workspaceId: string; adopted: string[]; onChanged: () => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = byFamily();

  return (
    <div className="frameworks" data-frameworks>
      <p className="framework-adopted" data-adopted-line>
        <Layers size={14} />
        <span>{adoptedLine(adopted)}</span>
      </p>
      <p className="muted">
        A model grows out of the work here, so nothing below is required — free form is a real
        answer. But an architect who already thinks in containers and components should not have to
        retype the C4 model to use it, and adopting one only ever <strong>adds</strong>: anything
        you have already declared is left exactly as it is.
      </p>

      {groups.map(({ family, frameworks }) => {
        const meta = FAMILIES.find((f) => f.id === family)!;
        return (
          <section key={family} className="framework-family" data-family={family}>
            <h4>{meta.name}<small>{meta.blurb}</small></h4>

            {frameworks.map((fw) => {
              const plan = planApply(fw, model);
              const open = chosen === fw.id;
              const isAdopted = adopted.includes(fw.id);
              return (
                <article key={fw.id} className={open ? "framework open" : "framework"} data-framework={fw.id}>
                  <button type="button" onClick={() => { setChosen(open ? null : fw.id); setError(null); }} aria-expanded={open}>
                    <BookOpen size={14} />
                    <span>
                      <b>{fw.name}</b>
                      <small>{fw.blurb}</small>
                    </span>
                    {isAdopted && <i className="framework-badge"><Check size={12} /> adopted</i>}
                  </button>

                  {open && (
                    <div className="framework-body">
                      <p className="framework-answers"><b>Answers:</b> {fw.answers}</p>
                      <p className="framework-grounding">{fw.grounding}</p>

                      {fw.layers.length > 0 && (
                        <ol className="framework-layers">
                          {fw.layers.map((l, i) => (
                            <li key={l.key}>
                              <i>{i + 1}</i>
                              <b>{l.name}</b>
                              <small>{l.blurb}</small>
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="framework-lists">
                        <div>
                          <h5>Object types</h5>
                          <ul>
                            {fw.nodeTypes.map((t) => (
                              <li key={t.name}>
                                <span style={{ background: t.color }} />
                                <b>{t.name}</b>
                                {t.layer && <em>{fw.layers.find((l) => l.key === t.layer)?.name ?? t.layer}</em>}
                                <small>{t.fields.length ? t.fields.map((f) => f.key).join(" · ") : "no fields"}</small>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5>Relation types</h5>
                          <ul>
                            {fw.relationTypes.map((t) => (
                              <li key={t.name}>
                                <b>{t.name}</b>
                                <small>{t.rules.map((r) => `${r.from} → ${r.to}`).join(" · ")}</small>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="framework-apply">
                        <span>{planSummary(plan)}</span>
                        {isAdopted && plan.noop ? (
                          <button
                            type="button"
                            className="link-button"
                            disabled={pending}
                            data-abandon-framework={fw.id}
                            onClick={() => start(async () => {
                              const r = await abandonFramework(workspaceId, fw.id);
                              if ("error" in r) { setError(r.error); return; }
                              setDone(null);
                              onChanged();
                            })}
                          >
                            <X size={12} /> Stop modelling with this
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="primary-home-button"
                            disabled={pending}
                            data-adopt-framework={fw.id}
                            onClick={() => start(async () => {
                              const r = await adoptFramework(workspaceId, fw.id);
                              if ("error" in r) { setError(r.error); return; }
                              setDone(fw.id);
                              onChanged();
                            })}
                          >
                            {pending ? "Adopting…" : isAdopted ? "Bring it up to date" : "Adopt in this workspace"}
                          </button>
                        )}
                      </div>
                      {done === fw.id && <p className="framework-ok">Adopted. Nothing was renamed and no object was touched.</p>}
                      {isAdopted && plan.noop && (
                        <p className="muted framework-foot">
                          Stopping only removes the statement that this workspace models with {fw.name}.
                          The types it brought stay, because by now they may hold objects — delete them
                          one at a time, having looked at what is in them.
                        </p>
                      )}
                      {error && <p className="form-error">{error}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
