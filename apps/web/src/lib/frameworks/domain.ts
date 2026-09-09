import type { Framework } from "./types";

/** Ways of decomposing a problem before deciding what to build (§5.57). */

/**
 * Domain-driven design.
 *
 * The strategic half is the half that pays: bounded contexts and the relationships between them.
 * So the context-mapping patterns are separate relation types rather than a `pattern` field on one
 * — "upstream of" and "conforms to" are different claims about power, and a team that has to pick
 * one has had the conversation the model exists to force.
 */
export const DDD: Framework = {
  id: "ddd",
  name: "Domain-driven design",
  family: "domain",
  blurb: "Bounded contexts, aggregates and the language inside each — where one team's “order” stops meaning another's.",
  answers: "Where are the seams in this domain, which team owns each, and what does each side promise the other?",
  grounding:
    "Eric Evans, Domain-Driven Design (2003); Vaughn Vernon, Implementing DDD (2013). The context map patterns are Evans's, and they describe power as much as data.",
  levels: [
    { key: "strategic", name: "Strategic", blurb: "Bounded contexts and the map between them. The part that decides team boundaries." },
    { key: "tactical", name: "Tactical", blurb: "Inside one context: aggregates, entities, value objects, events." },
  ],
  nodeTypes: [
    {
      name: "Bounded Context", color: "#7c3aed", level: "strategic",
      description: "A boundary inside which one model, and one meaning for each word, holds.",
      fields: [
        { key: "team", dataType: "text", description: "The one team that owns this model.", required: true },
        { key: "core", dataType: "boolean", description: "Is this the core domain — the reason the organisation is in business?" },
        { key: "language", dataType: "text", description: "The words that mean something specific here, and what they mean." },
      ],
    },
    {
      name: "Aggregate", color: "#8b5cf6", level: "tactical", parent: "Bounded Context",
      description: "A cluster of objects changed together, with one entity as the way in.",
      fields: [
        { key: "root", dataType: "text", description: "The entity that is the only way in.", required: true },
        { key: "invariant", dataType: "text", description: "The rule that must be true after every change. This is why the aggregate exists.", required: true },
      ],
    },
    {
      name: "Entity", color: "#a78bfa", level: "tactical",
      description: "Something with an identity that persists through change: this order, not an equal one.",
      fields: [{ key: "identity", dataType: "text", description: "What makes two of these the same one.", required: true }],
    },
    {
      name: "Value Object", color: "#c4b5fd", level: "tactical",
      description: "Something defined entirely by its values: Money, a date range, an address.",
      fields: [{ key: "attributes", dataType: "text", description: "The values that define it." }],
    },
    {
      name: "Domain Event", color: "#f59e0b", level: "tactical",
      description: "Something that happened in the domain that other parts care about. Past tense, always.",
      fields: [
        { key: "payload", dataType: "text", description: "What travels with it." },
        { key: "published", dataType: "boolean", description: "Does it leave this context, or stay inside it?" },
      ],
    },
    {
      name: "Domain Service", color: "#6366f1", level: "tactical",
      description: "Domain logic that belongs to no single object. Use sparingly — most of it belongs on an aggregate.",
      fields: [{ key: "operation", dataType: "text", description: "" }],
    },
    {
      name: "Repository", color: "#64748b", level: "tactical",
      description: "The way aggregates of one type are found and stored. One per aggregate, no more.",
      fields: [{ key: "aggregate", dataType: "text", description: "" }],
    },
  ],
  relationTypes: [
    { name: "contains", description: "The decomposition: what lives inside what.", rules: [
      { from: "Bounded Context", to: "Aggregate", cardinality: "one-to-many" },
      { from: "Aggregate", to: "Entity", cardinality: "one-to-many" },
      { from: "Aggregate", to: "Value Object", cardinality: "one-to-many" },
    ] },
    { name: "publishes", description: "Emits this event for others to react to.", rules: [
      { from: "Aggregate", to: "Domain Event", cardinality: "one-to-many" },
      { from: "Bounded Context", to: "Domain Event", cardinality: "one-to-many" },
    ] },
    { name: "subscribes to", description: "Reacts to an event raised somewhere else.", rules: [
      { from: "Bounded Context", to: "Domain Event", cardinality: "many-to-many" },
    ] },
    { name: "references", description: "Holds another aggregate's identity — never its object.", rules: [
      { from: "Aggregate", to: "Aggregate", cardinality: "many-to-many" },
    ] },
    { name: "upstream of", description: "Context map: this side sets the terms, and the other lives with them.", rules: [
      { from: "Bounded Context", to: "Bounded Context", cardinality: "many-to-many" },
    ] },
    { name: "conforms to", description: "Context map: this side adopts the other's model wholesale rather than translating.", rules: [
      { from: "Bounded Context", to: "Bounded Context", cardinality: "many-to-many" },
    ] },
    { name: "shields itself from", description: "Context map: an anti-corruption layer translates at the boundary, so the other model does not leak in.", rules: [
      { from: "Bounded Context", to: "Bounded Context", cardinality: "many-to-many" },
    ] },
    { name: "partners with", description: "Context map: two contexts that succeed or fail together, and plan together.", rules: [
      { from: "Bounded Context", to: "Bounded Context", cardinality: "many-to-many" },
    ] },
  ],
};

