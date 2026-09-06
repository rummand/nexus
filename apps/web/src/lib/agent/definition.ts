import type { ProposalAction } from "../graph-types";
import { describeQuery, parseQuery } from "../query";

/**
 * An agent, described.
 *
 * Until now every agent in Nexus was a hand-written module: the graph agent read the whole
 * workspace, could propose all five changes, and answered to nobody. That is fine for one agent
 * and untenable for a fleet — "what is this thing allowed to do" should be answerable by a person
 * reading a screen, not by us reading code.
 *
 * So an agent is a *definition*: a name, a purpose somebody can judge it against, an owner who is
 * answerable for it, a scope that says what it may read, the verbs it may use, a budget, and a
 * status. Everything in that list exists because somebody will one day have to defend the fleet to
 * a security review, and every field is the answer to one of the questions they will be asked.
 *
 * This module is pure — the shape and the rules, with no database — so the rules can be tested
 * without a workspace and, more importantly, so they are in one readable place.
 */

/** The five changes that exist. An agent may be given any subset; none of them writes anything. */
export const VERBS = ["setKind", "renameKind", "merge", "setAttribute", "addRelation"] as const;
export type Verb = (typeof VERBS)[number];

export const VERB_LABEL: Record<Verb, string> = {
  setKind: "give an object a kind",
  renameKind: "spell a kind one way",
  merge: "say two objects are one",
  setAttribute: "fill in an attribute",
  addRelation: "draw a relation nobody has drawn",
};

/**
 * `merge` is the one proposal a person cannot fully undo by hand afterwards, so it is not given
 * out by default and is called out wherever an agent has it.
 */
export const CONSEQUENTIAL: ReadonlySet<Verb> = new Set(["merge"]);

export const STATUSES = ["draft", "active", "paused", "retired"] as const;
export type AgentStatus = (typeof STATUSES)[number];

export const STATUS_NOTE: Record<AgentStatus, string> = {
  draft: "Runs as a dry run: you see what it would have proposed, and nothing reaches the review queue.",
  active: "Runs for real. What it proposes goes to the review queue on the Knowledge graph page.",
  paused: "Will not run. Its history is kept.",
  retired: "Finished. Kept so its record outlives it.",
};

/**
 * Which doctrine grounds it (§5.20). Only the scopes that are about the model itself are offered:
 * an agent reviewing the graph is not helped by the corpus on reading transcripts.
 */
export const GROUNDINGS = ["", "modelling", "metamodel", "health"] as const;
export type Grounding = (typeof GROUNDINGS)[number];

export const GROUNDING_LABEL: Record<Grounding, string> = {
  "": "None — its purpose is the whole instruction",
  modelling: "Modelling doctrine — what a capability is, what a component is",
  metamodel: "Meta-model doctrine — kinds, relation types, attribute keys",
  health: "Estate health — what makes a model trustworthy",
};

export const isGrounding = (v: string): v is Grounding => (GROUNDINGS as readonly string[]).includes(v);

/** Manual for now. A schedule is a trigger, and a trigger needs a runtime; both come later. */
export const TRIGGERS = ["manual"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export interface AgentDefinition {
  id: string;
  workspaceId: string;
  name: string;
  /** One sentence a person can judge the agent against. It is also the instruction it is given. */
  purpose: string;
  /** Who is answerable for it. Never null: an agent nobody owns is nobody's to switch off. */
  ownerTeamId: string | null;
  ownerTeamName: string;
  /** A graph query. What it may read — never everything by default. */
  scope: string;
  verbs: Verb[];
  /** Which part of the EA corpus grounds it, or "" for none. */
  grounding: Grounding;
  /** A configured provider, or null to use whatever the graph-agent task is set to. */
  providerId: string | null;
  /** Overrides the provider's model id. */
  model: string;
  trigger: Trigger;
  budget: Budget;
  status: AgentStatus;
  /** Which definition proposed this one, when an agent wrote it. Null for one a person wrote. */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  /** Runs per day. Counted server-side before the model is called. */
  runsPerDay: number;
  /** How many proposals one run may leave behind. A reviewer who sees forty stops reading. */
  maxProposals: number;
}

export const DEFAULT_BUDGET: Budget = { runsPerDay: 12, maxProposals: 15 };
const BUDGET_CEILING: Budget = { runsPerDay: 96, maxProposals: 40 };

/** The definition as a form sends it — every field a string or a list of strings. */
export interface DefinitionInput {
  name: string;
  purpose: string;
  ownerTeamId: string | null;
  scope: string;
  verbs: string[];
  grounding?: string;
  providerId?: string | null;
  model?: string;
  budget?: Partial<Budget>;
  status?: string;
}

export interface DefinitionContext {
  /** Teams that exist in this workspace. An owner must be one of them. */
  teamIds: Set<string>;
  /** Providers configured in this workspace, if the definition names one. */
  providerIds: Set<string>;
  /**
   * The verbs the *parent* may use, when an agent is proposing an agent. Capability monotonicity:
   * nothing may create something that can do what it cannot. Undefined for a person, who may grant
   * any of the five.
   */
  parentVerbs?: Verb[];
  /** The parent's budget, when one applies: a child may not be given more than its parent has. */
  parentBudget?: Budget;
}

export interface DefinitionCheck {
  ok: boolean;
  /** Why it cannot be saved. Empty when ok. */
  errors: string[];
  /** Worth saying out loud, but not a refusal. */
  warnings: string[];
  /** The definition as it would be stored, with everything clamped and trimmed. */
  value: Omit<AgentDefinition, "id" | "workspaceId" | "ownerTeamName" | "parentId" | "createdAt" | "updatedAt">;
}

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
};

