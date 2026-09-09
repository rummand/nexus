import type { Framework } from "./types";

/** Ways of running and funding the organisation that builds the systems (§5.57). */

/**
 * The IT4IT reference architecture, reduced to its spine.
 *
 * IT4IT's contribution is that it is a *data model* rather than a process manual: it names the
 * objects that flow between the four value streams and insists they are the same objects. So the
 * service chain — Conceptual → Logical → Service Release → Service Offer → Service Contract — is
 * modelled as relation types rather than as a note, because that chain is the whole standard.
 */
export const IT4IT: Framework = {
  id: "it4it",
  name: "IT4IT",
  family: "operating-model",
  blurb: "The four IT value streams and the data objects that flow along them, from strategy to correction.",
  answers: "How does an idea become a running service, and can we follow one object all the way through?",
  grounding:
    "The Open Group IT4IT™ Standard. Its point is the data model, not the processes: the same Service object travels all four value streams under different names.",
  levels: [
    { key: "s2p", name: "Strategy to Portfolio", blurb: "Deciding what the portfolio should contain. Conceptual and logical services, demand." },
    { key: "r2d", name: "Requirement to Deploy", blurb: "Building and releasing it. Requirements, source, builds, releases." },
    { key: "r2f", name: "Request to Fulfil", blurb: "Letting people consume it. Offers, contracts, subscriptions." },
    { key: "d2c", name: "Detect to Correct", blurb: "Keeping it running. Events, incidents, problems, changes." },
  ],
  nodeTypes: [
    {
      name: "Conceptual Service", color: "#0ea5e9", level: "s2p",
      description: "A service as the business asks for it, before anybody has decided how to build it.",
      fields: [
        { key: "owner", dataType: "text", description: "", required: true },
        { key: "demand", dataType: "enum", description: "", options: ["proposed", "approved", "funded", "rejected"] },
      ],
    },
    {
      name: "Logical Service", color: "#0284c7", level: "s2p",
      description: "The same service as IT intends to deliver it: the architecture behind the promise.",
      fields: [
        { key: "architect", dataType: "text", description: "" },
        { key: "lifecycle", dataType: "enum", description: "", options: ["planned", "in development", "live", "retiring", "retired"] },
      ],
    },
    {
      name: "Requirement", color: "#dc2626", level: "r2d",
      description: "Something the service must do, traceable forward to a release and back to a demand.",
      fields: [
        { key: "statement", dataType: "text", description: "", required: true },
        { key: "priority", dataType: "enum", description: "", options: ["must", "should", "could", "won't"] },
      ],
    },
    {
      name: "Service Release", color: "#16a34a", level: "r2d",
      description: "A specific, versioned, deployable state of the service.",
      fields: [
        { key: "version", dataType: "text", description: "", required: true },
        { key: "released", dataType: "date", description: "" },
      ],
    },
    {
      name: "Service Offer", color: "#f59e0b", level: "r2f",
      description: "What a consumer actually sees in the catalogue, with a price and a promise.",
      fields: [
        { key: "price", dataType: "number", description: "" },
        { key: "unit", dataType: "text", description: "What the price is per." },
      ],
    },
    {
      name: "Service Contract", color: "#d97706", level: "r2f",
      description: "The agreed level of service for one consumer of one offer.",
      fields: [
        { key: "availability", dataType: "text", description: "The promised number, e.g. 99.9%." },
        { key: "expires", dataType: "date", description: "" },
      ],
    },
    {
      name: "Configuration Item", color: "#64748b", level: "d2c",
      description: "A thing under control that a change can break and an incident can be about.",
      fields: [
        { key: "environment", dataType: "enum", description: "", options: ["development", "test", "staging", "production"] },
        { key: "criticality", dataType: "enum", description: "", options: ["low", "medium", "high", "critical"] },
      ],
    },
    {
      name: "Incident", color: "#ef4444", level: "d2c",
      description: "A service not doing what it promised, raised by somebody who noticed.",
      fields: [
        { key: "severity", dataType: "enum", description: "", options: ["1", "2", "3", "4"] },
        { key: "opened", dataType: "date", description: "" },
        { key: "resolved", dataType: "boolean", description: "" },
      ],
    },
    {
      name: "Change", color: "#8b5cf6", level: "d2c",
      description: "A deliberate alteration to something under control, with somebody accountable for it.",
      fields: [
        { key: "risk", dataType: "enum", description: "", options: ["low", "medium", "high"] },
        { key: "planned for", dataType: "date", description: "" },
      ],
    },
  ],
  relationTypes: [
    { name: "realised by", description: "The conceptual promise, met by a logical design.", rules: [
      { from: "Conceptual Service", to: "Logical Service", cardinality: "one-to-many" },
    ] },
    { name: "released as", description: "The design, cut into a deployable version.", rules: [
      { from: "Logical Service", to: "Service Release", cardinality: "one-to-many" },
    ] },
    { name: "offered as", description: "The service, put in front of a consumer.", rules: [
      { from: "Logical Service", to: "Service Offer", cardinality: "one-to-many" },
    ] },
    { name: "governed by", description: "The offer, under an agreed level of service.", rules: [
      { from: "Service Offer", to: "Service Contract", cardinality: "one-to-many" },
    ] },
    { name: "traces to", description: "The requirement that this release satisfies. IT4IT's whole point.", rules: [
      { from: "Requirement", to: "Service Release", cardinality: "many-to-many" },
      { from: "Conceptual Service", to: "Requirement", cardinality: "one-to-many" },
    ] },
    { name: "deployed as", description: "The release, running somewhere under control.", rules: [
      { from: "Service Release", to: "Configuration Item", cardinality: "one-to-many" },
    ] },
    { name: "affects", description: "What this incident is about.", rules: [
      { from: "Incident", to: "Configuration Item", cardinality: "many-to-many" },
      { from: "Incident", to: "Service Contract", cardinality: "many-to-many" },
    ] },
    { name: "changes", description: "What this change will alter.", rules: [
      { from: "Change", to: "Configuration Item", cardinality: "many-to-many" },
    ] },
  ],
};