/**
 * Model-based systems engineering, in the shape a SysML-literate engineer expects.
 *
 * The whole argument for MBSE is traceability: a requirement nothing satisfies and nothing verifies
 * is a wish. So `satisfies` and `verifies` are first-class relation types, and `verification method`
 * is a closed vocabulary of the standard four rather than free text — "we'll check it somehow" is
 * the answer this framework exists to make impossible.
 *
 * It is deliberately *not* required, though, and that took an argument with the catalogue's own
 * tests to settle. Requiring it would be true to the discipline and wrong for the tool: the first
 * import of somebody's requirements register never carries it, so every requirement would arrive
 * non-conformant, and a conformance report that is red on arrival is one people learn to ignore
 * (§5.56). The framework names the four methods; deciding which applies is the work.
 */
export const MBSE: Framework = {
  id: "mbse",
  name: "Model-based systems engineering",
  family: "domain",
  blurb: "Requirements, functions, physical parts and the traces between them — the SysML spine, without the tool.",
  answers: "For every requirement: what does it, what is it built out of, and what proves it works?",
  grounding:
    "OMG SysML v1.6 and the INCOSE Systems Engineering Handbook. The verification methods are the standard four; a requirement with none is not yet a requirement.",
  levels: [
    { key: "requirement", name: "Requirements", blurb: "What the system must do, and why." },
    { key: "functional", name: "Functional", blurb: "What it does, independent of what it is made of." },
    { key: "physical", name: "Physical", blurb: "What it is made of, and how the parts connect." },
    { key: "verification", name: "Verification", blurb: "What proves each requirement is met." },
  ],
  nodeTypes: [
    {
      name: "Requirement", color: "#dc2626", level: "requirement",
      description: "A single testable statement of something the system must do or must be.",
      fields: [
        { key: "identifier", dataType: "text", description: "The number it is known by outside this tool.", required: true },
        { key: "statement", dataType: "text", description: "One sentence, containing exactly one “shall”.", required: true },
        { key: "rationale", dataType: "text", description: "Why it exists. The field that stops a requirement outliving its reason." },
        { key: "verification method", dataType: "enum", description: "How it will be shown to be met.",
          options: ["inspection", "analysis", "demonstration", "test"] },
        { key: "status", dataType: "enum", description: "", options: ["proposed", "agreed", "allocated", "verified", "withdrawn"] },
      ],
    },
    {
      name: "Function", color: "#ea580c", level: "functional",
      description: "Something the system does, stated as a verb, independent of what performs it.",
      fields: [
        { key: "inputs", dataType: "text", description: "" },
        { key: "outputs", dataType: "text", description: "" },
      ],
    },
    {
      name: "Block", color: "#0891b2", level: "physical",
      description: "A part of the system: an assembly, a unit, a piece of software. SysML's structural building block.",
      fields: [
        { key: "supplier", dataType: "text", description: "" },
        { key: "mass", dataType: "number", description: "In kilograms, where it matters." },
        { key: "make or buy", dataType: "enum", description: "", options: ["make", "buy", "reuse"] },
      ],
    },
    {
      name: "Port", color: "#14b8a6", level: "physical",
      description: "A defined point of connection on a block: what crosses the boundary, and in which direction.",
      fields: [
        { key: "kind", dataType: "enum", description: "", options: ["data", "power", "fluid", "mechanical", "signal"] },
        { key: "direction", dataType: "enum", description: "", options: ["in", "out", "bidirectional"] },
      ],
    },
    {
      name: "Constraint", color: "#7c3aed", level: "requirement",
      description: "A rule the design must obey that is not a behaviour: a budget, a standard, a physical law.",
      fields: [{ key: "expression", dataType: "text", description: "Stated so it can be checked." }],
    },
    {
      name: "Test Case", color: "#16a34a", level: "verification",
      description: "A specific procedure that shows one or more requirements are met.",
      fields: [
        { key: "procedure", dataType: "text", description: "" },
        { key: "result", dataType: "enum", description: "", options: ["not run", "passed", "failed", "blocked"] },
        { key: "last run", dataType: "date", description: "" },
      ],
    },
  ],
  relationTypes: [
    { name: "satisfies", description: "This part or function is why the requirement is met.", rules: [
      { from: "Function", to: "Requirement", cardinality: "many-to-many" },
      { from: "Block", to: "Requirement", cardinality: "many-to-many" },
    ] },
    { name: "verifies", description: "This test case is the evidence the requirement is met.", rules: [
      { from: "Test Case", to: "Requirement", cardinality: "many-to-many" },
    ] },
    { name: "allocates to", description: "The function is performed by this part.", rules: [
      { from: "Function", to: "Block", cardinality: "many-to-many" },
    ] },
    { name: "refines", description: "A finer requirement that makes a coarser one testable.", rules: [
      { from: "Requirement", to: "Requirement", cardinality: "many-to-one" },
    ] },
    { name: "derives from", description: "A requirement that exists only because of a design decision taken elsewhere.", rules: [
      { from: "Requirement", to: "Requirement", cardinality: "many-to-many" },
    ] },
    { name: "composed of", description: "Structural decomposition of a part into its parts.", rules: [
      { from: "Block", to: "Block", cardinality: "one-to-many" },
    ] },
    { name: "connects", description: "Two ports joined: something crosses here.", rules: [
      { from: "Port", to: "Port", cardinality: "one-to-one" },
    ] },
    { name: "exposes", description: "The block offers this port.", rules: [
      { from: "Block", to: "Port", cardinality: "one-to-many" },
    ] },
    { name: "constrains", description: "The constraint applies to this part or requirement.", rules: [
      { from: "Constraint", to: "Block", cardinality: "many-to-many" },
      { from: "Constraint", to: "Requirement", cardinality: "many-to-many" },
    ] },
  ],
};
