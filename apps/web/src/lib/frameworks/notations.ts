import type { Framework } from "./types";

/** Ways of drawing a system so that another engineer reads it the same way (§5.57). */

const LIFECYCLE = ["proposed", "active", "sunset", "retired"];

/**
 * The C4 model — four levels of zoom over the same software.
 *
 * Kept deliberately close to Simon Brown's definitions, because the value of C4 is that everybody
 * means the same thing by "container": a separately deployable, separately runnable thing, not a
 * Docker image and not a box on a slide. `technology` is required on a Container for the same
 * reason — a container diagram whose boxes do not say what they are built with is a system context
 * diagram with more boxes.
 */
export const C4: Framework = {
  id: "c4",
  name: "C4 model",
  family: "notation",
  blurb: "Four levels of zoom over one software system: context, containers, components, code.",
  answers: "What is this system, what is it made of, and who does it talk to — at whichever altitude the person in the room needs?",
  grounding:
    "Simon Brown's C4 model (c4model.com). A container is a separately deployable, separately runnable thing — a process, not a package and not a server.",
  levels: [
    { key: "context", name: "System context", blurb: "The system as one box, the people and systems around it. The diagram you show a non-engineer." },
    { key: "container", name: "Container", blurb: "What the system is made of that runs separately: applications, services, databases, file stores." },
    { key: "component", name: "Component", blurb: "The major structural building blocks inside one container, and how they collaborate." },
    { key: "code", name: "Code", blurb: "Classes and their relationships. Usually generated rather than drawn, and rarely worth keeping." },
  ],
  nodeTypes: [
    {
      name: "Person", color: "#0f3d73", level: "context",
      description: "A human user of the system, described by the role they play rather than their job title.",
      fields: [
        { key: "role", dataType: "text", description: "What this person does with the system.", required: true },
        { key: "internal", dataType: "boolean", description: "Inside the organisation, or a customer or partner?" },
      ],
    },
    {
      name: "Software System", color: "#1a4d8f", level: "context",
      description: "The highest level of abstraction: something that delivers value to somebody. Ours, or somebody else's.",
      fields: [
        { key: "owner", dataType: "text", description: "The team or person accountable for it.", required: true },
        { key: "external", dataType: "boolean", description: "True when it is outside our control, which is what greys the box." },
        { key: "lifecycle", dataType: "enum", description: "Where it is in its life.", options: LIFECYCLE },
      ],
    },
    {
      name: "Container", color: "#2b6cb0", level: "container", parent: "Software System",
      description: "A separately deployable, separately runnable thing: an application, a service, a database, a file store.",
      fields: [
        { key: "technology", dataType: "text", description: "What it is built with. A container without this is a box on a slide.", required: true },
        { key: "responsibility", dataType: "text", description: "One sentence: what it is for." },
        { key: "runtime", dataType: "text", description: "Where it actually runs." },
      ],
    },
    {
      name: "Component", color: "#4a90d9", level: "component", parent: "Container",
      description: "A grouping of related functionality behind a well-defined interface, inside one container.",
      fields: [
        { key: "technology", dataType: "text", description: "Framework or library, where it matters." },
        { key: "responsibility", dataType: "text", description: "One sentence: what it is for." },
      ],
    },
    {
      name: "Code Element", color: "#93b8dd", level: "code", parent: "Component",
      description: "A class, interface or module. Model these only where the detail earns its keep — usually it does not.",
      fields: [{ key: "repository", dataType: "url", description: "Where the source lives." }],
    },
  ],
  relationTypes: [
    {
      name: "uses",
      description: "One thing calls, reads from or otherwise depends on another at runtime.",
      rules: [
        { from: "Person", to: "Software System", cardinality: "many-to-many" },
        { from: "Person", to: "Container", cardinality: "many-to-many" },
        { from: "Software System", to: "Software System", cardinality: "many-to-many" },
        { from: "Container", to: "Container", cardinality: "many-to-many" },
        { from: "Component", to: "Component", cardinality: "many-to-many" },
      ],
    },
    {
      name: "contains",
      description: "The decomposition itself: what a thing at one level is made of at the next.",
      rules: [
        { from: "Software System", to: "Container", cardinality: "one-to-many" },
        { from: "Container", to: "Component", cardinality: "one-to-many" },
        { from: "Component", to: "Code Element", cardinality: "one-to-many" },
      ],
    },
    {
      name: "delivers to",
      description: "Sends data or messages out to a person or a system, rather than being called by one.",
      rules: [
        { from: "Software System", to: "Person", cardinality: "many-to-many" },
        { from: "Container", to: "Person", cardinality: "many-to-many" },
      ],
    },
  ],
};

