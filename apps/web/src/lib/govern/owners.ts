import { ancestry } from "@/lib/hierarchy";

/**
 * Who has to agree before a branch lands (#141, §5.93).
 *
 * A MODELOWNERS rule, in the shape the code world settled on decades ago: *changes under Grid
 * Operations need the person who owns that capability subtree to approve*. Architecture
 * governance stops being a monthly board meeting and becomes a review queue with a service
 * level — the same move that made code review beat the design committee. The meeting exists to
 * approve things; the queue exists to approve things **and** it runs every day, keeps its own
 * record, and cannot lose an item between meetings.
 *
 * Ownership is expressed over the **containment tree** (§5.74) because that is the natural unit
 * and the only one that stays true: a capability subtree, a domain, a type. A hand-kept list of
 * objects is out of date the first time somebody adds one.
 *
 * Everything here is pure over rows so the question that matters — *given this branch, whose
 * approval is required* — is answered the same way in the gate, on the screen and in a test.
 */

/** What a rule covers. Narrower wins where two overlap, so a domain lead does not shadow a team. */
export type ScopeKind = "subtree" | "kind" | "everything";

export interface OwnerRule {
  id: string;
  scope: ScopeKind;
  /** The root entity id for a subtree, the type name for a kind, ignored for everything. */
  scopeValue: string;
  /** Exactly one of these. A team is a standing answer; a person is a faster one. */
  userId: string | null;
  teamId: string | null;
  /** For the sentence on screen: "Grid Operations", "Application", "the whole model". */
  scopeLabel: string;
  ownerLabel: string;
}

/** One object a branch touches, with what is needed to place it in the tree. */
export interface Touched {
  entityId: string;
  name: string;
  kind: string;
}

export interface Required {
  rule: OwnerRule;
  /** The objects in the branch that this rule covers, for "why am I being asked". */
  because: Touched[];
}

const norm = (v: string) => v.trim().toLowerCase();

/**
 * Which rules a branch triggers, and why.
 *
 * A rule applies to an object when the object *is* the scope root or sits anywhere beneath it,
 * when its kind matches, or when the rule covers everything. Ancestry is walked rather than
 * matched on the parent, because ownership of a domain has to survive somebody adding a level in
 * the middle of it — which is the whole reason for expressing it over the tree.
 */
export function approvalsRequired(
  touched: Touched[],
  rules: OwnerRule[],
  tree: Array<{ id: string; parentId: string | null }>,
): Required[] {
  if (!touched.length || !rules.length) return [];
  const out = new Map<string, Required>();

  for (const object of touched) {
    // The object and everything above it: ownership of a subtree covers what is inside it.
    const above = new Set<string>([object.entityId, ...ancestry(tree, object.entityId).map((a) => a.id)]);
    for (const rule of rules) {
      const applies =
        rule.scope === "everything"
        || (rule.scope === "kind" && norm(rule.scopeValue) === norm(object.kind))
        || (rule.scope === "subtree" && above.has(rule.scopeValue));
      if (!applies) continue;
      const found = out.get(rule.id) ?? { rule, because: [] };
      found.because.push(object);
      out.set(rule.id, found);
    }
  }

  /*
   * Narrowest first. When a capability lead and a workspace-wide rule both apply, the specific
   * one is the interesting one to show and the one somebody will actually chase.
   */
  const rank: Record<ScopeKind, number> = { subtree: 0, kind: 1, everything: 2 };
  return [...out.values()].sort((a, b) => rank[a.rule.scope] - rank[b.rule.scope] || a.rule.scopeLabel.localeCompare(b.rule.scopeLabel));
}

export interface Approval {
  ruleId: string;
  byName: string;
  at: string;
}

export interface Standing {
  required: Required[];
  /** Rules still waiting on somebody. */
  outstanding: Required[];
  given: Approval[];
  /** Nothing outstanding: the branch has the agreement it needs. */
  satisfied: boolean;
}

export function standingOf(required: Required[], given: Approval[]): Standing {
  const signed = new Set(given.map((a) => a.ruleId));
  const outstanding = required.filter((r) => !signed.has(r.rule.id));
  return { required, outstanding, given, satisfied: outstanding.length === 0 };
}

/**
 * What is still needed, in one sentence.
 *
 * Names the owner rather than the rule: a person chasing an approval needs to know who to ask,
 * and "waiting on 2 approvals" sends them to look it up.
 */
export function outstandingWords(standing: Standing): string {
  if (standing.satisfied) {
    return standing.required.length
      ? `Approved by ${standing.given.length === 1 ? "its owner" : `all ${standing.given.length} owners`}.`
      : "Nobody owns what this touches, so nobody has to agree.";
  }
  const names = standing.outstanding.map((r) => r.rule.ownerLabel);
  const first = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? `, and ${names.length - 3} more` : "";
  return `Waiting for ${first}${more}.`;
}

/** Why a particular owner is being asked, for the row they are reading. */
export function becauseWords(required: Required): string {
  const shown = required.because.slice(0, 3).map((t) => `“${t.name || "unnamed"}”`).join(", ");
  const more = required.because.length > 3 ? `, and ${required.because.length - 3} more` : "";
  return `${required.rule.ownerLabel} owns ${required.rule.scopeLabel}; this touches ${shown}${more}.`;
}

/**
 * May this person sign this rule?
 *
 * Approval standing is **not** write permission, and conflating the two is how both end up
 * wrong (§5.48): a domain lead who owns a capability may be entitled to approve changes under it
 * without being an administrator, and an administrator is not automatically the person whose
 * agreement the rule is asking for.
 */
export function maySign(rule: OwnerRule, who: { userId: string; teamIds: string[] }): boolean {
  if (rule.userId) return rule.userId === who.userId;
  if (rule.teamId) return who.teamIds.includes(rule.teamId);
  return false;
}

/**
 * The override, which has to exist and has to have a name on it.
 *
 * A governance rule with no way through is a rule people route around — by editing the graph
 * directly, which is the thing branches exist to prevent. So merging without the approvals is
 * possible, it is recorded as its own act with the person's name, and the sentence says plainly
 * what was skipped.
 */
export function overrideWords(standing: Standing, byName: string): string {
  const names = standing.outstanding.map((r) => r.rule.ownerLabel).join(", ");
  return `${byName} merged this without waiting for ${names}.`;
}
