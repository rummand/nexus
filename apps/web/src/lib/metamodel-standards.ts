import type { MetaModel } from "./metamodel";

/**
 * Standard metamodels to start from (§5.56).
 *
 * Until now a workspace's model could only grow from whatever happened to get imported, which is
 * the right default and a poor starting point: the first hundred objects arrive from a spreadsheet
 * somebody else designed, and the vocabulary of the estate ends up being that spreadsheet's column
 * headings. Tools like Ardoq answer this with best-practice models you apply on day one, and it is
 * a good answer — an architect starting an application portfolio does not need to rediscover that
 * an application has a lifecycle and an owner.
 *
 * Three rules kept these honest:
 *
 * - **Small.** Each of these is the smallest model that is still useful, not the largest that is
 *   still defensible. A forty-type starter model is somebody else's opinion imposed as work.
 * - **Additive.** Applying one never renames, never deletes and never touches an entity. It adds
 *   what is missing and leaves alone everything already declared — so it can be applied to a
 *   workspace that has been running for a year, and applied twice with no effect the second time.
 * - **Attributable.** Each says where its practice comes from. A starter model with no provenance
 *   is a set of assertions, and this product's habit everywhere else is to say where a claim came
 *   from.
 */

export interface StandardField {
  key: string;
  dataType: "text" | "number" | "date" | "boolean" | "enum" | "url";
  description: string;
  required?: boolean;
  options?: string[];
}

export interface StandardNodeType {
  name: string;
  description: string;
  color: string;
  /** Name of another type in the same standard model. */
  parent?: string;
  fields: StandardField[];
}

export interface StandardRelationType {
  name: string;
  description: string;
  rules: Array<{ from: string; to: string; cardinality: "one-to-one" | "one-to-many" | "many-to-many" }>;
}

export interface StandardModel {
  id: string;
  name: string;
  blurb: string;
  /** The question this model exists to answer, so somebody can tell whether it is theirs. */
  answers: string;
  grounding: string;
  nodeTypes: StandardNodeType[];
  relationTypes: StandardRelationType[];
}

const LIFECYCLE = ["proposed", "active", "sunset", "retired"];
const CRITICALITY = ["low", "medium", "high", "critical"];

