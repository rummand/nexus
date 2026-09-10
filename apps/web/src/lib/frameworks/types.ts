import type { MetaModel } from "../metamodel";

/**
 * A modelling framework: a named, self-contained way of describing an architecture (§5.57).
 *
 * §5.56 shipped three "standard models" — an application portfolio and two neighbours — as
 * starting points. This is the same machinery with the idea taken seriously. An organisation does
 * not only choose *which types* it wants; it chooses a **way of describing things**, and those ways
 * have names people already argue about: C4, UML, DDD, SysML, IT4IT, SAFe. Ardoq's insight is that
 * such a notation is not a feature of the drawing tool but *a metamodel you adopt*, so a workspace
 * can hold several at once and say which one a given type came from.
 *
 * Which is what a framework is here: object types with fields, relation types with rules, and two
 * things a bare "standard model" did not have —
 *
 * - **layers**, because most of these frameworks are layered (C4's four zoom layers, SAFe's
 *   portfolio-to-team, IT4IT's four value streams) and a type without its level is half a type;
 * - **provenance**, carried down onto every type it declares, so a year later the model can still
 *   answer "who said an Aggregate was a thing here" — us, or Eric Evans.
 *
 * Free form remains the default. Adopting nothing is a legitimate way to run a workspace, and it
 * is what §2.2 means by letting the model grow out of the work.
 */

export type FrameworkFamily = "notation" | "domain" | "operating-model" | "portfolio";

export const FAMILIES: Array<{ id: FrameworkFamily; name: string; blurb: string }> = [
  { id: "notation", name: "Notations", blurb: "Ways of drawing a system so another engineer reads it the same way." },
  { id: "domain", name: "Domain and engineering methods", blurb: "Ways of decomposing a problem before deciding what to build." },
  { id: "operating-model", name: "Operating models", blurb: "Ways of running and funding the organisation that builds it." },
  { id: "portfolio", name: "Portfolio models", blurb: "The estate itself: what we own, what it costs, what it supports." },
];

export interface FrameworkField {
  key: string;
  dataType: "text" | "number" | "date" | "boolean" | "enum" | "url";
  description: string;
  required?: boolean;
  options?: string[];
}

export interface FrameworkNodeType {
  name: string;
  description: string;
  color: string;
  /** Name of another type in the same framework. */
  parent?: string;
  /** Key of one of the framework's layers. */
  layer?: string;
  fields: FrameworkField[];
}

export interface FrameworkRelationType {
  name: string;
  description: string;
  rules: Array<{ from: string; to: string; cardinality: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" }>;
}

export interface FrameworkLayer {
  key: string;
  name: string;
  blurb: string;
}

export interface Framework {
  id: string;
  name: string;
  family: FrameworkFamily;
  blurb: string;
  /** The question this framework exists to answer, so somebody can tell whether it is theirs. */
  answers: string;
  /** Where the practice comes from. A framework with no provenance is a set of assertions. */
  grounding: string;
  /** Ordered, coarsest first. Empty for a framework that is not layered. */
  layers: FrameworkLayer[];
  nodeTypes: FrameworkNodeType[];
  relationTypes: FrameworkRelationType[];
}

export interface ApplyPlan {
  nodeTypes: { add: string[]; already: string[] };
  fields: { add: Array<{ type: string; key: string }>; already: Array<{ type: string; key: string }> };
  relationTypes: { add: string[]; already: string[] };
  rules: { add: Array<{ type: string; from: string; to: string }>; already: Array<{ type: string; from: string; to: string }> };
  /** Nothing at all to do — the model is already in place. */
  noop: boolean;
}

const key = (v: string) => v.trim().toLowerCase();

/**
 * What adopting this framework would change, worked out before anything is written.
 *
 * Additive by construction: a name that already exists is left exactly as it is, including its
 * description and its fields, because the workspace's own words beat a template's. That is what
 * makes this safe to offer to a workspace that already has a model rather than only to an empty
 * one — and it is what makes adopting the same framework twice a no-op.
 */
export function planApply(fw: Framework, existing: MetaModel): ApplyPlan {
  const haveNode = new Map(existing.nodeTypes.filter((t) => t.id).map((t) => [key(t.name), t]));
  const haveRel = new Map(existing.relationTypes.filter((t) => t.id).map((t) => [key(t.name), t]));

  const plan: ApplyPlan = {
    nodeTypes: { add: [], already: [] },
    fields: { add: [], already: [] },
    relationTypes: { add: [], already: [] },
    rules: { add: [], already: [] },
    noop: false,
  };

  for (const t of fw.nodeTypes) {
    const found = haveNode.get(key(t.name));
    if (found) plan.nodeTypes.already.push(t.name);
    else plan.nodeTypes.add.push(t.name);
    const declaredKeys = new Set((found?.fields ?? []).filter((f) => f.id).map((f) => key(f.key)));
    for (const f of t.fields) {
      (declaredKeys.has(key(f.key)) ? plan.fields.already : plan.fields.add).push({ type: t.name, key: f.key });
    }
  }

  for (const t of fw.relationTypes) {
    const found = haveRel.get(key(t.name));
    if (found) plan.relationTypes.already.push(t.name);
    else plan.relationTypes.add.push(t.name);
    const declaredRules = new Set((found?.rules ?? []).map((r) => `${key(r.fromType)}>${key(r.toType)}`));
    for (const r of t.rules) {
      const where = declaredRules.has(`${key(r.from)}>${key(r.to)}`) ? plan.rules.already : plan.rules.add;
      where.push({ type: t.name, from: r.from, to: r.to });
    }
  }

  plan.noop = plan.nodeTypes.add.length === 0 && plan.fields.add.length === 0
    && plan.relationTypes.add.length === 0 && plan.rules.add.length === 0;
  return plan;
}

/** One sentence describing what pressing the button will do. */
export function planSummary(plan: ApplyPlan): string {
  if (plan.noop) return "Everything in this framework is already declared here.";
  const parts: string[] = [];
  const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (plan.nodeTypes.add.length) parts.push(say(plan.nodeTypes.add.length, "object type", "object types"));
  if (plan.fields.add.length) parts.push(say(plan.fields.add.length, "field", "fields"));
  if (plan.relationTypes.add.length) parts.push(say(plan.relationTypes.add.length, "relation type", "relation types"));
  if (plan.rules.add.length) parts.push(say(plan.rules.add.length, "rule", "rules"));
  const kept = plan.nodeTypes.already.length + plan.relationTypes.already.length;
  const tail = kept ? `, leaving the ${kept} you already have untouched` : "";
  return `Adds ${parts.join(", ")}${tail}.`;
}
