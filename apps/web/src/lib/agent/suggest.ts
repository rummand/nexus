import { callModel } from "@/lib/models/call";
import type { ModelChoice } from "@/lib/models/types";
import { checkDefinition, VERBS, VERB_LABEL, type AgentDefinition, type DefinitionContext, type DefinitionInput } from "./definition";
import type { AgentGraph } from "./validate";

/**
 * An agent proposing an agent.
 *
 * This is the request that needs the most care, and the pattern the rest of the product already
 * uses answers it: a proposed agent is *just another proposal*. It is emitted in a closed language,
 * checked by a typed validator, queued, and signed by a human before it can do anything at all.
 *
 * Three rules make it safe, and none of them is a prompt:
 *
 * 1. **Capability monotonicity.** No agent may create an agent that can do something it cannot do
 *    itself, or spend more than it has. Without this, "agents building agents" is privilege
 *    escalation with a friendly name. It is enforced in `checkDefinition`, which is the same
 *    function a person's form goes through.
 * 2. **A proposed agent is not an agent yet.** It is stored with the status `proposed`, which
 *    cannot run — not even a dry run — until a person approves it. Approving makes it a *draft*,
 *    so its first opinions are still read before it is given a voice.
 * 3. **It must say what it read.** A suggestion with no reason grounded in this workspace's own
 *    model is dropped, because "you should have an agent for interfaces" is a thing anybody could
 *    say about anybody.
 */

export const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    agents: {
      type: "array",
      description: "Agents this workspace is missing. Two good ones are worth more than six.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short, and about the job — “Interface ownership”, not “Agent 3”." },
          purpose: { type: "string", description: "One or two sentences: what it should look for. This becomes its instruction." },
          scope: { type: "string", description: 'A query naming what it may read: kind:Interface, missing:owner, on:"OT landscape".' },
          verbs: {
            type: "array",
            items: { type: "string", enum: [...VERBS] },
            description: "What it may propose. Ask for the fewest that do the job.",
          },
          why: { type: "string", description: "What you read in this model that says this agent is needed. Name the numbers." },
        },
        required: ["name", "purpose", "scope", "verbs", "why"],
      },
    },
    note: { type: "string", description: "One sentence about the fleet as a whole, or what you could not tell." },
  },
  required: ["agents"],
} as const;

export interface SuggestedAgent {
  input: DefinitionInput;
  why: string;
}

