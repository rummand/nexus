"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { MetaField } from "@/lib/metamodel";
import { canonical, valueProblem } from "@/lib/inventory";
import { setEntityAttributeAction } from "@/lib/actions";

/**
 * One editable value, edited as the thing the meta-model says it is (§5.72).
 *
 * The entity table edited every attribute as free text, including fields declared as an enum
 * with four options — which is exactly how `Active` and `active` end up in the same column, and
 * why Nexus grew a whole proposals system to normalise a mess it had allowed. A model that
 * declares a type and then ignores it when the value is typed is decoration.
 *
 * So: an enum edits as its declared options, a date as a date, a boolean as yes/no, a number as
 * a number, and a url renders as a link. An undeclared key stays free text, because the model
 * has no opinion about it and inventing one would be worse than having none.
 *
 * Two things it deliberately does not do:
 *
 * - **It never refuses to clear a value.** Requiredness is a statement about a finished record,
 *   not about a keystroke, and a field you cannot empty is a field that stays wrong.
 * - **It never silently corrects.** A value the model disallows is kept in the box with the
 *   reason beside it, so the person can see what they typed and decide. Swallowing input is how
 *   people stop trusting a form.
 */

const OPEN_ENDED = new Set(["text", "", "number", "date", "url"]);

export function InventoryCell({ entityId, column, value, field }: {
  entityId: string;
  column: string;
  value: string;
  field: MetaField | undefined;
}) {
  const [draft, setDraft] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const commit = (next: string) => {
    const why = valueProblem(field, next);
    setProblem(why);
    if (why) return;
    const stored = canonical(field, next);
    setDraft(stored);
    if (stored === value) return;
    start(async () => {
      await setEntityAttributeAction(entityId, column, stored);
    });
  };

  const type = field?.dataType ?? "";

  if (type === "enum" && field && field.options.length > 0) {
    return (
      <select
        className="inv-cell inv-enum"
        value={field.options.some((o) => o.toLowerCase() === draft.trim().toLowerCase()) ? canonical(field, draft) : draft ? "__other" : ""}
        disabled={pending}
        aria-label={column}
        data-cell={column}
        onChange={(e) => {
          if (e.target.value === "__other") return;
          setDraft(e.target.value);
          commit(e.target.value);
        }}
      >
        <option value="">not set</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        {/* A value already in the data that the model does not list. Shown, never hidden — the
            mismatch is a finding, and silently blanking it would destroy it. */}
        {draft && !field.options.some((o) => o.toLowerCase() === draft.trim().toLowerCase()) && (
          <option value="__other">{draft} — not a declared option</option>
        )}
      </select>
    );
  }

  if (type === "boolean") {
    const yes = ["true", "yes"].includes(draft.trim().toLowerCase());
    const set = draft.trim() !== "";
    return (
      <select
        className="inv-cell inv-enum"
        value={set ? (yes ? "yes" : "no") : ""}
        disabled={pending}
        aria-label={column}
        data-cell={column}
        onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
      >
        <option value="">not set</option>
        <option value="yes">yes</option>
        <option value="no">no</option>
      </select>
    );
  }

  const inputType = type === "number" ? "number" : "text";

  return (
    <span className={`inv-cell-wrap ${problem ? "bad" : ""}`}>
      <input
        className="inv-cell"
        type={inputType}
        value={draft}
        disabled={pending}
        aria-label={column}
        data-cell={column}
        placeholder={type === "date" ? "2027-06" : ""}
        onChange={(e) => { setDraft(e.target.value); if (problem) setProblem(null); }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {type === "url" && draft && !problem && (
        <a href={draft.startsWith("http") ? draft : `https://${draft}`} target="_blank" rel="noreferrer" title={draft}>
          <ExternalLink size={11} />
        </a>
      )}
      {problem && <em title={problem}><AlertTriangle size={11} /> {problem}</em>}
      {!OPEN_ENDED.has(type) && !problem && null}
    </span>
  );
}