/**
 * SAFe, modelled as what it is to an architect: a funding and flow structure.
 *
 * Not a delivery-process model — Nexus is not a work tracker, and a Story here is a leaf you can
 * trace an epic down to, not something anybody would move across a board. What the architecture
 * team gets from it is the line from a strategic theme to the feature that is actually being built,
 * and the enablers that are the only place architectural work is visible to the funding.
 */
export const SAFE: Framework = {
  id: "safe",
  name: "SAFe",
  family: "operating-model",
  blurb: "Strategic themes down to features, and the trains that deliver them — how the work is funded and flows.",
  answers: "Which strategy is paying for this piece of work, who is delivering it, and where does architecture appear in the plan?",
  grounding:
    "Scaled Agile Framework 6.0 (Scaled Agile, Inc.). Modelled as funding and flow rather than as a delivery process: Nexus is not a work tracker.",
  levels: [
    { key: "portfolio", name: "Portfolio", blurb: "Strategy, funding and the epics that spend it." },
    { key: "solution", name: "Large solution", blurb: "Capabilities and the value streams that carry them." },
    { key: "essential", name: "Essential", blurb: "Features, enablers and the release train that delivers them." },
    { key: "team", name: "Team", blurb: "Stories. Present so an epic can be traced to a leaf, not so anybody manages work here." },
  ],
  nodeTypes: [
    {
      name: "Strategic Theme", color: "#be123c", level: "portfolio",
      description: "A differentiator that connects the portfolio to the enterprise's strategy.",
      fields: [
        { key: "horizon", dataType: "text", description: "" },
        { key: "measure", dataType: "text", description: "How anybody would know it was achieved." },
      ],
    },
    {
      name: "Portfolio Epic", color: "#e11d48", level: "portfolio",
      description: "A substantial initiative, big enough to need a business case and a hypothesis.",
      fields: [
        { key: "hypothesis", dataType: "text", description: "What we believe will be true if we build it.", required: true },
        { key: "state", dataType: "enum", description: "",
          options: ["funnel", "reviewing", "analysing", "portfolio backlog", "implementing", "done"], required: true },
        { key: "wsjf", dataType: "number", description: "Weighted shortest job first. Higher goes sooner." },
        { key: "mvp", dataType: "text", description: "The smallest thing that would test the hypothesis." },
      ],
    },
    {
      name: "Development Value Stream", color: "#0891b2", level: "solution",
      description: "The sequence of steps by which the organisation builds and delivers a solution.",
      fields: [{ key: "funding", dataType: "number", description: "Annual, in the workspace's currency." }],
    },
    {
      name: "Capability", color: "#059669", level: "solution",
      description: "A higher-level behaviour of a solution, spanning more than one train.",
      fields: [{ key: "acceptance", dataType: "text", description: "" }],
    },
    {
      name: "Agile Release Train", color: "#0d9488", level: "essential",
      description: "The long-lived team of teams that delivers continuously. The unit that actually has capacity.",
      fields: [
        { key: "rte", dataType: "text", description: "Release train engineer." },
        { key: "teams", dataType: "number", description: "How many teams are on it." },
      ],
    },
    {
      name: "Feature", color: "#2563eb", level: "essential",
      description: "A service that fulfils a stakeholder need, deliverable inside one increment.",
      fields: [
        { key: "benefit hypothesis", dataType: "text", description: "", required: true },
        { key: "acceptance criteria", dataType: "text", description: "" },
        { key: "wsjf", dataType: "number", description: "" },
      ],
    },
    {
      name: "Enabler", color: "#7c3aed", level: "essential",
      description: "Work that builds the runway rather than the product: architecture, infrastructure, compliance, exploration. Where architecture becomes fundable.",
      fields: [
        { key: "kind", dataType: "enum", description: "", options: ["architectural", "infrastructure", "compliance", "exploration"], required: true },
        { key: "runway", dataType: "text", description: "What it makes possible later." },
      ],
    },
    {
      name: "Story", color: "#94a3b8", level: "team",
      description: "The leaf of the tree. Here so an epic can be traced all the way down, not so work is managed here.",
      fields: [{ key: "points", dataType: "number", description: "" }],
    },
  ],
  relationTypes: [
    { name: "funds", description: "The strategy paying for the initiative.", rules: [
      { from: "Strategic Theme", to: "Portfolio Epic", cardinality: "one-to-many" },
      { from: "Strategic Theme", to: "Development Value Stream", cardinality: "many-to-many" },
    ] },
    { name: "realises", description: "The decomposition of intent into deliverable work.", rules: [
      { from: "Portfolio Epic", to: "Capability", cardinality: "one-to-many" },
      { from: "Capability", to: "Feature", cardinality: "one-to-many" },
      { from: "Feature", to: "Story", cardinality: "one-to-many" },
    ] },
    { name: "delivered by", description: "Who is actually going to build it.", rules: [
      { from: "Feature", to: "Agile Release Train", cardinality: "many-to-many" },
      { from: "Enabler", to: "Agile Release Train", cardinality: "many-to-many" },
    ] },
    { name: "enables", description: "The runway work a feature is waiting on.", rules: [
      { from: "Enabler", to: "Feature", cardinality: "many-to-many" },
      { from: "Enabler", to: "Capability", cardinality: "many-to-many" },
    ] },
    { name: "flows through", description: "Which value stream a train belongs to.", rules: [
      { from: "Development Value Stream", to: "Agile Release Train", cardinality: "one-to-many" },
    ] },
  ],
};