export const STANDARD_MODELS: StandardModel[] = [
  {
    id: "application-portfolio",
    name: "Application portfolio",
    blurb: "Applications, who owns them, what they run on and what they cost — the model behind a rationalisation.",
    answers: "Which applications do we have, who is accountable for each, and which ones should we stop paying for?",
    grounding:
      "An application is a thing somebody can be accountable for, not a deployment or a licence — see “what counts as an application” in the knowledge base.",
    nodeTypes: [
      {
        name: "Application", color: "#f59e0b",
        description: "A piece of software the business names and somebody is accountable for.",
        fields: [
          { key: "owner", dataType: "text", description: "The person accountable for it, not the team that operates it.", required: true },
          { key: "lifecycle", dataType: "enum", description: "Where it is in its life.", options: LIFECYCLE, required: true },
          { key: "criticality", dataType: "enum", description: "What happens to the business without it.", options: CRITICALITY },
          { key: "annual cost", dataType: "number", description: "Total yearly run cost, in the workspace's currency." },
          { key: "retires", dataType: "date", description: "When it is expected to be gone. Empty means no decision has been taken." },
        ],
      },
      {
        name: "Business Capability", color: "#10b981",
        description: "Something the organisation is able to do. Stable; not a team and not a process.",
        fields: [{ key: "level", dataType: "number", description: "1 for the top of the map, 2 for its children, and so on." }],
      },
      {
        name: "Technology", color: "#8b5cf6",
        description: "A platform, runtime, database or language an application depends on.",
        fields: [
          { key: "lifecycle", dataType: "enum", description: "Where it is in its life.", options: LIFECYCLE },
          { key: "end of support", dataType: "date", description: "When the vendor stops fixing it." },
        ],
      },
      {
        name: "Vendor", color: "#64748b",
        description: "An organisation supplying an application or a technology.",
        fields: [{ key: "website", dataType: "url", description: "" }],
      },
      {
        name: "Organisation", color: "#0ea5e9",
        description: "A business unit, department or team that uses what the portfolio provides.",
        fields: [],
      },
    ],
    relationTypes: [
      { name: "supports", description: "The application supports this capability.", rules: [{ from: "Application", to: "Business Capability", cardinality: "many-to-many" }] },
      { name: "depends on", description: "One application needs another to do its job.", rules: [{ from: "Application", to: "Application", cardinality: "many-to-many" }] },
      { name: "runs on", description: "The application needs this technology to run.", rules: [{ from: "Application", to: "Technology", cardinality: "many-to-many" }] },
      { name: "supplied by", description: "Who sells or maintains it.", rules: [
        { from: "Application", to: "Vendor", cardinality: "many-to-many" },
        { from: "Technology", to: "Vendor", cardinality: "many-to-many" },
      ] },
      { name: "used by", description: "Which part of the business uses it.", rules: [{ from: "Application", to: "Organisation", cardinality: "many-to-many" }] },
    ],
  },
  {
    id: "business-capability",
    name: "Business capability model",
    blurb: "What the organisation is able to do, and what supports each ability — the map executives argue over.",
    answers: "What are we able to do as an organisation, how well, and what is holding each ability up?",
    grounding:
      "A capability is an ability, not a department and not a process: it survives a reorganisation, which is what makes it worth mapping against. See “a capability is not the org chart” and “capability versus process”.",
    nodeTypes: [
      {
        name: "Business Capability", color: "#10b981",
        description: "An ability the organisation has. Named as a noun phrase, stable across reorganisations.",
        fields: [
          { key: "level", dataType: "number", description: "1 for the top of the map, 2 for its children, and so on.", required: true },
          { key: "owner", dataType: "text", description: "The executive accountable for the ability." },
          { key: "maturity", dataType: "enum", description: "How well the organisation does this today.", options: ["initial", "developing", "defined", "managed", "optimised"] },
          { key: "strategic importance", dataType: "enum", description: "How much the strategy depends on it.", options: ["low", "medium", "high"] },
        ],
      },
      {
        name: "Value Stream", color: "#f43f5e",
        description: "An end-to-end sequence that delivers something a customer values.",
        fields: [{ key: "customer", dataType: "text", description: "Who receives the value at the end." }],
      },
      {
        name: "Business Process", color: "#a855f7",
        description: "How a capability is actually carried out. Changes when the organisation changes.",
        fields: [{ key: "owner", dataType: "text", description: "" }],
      },
      { name: "Application", color: "#f59e0b", description: "Software supporting a capability.", fields: [
        { key: "owner", dataType: "text", description: "" },
        { key: "lifecycle", dataType: "enum", description: "", options: LIFECYCLE },
      ] },
    ],
    relationTypes: [
      { name: "composed of", description: "A capability breaks down into finer ones.", rules: [{ from: "Business Capability", to: "Business Capability", cardinality: "one-to-many" }] },
      { name: "realised by", description: "The process that carries the capability out.", rules: [{ from: "Business Capability", to: "Business Process", cardinality: "many-to-many" }] },
      { name: "enables", description: "The capability a value stream depends on at some stage.", rules: [{ from: "Business Capability", to: "Value Stream", cardinality: "many-to-many" }] },
      { name: "supports", description: "The software behind the ability.", rules: [{ from: "Application", to: "Business Capability", cardinality: "many-to-many" }] },
    ],
  },
  {
    id: "integration",
    name: "Integration and data flow",
    blurb: "Systems, the interfaces between them and the data that moves — the model behind an integration review.",
    answers: "What talks to what, over which interface, carrying which data, and what breaks if one end goes away?",
    grounding:
      "An interface is a thing in its own right, not a line: it has an owner, a protocol and a lifecycle, and pretending it is only an arrow is how integration estates become unmappable.",
    nodeTypes: [
      { name: "System", color: "#f59e0b", description: "Anything that sends or receives data. An application, a service, a third party.", fields: [
        { key: "owner", dataType: "text", description: "", required: true },
        { key: "lifecycle", dataType: "enum", description: "", options: LIFECYCLE },
      ] },
      { name: "Interface", color: "#0ea5e9", description: "A named way in or out of a system: an API, a file drop, a queue.", fields: [
        { key: "protocol", dataType: "enum", description: "How it is spoken to.", options: ["REST", "SOAP", "GraphQL", "file", "message queue", "database", "other"], required: true },
        { key: "direction", dataType: "enum", description: "", options: ["inbound", "outbound", "bidirectional"] },
        { key: "synchronous", dataType: "boolean", description: "Does the caller wait for an answer?" },
        { key: "documentation", dataType: "url", description: "" },
      ] },
      { name: "Data Object", color: "#38bdf8", description: "A thing the business recognises that moves between systems: a customer, an order, a meter reading.", fields: [
        { key: "classification", dataType: "enum", description: "How sensitive it is.", options: ["public", "internal", "confidential", "personal"] },
        { key: "system of record", dataType: "text", description: "Which system owns the truth about it." },
      ] },
      { name: "Integration", color: "#6366f1", description: "One end-to-end flow between two systems, over an interface.", fields: [
        { key: "frequency", dataType: "enum", description: "", options: ["real time", "hourly", "daily", "weekly", "on demand"] },
        { key: "criticality", dataType: "enum", description: "", options: CRITICALITY },
      ] },
    ],
    relationTypes: [
      { name: "exposes", description: "The system offers this interface.", rules: [{ from: "System", to: "Interface", cardinality: "one-to-many" }] },
      { name: "consumes", description: "The system calls this interface.", rules: [{ from: "System", to: "Interface", cardinality: "many-to-many" }] },
      { name: "carries", description: "The data that moves over it.", rules: [
        { from: "Interface", to: "Data Object", cardinality: "many-to-many" },
        { from: "Integration", to: "Data Object", cardinality: "many-to-many" },
      ] },
      { name: "flows from", description: "Where the integration starts.", rules: [{ from: "Integration", to: "System", cardinality: "many-to-many" }] },
      { name: "flows to", description: "Where it ends.", rules: [{ from: "Integration", to: "System", cardinality: "many-to-many" }] },
    ],
  },
];