/**
 * UML class modelling, minus the ninety per cent of UML nobody draws.
 *
 * Five types and six relationships is the part of the class diagram that survives contact with a
 * real project. The distinction the relation types keep is the one people actually get wrong:
 * composition is a lifetime claim (the part dies with the whole), aggregation is not.
 */
export const UML_CLASS: Framework = {
  id: "uml-class",
  name: "UML class model",
  family: "notation",
  blurb: "Classes, interfaces and the six relationships between them — the part of UML that survives a real project.",
  answers: "What are the things in this software, what do they know, and how are they related in code?",
  grounding:
    "OMG UML 2.5.1, class diagram subset. Composition versus aggregation is a claim about lifetime, not about strength of feeling.",
  levels: [],
  nodeTypes: [
    {
      name: "Class", color: "#b45309",
      description: "A kind of object: what it knows (attributes) and what it can do (operations).",
      fields: [
        { key: "stereotype", dataType: "text", description: "«entity», «service», «controller» — the word in guillemets above the name." },
        { key: "abstract", dataType: "boolean", description: "Cannot be instantiated on its own." },
        { key: "attributes", dataType: "text", description: "One per line, as name : Type." },
        { key: "operations", dataType: "text", description: "One per line, as name(args) : Return." },
      ],
    },
    {
      name: "Interface", color: "#0369a1",
      description: "A contract a class may realise: operations with no implementation.",
      fields: [{ key: "operations", dataType: "text", description: "One per line, as name(args) : Return.", required: true }],
    },
    {
      name: "Enumeration", color: "#7c3aed",
      description: "A closed set of named values.",
      fields: [{ key: "literals", dataType: "text", description: "The permitted values, comma separated.", required: true }],
    },
    {
      name: "Data Type", color: "#0891b2",
      description: "A value with no identity of its own: Money, Email, ISO4217.",
      fields: [{ key: "primitive", dataType: "boolean", description: "Built into the language rather than declared here." }],
    },
    {
      name: "Package", color: "#64748b",
      description: "A namespace grouping classes that change together.",
      fields: [{ key: "namespace", dataType: "text", description: "" }],
    },
  ],
  relationTypes: [
    { name: "generalises", description: "Inheritance: the target is a more general form of the source.", rules: [
      { from: "Class", to: "Class", cardinality: "many-to-one" },
      { from: "Interface", to: "Interface", cardinality: "many-to-many" },
    ] },
    { name: "realises", description: "The class implements the interface's contract.", rules: [
      { from: "Class", to: "Interface", cardinality: "many-to-many" },
    ] },
    { name: "associates", description: "A plain structural link: one knows about the other.", rules: [
      { from: "Class", to: "Class", cardinality: "many-to-many" },
      { from: "Class", to: "Enumeration", cardinality: "many-to-many" },
      { from: "Class", to: "Data Type", cardinality: "many-to-many" },
    ] },
    { name: "composes", description: "The part cannot outlive the whole. A filled diamond.", rules: [
      { from: "Class", to: "Class", cardinality: "one-to-many" },
    ] },
    { name: "aggregates", description: "The part can outlive the whole. A hollow diamond.", rules: [
      { from: "Class", to: "Class", cardinality: "one-to-many" },
    ] },
    { name: "depends on", description: "A weaker link: a change here may force a change there.", rules: [
      { from: "Class", to: "Class", cardinality: "many-to-many" },
      { from: "Package", to: "Package", cardinality: "many-to-many" },
    ] },
    { name: "contains", description: "The package holds this type.", rules: [
      { from: "Package", to: "Class", cardinality: "one-to-many" },
      { from: "Package", to: "Interface", cardinality: "one-to-many" },
    ] },
  ],
};
