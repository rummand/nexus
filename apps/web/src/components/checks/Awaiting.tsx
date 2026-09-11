"use client";

import { UserCheck } from "lucide-react";
import { becauseWords, type Standing } from "@/lib/govern/owners";

/**
 * Who has still to agree, and the button for them if it is them (#141, §5.93).
 *
 * The same shape as the checks refusing a merge (§5.88) and for the same reason: a refusal that
 * names somebody is a refusal a person can act on, and "waiting on 2 approvals" sends them off
 * to look up who. Each row says *why* that owner is being asked, because an approval request
 * with no context is one that sits unanswered.
 */
export function Awaiting({ standing, pending, canSign, onSign }: {
  standing: Standing;
  pending: boolean;
  /** Which rules this person actually holds; everybody else sees the row without a button. */
  canSign: string[];
  onSign: (ruleId: string) => void;
}) {
  if (!standing.outstanding.length) return null;
  return (
    <div className="roadmap-awaiting" data-awaiting>
      <p><UserCheck size={13} /> This touches parts of the model somebody else owns.</p>
      <ul>
        {standing.outstanding.map((required) => (
          <li key={required.rule.id} data-awaiting-rule={required.rule.id}>
            <span>{becauseWords(required)}</span>
            {canSign.includes(required.rule.id) && (
              <button type="button" className="ghost-button" disabled={pending} onClick={() => onSign(required.rule.id)} data-approve-rule={required.rule.id}>
                Approve
              </button>
            )}
          </li>
        ))}
      </ul>
      {standing.given.length > 0 && (
        <p className="roadmap-awaiting-given">
          Already approved by {standing.given.map((a) => a.byName || "somebody").join(", ")}.
        </p>
      )}
    </div>
  );
}