export const isVerb = (v: string): v is Verb => (VERBS as readonly string[]).includes(v);

/**
 * Check a definition before it is stored.
 *
 * The refusals are the interesting part, and each one is a thing that would otherwise be found out
 * the expensive way: an agent with no scope reads the whole estate; an agent with no owner is
 * nobody's to switch off; an agent with no verbs runs, costs money and can say nothing; and a
 * child agent with a verb its parent lacks is a privilege escalation with a friendly name.
 */
export function checkDefinition(input: DefinitionInput, ctx: DefinitionContext): DefinitionCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = input.name.trim().slice(0, 80);
  if (!name) errors.push("Give it a name. “Vocabulary reviewer” is a better name than “Agent 2”.");

  const purpose = input.purpose.trim().slice(0, 600);
  if (purpose.length < 12) {
    errors.push("Write what it is for, in a sentence. That sentence is also the instruction it gets, so a vague one produces a vague agent.");
  }

  if (!input.ownerTeamId) errors.push("Give it an owner. An agent nobody owns is nobody's to switch off.");
  else if (!ctx.teamIds.has(input.ownerTeamId)) errors.push("That team is not in this workspace.");

  const scope = input.scope.trim().slice(0, 300);
  if (!scope) {
    errors.push("Say what it may read, as a query — kind:Application, missing:owner, on:\"OT landscape\". An agent that reads everything by default is how a fleet becomes unaccountable.");
  } else if (!parseQuery(scope).structured && parseQuery(scope).text.length === 0) {
    errors.push("That scope reads as nothing at all.");
  }

  const verbs = [...new Set(input.verbs.filter(isVerb))];
  if (!verbs.length) errors.push("Choose at least one thing it may propose, or it will run, cost money and have nothing it is allowed to say.");
  if (ctx.parentVerbs) {
    const beyond = verbs.filter((v) => !ctx.parentVerbs!.includes(v));
    if (beyond.length) {
      errors.push(`Its parent cannot ${beyond.map((v) => VERB_LABEL[v]).join(", ")}, so it may not grant that. No agent may create an agent that can do something it cannot do itself.`);
    }
  }
  if (verbs.some((v) => CONSEQUENTIAL.has(v))) {
    warnings.push("Merging is the one proposal that is hard to unpick afterwards. Accepting one is still a person's click, but give this agent a tight scope.");
  }

  const budget: Budget = {
    runsPerDay: clamp(input.budget?.runsPerDay, 1, BUDGET_CEILING.runsPerDay, DEFAULT_BUDGET.runsPerDay),
    maxProposals: clamp(input.budget?.maxProposals, 1, BUDGET_CEILING.maxProposals, DEFAULT_BUDGET.maxProposals),
  };
  if (ctx.parentBudget) {
    if (budget.runsPerDay > ctx.parentBudget.runsPerDay) {
      errors.push(`Its parent runs ${ctx.parentBudget.runsPerDay} times a day; a child may not be given more.`);
    }
    if (budget.maxProposals > ctx.parentBudget.maxProposals) {
      errors.push(`Its parent leaves at most ${ctx.parentBudget.maxProposals} proposals a run; a child may not be given more.`);
    }
  }

  const providerId = input.providerId?.trim() || null;
  if (providerId && !ctx.providerIds.has(providerId)) errors.push("That model provider is not configured here.");

  const status = (STATUSES as readonly string[]).includes(input.status ?? "") ? (input.status as AgentStatus) : "draft";

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    value: {
      name,
      purpose,
      ownerTeamId: input.ownerTeamId ?? null,
      scope,
      verbs,
      grounding: isGrounding((input.grounding ?? "").trim()) ? ((input.grounding ?? "").trim() as Grounding) : "",
      providerId,
      model: (input.model ?? "").trim().slice(0, 80),
      trigger: "manual",
      budget,
      status,
    },
  };
}

/** What this agent may read, in a sentence, for the screen and for the run log. */
export const describeScope = (scope: string): string => describeQuery(parseQuery(scope));

/** Whether a proposal's action is one this agent was given. */
export function permits(verbs: Verb[], action: ProposalAction): boolean {
  return (VERBS as readonly string[]).includes(action.kind) && verbs.includes(action.kind as Verb);
}

/** Parse the stored JSON columns back into a definition's lists, defensively. */
export function parseVerbs(raw: string): Verb[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").filter(isVerb))] : [];
  } catch {
    return [];
  }
}

export function parseBudget(raw: string): Budget {
  try {
    const v = JSON.parse(raw) as Partial<Budget>;
    return {
      runsPerDay: clamp(v?.runsPerDay, 1, BUDGET_CEILING.runsPerDay, DEFAULT_BUDGET.runsPerDay),
      maxProposals: clamp(v?.maxProposals, 1, BUDGET_CEILING.maxProposals, DEFAULT_BUDGET.maxProposals),
    };
  } catch {
    return { ...DEFAULT_BUDGET };
  }
}