export function standardModel(id: string): StandardModel | null {
  return STANDARD_MODELS.find((m) => m.id === id) ?? null;
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
 * What applying this standard would change, worked out before anything is written.
 *
 * Additive by construction: a name that already exists is left exactly as it is, including its
 * description and its fields, because the workspace's own words beat a template's. That is what
 * makes this safe to offer to a workspace that already has a model rather than only to an empty one.
 */
export function planApply(std: StandardModel, existing: MetaModel): ApplyPlan {
  const haveNode = new Map(existing.nodeTypes.filter((t) => t.id).map((t) => [key(t.name), t]));
  const haveRel = new Map(existing.relationTypes.filter((t) => t.id).map((t) => [key(t.name), t]));

  const plan: ApplyPlan = {
    nodeTypes: { add: [], already: [] },
    fields: { add: [], already: [] },
    relationTypes: { add: [], already: [] },
    rules: { add: [], already: [] },
    noop: false,
  };

  for (const t of std.nodeTypes) {
    const found = haveNode.get(key(t.name));
    if (found) plan.nodeTypes.already.push(t.name);
    else plan.nodeTypes.add.push(t.name);
    const declaredKeys = new Set((found?.fields ?? []).filter((f) => f.id).map((f) => key(f.key)));
    for (const f of t.fields) {
      (declaredKeys.has(key(f.key)) ? plan.fields.already : plan.fields.add).push({ type: t.name, key: f.key });
    }
  }

  for (const t of std.relationTypes) {
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
  if (plan.noop) return "Everything in this standard is already declared here.";
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
