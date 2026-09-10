import type { Framework } from "./types";

/**
 * What the organisation is trying to achieve, and the work meant to achieve it (§5.71).
 *
 * The catalogue could describe an estate in six ways and a strategy in none, which left a real
 * hole: every question an architecture team is actually asked — *why are we spending this*,
 * *what happens to the plan if this slips*, *which of these applications is anybody funding a
 * change to* — is a question about the line between an aim and the estate, and Nexus could model
 * both ends and not the line.
 *
 * The **Objective** is the anchor, borrowed from the vocabulary EA tools and OKR practice
 * already share. Two things about the shape here are deliberate:
 *
 * - **A Key Result is its own type, not a field on the objective.** An aim can be measured
 *   several ways, the measures change while the aim does not, and a measure has a target and a
 *   value of its own. Folding it into a text field is how "how would we know" quietly stops
 *   being answered.
 * - **The estate link is the point.** An objective that names no capability and no system is a
 *   sentence in a slide deck. `needs` and `changes` are what make it answerable: which abilities
 *   this aim depends on, and which parts of the estate somebody is funding a change to.
 */

const OBJECTIVE_STATUS = ["proposed", "committed", "at risk", "met", "dropped"];
const INITIATIVE_STATUS = ["proposed", "funded", "in flight", "done", "stopped"];

export const STRATEGY_FRAMEWORKS: Framework[] = [
  {
    id: "objectives",
    name: "Objectives and initiatives",
    family: "strategy",
    layers: [],
    blurb: "What we are trying to achieve, how we would know, and which work and which systems are meant to move it.",
    answers: "What are we trying to achieve, how will we know it happened, and which work and which parts of the estate are supposed to move it?",
    grounding:
      "The objective / key-result split comes from OKR practice: an aim is a sentence, and a measure is a number with a target, and keeping them apart is what stops “how would we know” going unanswered. The half most OKR tooling lacks is the estate link — an objective that names no capability and no system cannot be checked against reality.",
    nodeTypes: [
      {
        name: "Objective", color: "#e11d48",
        description: "Something the organisation is trying to achieve. A stated aim with somebody accountable and a horizon — not a project and not a metric.",
        fields: [
          { key: "owner", dataType: "text", description: "The person accountable for the aim, not for the work under it.", required: true },
          // Not required: an aim is often stated before anybody will commit to a date, and
          // forcing one on day one just produces a fictional date.
          { key: "horizon", dataType: "date", description: "When it is meant to be true by. Empty means nobody has committed to a date." },
          { key: "status", dataType: "enum", description: "Where it stands.", options: OBJECTIVE_STATUS, required: true },
          { key: "why now", dataType: "text", description: "What makes this the aim this year rather than a permanent good intention." },
        ],
      },
      {
        name: "Key Result", color: "#fb7185",
        description: "How you would know the objective happened. A measure with a target, not a task.",
        fields: [
          { key: "target", dataType: "text", description: "The number or state that counts as done.", required: true },
          { key: "current", dataType: "text", description: "Where it stands now." },
          { key: "measured", dataType: "date", description: "When 'current' was last true." },
        ],
      },
      {
        name: "Initiative", color: "#6366f1",
        description: "Funded work intended to move an objective. The thing that has a budget and an end date.",
        fields: [
          { key: "owner", dataType: "text", description: "Who is running it.", required: true },
          { key: "status", dataType: "enum", description: "", options: INITIATIVE_STATUS, required: true },
          { key: "starts", dataType: "date", description: "" },
          { key: "ends", dataType: "date", description: "When it is expected to stop, funded or not." },
          { key: "budget", dataType: "number", description: "Committed spend, in the workspace's currency." },
        ],
      },
      {
        name: "Business Capability", color: "#10b981",
        description: "An ability the organisation has. What an objective usually depends on improving.",
        fields: [{ key: "level", dataType: "number", description: "1 for the top of the map, 2 for its children, and so on." }],
      },
      {
        name: "Application", color: "#f59e0b",
        description: "Software an initiative changes, replaces or retires.",
        fields: [{ key: "owner", dataType: "text", description: "" }],
      },
    ],
    relationTypes: [
      {
        name: "measured by",
        description: "How you would know the objective happened.",
        rules: [{ from: "Objective", to: "Key Result", cardinality: "one-to-many" }],
      },
      {
        name: "contributes to",
        description: "Work meant to move an aim, or an aim that rolls up into a larger one.",
        rules: [
          { from: "Initiative", to: "Objective", cardinality: "many-to-many" },
          // An objective rolls up into one parent; several parents is a tree nobody can read.
          { from: "Objective", to: "Objective", cardinality: "many-to-one" },
        ],
      },
      {
        name: "needs",
        description: "The ability the objective depends on the organisation having.",
        rules: [{ from: "Objective", to: "Business Capability", cardinality: "many-to-many" }],
      },
      {
        name: "changes",
        description: "What the initiative actually touches — the line between the plan and the estate.",
        rules: [
          { from: "Initiative", to: "Application", cardinality: "many-to-many" },
          { from: "Initiative", to: "Business Capability", cardinality: "many-to-many" },
        ],
      },
    ],
  },
];