export interface SuggestReview {
  suggested: SuggestedAgent[];
  /** Suggestions that were refused, and why — shown, never swallowed. */
  rejected: string[];
  note: string;
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Check what came back, against the same rules a person's form obeys.
 *
 * `ctx` carries the parent's verbs and budget, so monotonicity is not a special case here — it is
 * the ordinary definition check with two extra fields filled in.
 */
export function validateSuggestions(raw: unknown, ctx: DefinitionContext, ownerTeamId: string | null, existing: string[]): SuggestReview {
  const rejected: string[] = [];
  const suggested: SuggestedAgent[] = [];
  if (!raw || typeof raw !== "object") return { suggested, rejected: ["the model returned nothing usable"], note: "" };

  const list = (raw as { agents?: unknown }).agents;
  const note = str((raw as { note?: unknown }).note, 400);
  if (!Array.isArray(list)) return { suggested, rejected: ["the model suggested no agents"], note };

  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (const item of list.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const name = str(p.name, 80);
    const why = str(p.why, 400);
    const label = name || "an unnamed agent";

    if (!why) { rejected.push(`${label}: gave no reason from this model`); continue; }
    if (taken.has(name.toLowerCase())) { rejected.push(`${label}: there is already an agent by that name`); continue; }

    const input: DefinitionInput = {
      name,
      purpose: str(p.purpose, 600),
      ownerTeamId,
      scope: str(p.scope, 300),
      verbs: Array.isArray(p.verbs) ? p.verbs.map((v) => str(v, 40)) : [],
      grounding: "modelling",
      budget: { runsPerDay: Math.min(4, ctx.parentBudget?.runsPerDay ?? 4), maxProposals: Math.min(10, ctx.parentBudget?.maxProposals ?? 10) },
      status: "proposed",
    };
    const check = checkDefinition(input, ctx);
    if (!check.ok) { rejected.push(`${label}: ${check.errors.join(" ")}`); continue; }
    taken.add(name.toLowerCase());
    suggested.push({ input, why });
  }
  return { suggested, rejected, note };
}

const SYSTEM = `You look at an organisation's architecture model and at the agents already watching it, and you say what agent is missing.

An agent here is: a name, a purpose in plain English, a scope that says what it may read, and the
changes it may propose. It cannot do anything else — it reads, and it suggests corrections that a
person accepts or dismisses.

Rules that matter more than being helpful:

- Name what you read. "Forty-one interfaces have no owner and no agent is watching them" is a
  reason. "It would be good to have an agent for interfaces" is not.
- Propose the fewest verbs that do the job. An agent that only fills in attributes is easier to
  trust than one that can also merge objects.
- Scope narrowly. An agent that reads everything is one nobody can account for.
- Do not duplicate an agent that already exists, and do not propose one whose scope matches nothing.
- Two good agents beat six. If the fleet already covers the model, say so and suggest none.
- You may not propose an agent that can do something you cannot do yourself.`;

function digest(graph: AgentGraph, agents: AgentDefinition[], parent: AgentDefinition): string {
  const kinds = new Map<string, number>();
  const missing = new Map<string, number>();
  for (const e of graph.entities) {
    kinds.set(e.kind || "(no kind)", (kinds.get(e.kind || "(no kind)") ?? 0) + 1);
    const keys = Object.keys(e.attributes);
    for (const key of ["owner", "lifecycle", "criticality"]) {
      if (!keys.some((k) => k.toLowerCase() === key)) missing.set(key, (missing.get(key) ?? 0) + 1);
    }
  }
  const untyped = graph.entities.filter((e) => !e.kind.trim()).length;
  const unconnected = graph.entities.filter((e) => !graph.relations.some((r) => r.fromEntityId === e.id || r.toEntityId === e.id)).length;

  return [
    `The model has ${graph.entities.length} objects and ${graph.relations.length} relations.`,
    `Kinds: ${[...kinds.entries()].map(([k, n]) => `${k} (${n})`).join(", ") || "none"}.`,
    `Objects with no kind: ${untyped}. Objects connected to nothing: ${unconnected}.`,
    `Objects missing an attribute: ${[...missing.entries()].map(([k, n]) => `${k} (${n})`).join(", ") || "none"}.`,
    ``,
    `Agents already here:`,
    ...(agents.length
      ? agents.map((a) => `- ${a.name} [${a.status}] reads ${a.scope}, may ${a.verbs.join(", ") || "nothing"} — ${a.purpose}`)
      : ["- none"]),
    ``,
    `You are “${parent.name}”. You may ${parent.verbs.map((v) => VERB_LABEL[v]).join("; ")}, ${parent.budget.runsPerDay} runs a day, ${parent.budget.maxProposals} proposals a run.`,
    `Anything you propose must stay inside that. Answer with suggest_agents.`,
  ].join("\n");
}

export async function suggestWithModel(
  graph: AgentGraph,
  agents: AgentDefinition[],
  parent: AgentDefinition,
  choice: ModelChoice,
  ctx: DefinitionContext,
  ownerTeamId: string | null,
): Promise<SuggestReview> {
  const body = await callModel(choice, {
    max_tokens: 3000,
    system: SYSTEM,
    tools: [{ name: "suggest_agents", description: "Suggest agents this workspace is missing.", input_schema: SUGGEST_SCHEMA }],
    tool_choice: { type: "tool", name: "suggest_agents" },
    messages: [{ role: "user", content: digest(graph, agents, parent) }],
  });
  const call = body.content?.find((c) => c.type === "tool_use" && c.name === "suggest_agents");
  return validateSuggestions(call?.input ?? {}, ctx, ownerTeamId, agents.map((a) => a.name));
}
