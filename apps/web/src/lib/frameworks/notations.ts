import type { Framework } from "./types";

/** Ways of drawing a system so that another engineer reads it the same way (§5.57). */

const LIFECYCLE = ["proposed", "active", "sunset", "retired"];

/**
 * The C4 model — four layers of zoom over the same software.
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
  blurb: "Four layers of zoom over one software system: context, containers, components, code.",
  answers: "What is this system, what is it made of, and who does it talk to — at whichever altitude the person in the room needs?",
  grounding:
    "Simon Brown's C4 model (c4model.com). A container is a separately deployable, separately runnable thing — a process, not a package and not a server.",
  layers: [
    { key: "context", name: "System context", blurb: "The system as one box, the people and systems around it. The diagram you show a non-engineer." },
    { key: "container", name: "Container", blurb: "What the system is made of that runs separately: applications, services, databases, file stores." },
    { key: "component", name: "Component", blurb: "The major structural building blocks inside one container, and how they collaborate." },
    { key: "code", name: "Code", blurb: "Classes and their relationships. Usually generated rather than drawn, and rarely worth keeping." },
  ],
  nodeTypes: [
    {
      name: "Person", color: "#0f3d73", layer: "context",
      description: "A human user of the system, described by the role they play rather than their job title.",
      fields: [
        { key: "role", dataType: "text", description: "What this person does with the system.", required: true },
        { key: "internal", dataType: "boolean", description: "Inside the organisation, or a customer or partner?" },
      ],
    },
    {
      name: "Software System", color: "#1a4d8f", layer: "context",
      description: "The highest level of abstraction: something that delivers value to somebody. Ours, or somebody else's.",
      fields: [
        { key: "owner", dataType: "text", description: "The team or person accountable for it.", required: true },
        { key: "external", dataType: "boolean", description: "True when it is outside our control, which is what greys the box." },
        { key: "lifecycle", dataType: "enum", description: "Where it is in its life.", options: LIFECYCLE },
      ],
    },
    {
      name: "Container", color: "#2b6cb0", layer: "container", parent: "Software System",
      description: "A separately deployable, separately runnable thing: an application, a service, a database, a file store.",
      fields: [
        { key: "technology", dataType: "text", description: "What it is built with. A container without this is a box on a slide.", required: true },
        { key: "responsibility", dataType: "text", description: "One sentence: what it is for." },
        { key: "runtime", dataType: "text", description: "Where it actually runs." },
      ],
    },
    {
      name: "Component", color: "#4a90d9", layer: "component", parent: "Container",
      description: "A grouping of related functionality behind a well-defined interface, inside one container.",
      fields: [
        { key: "technology", dataType: "text", description: "Framework or library, where it matters." },
        { key: "responsibility", dataType: "text", description: "One sentence: what it is for." },
      ],
    },
    {
      name: "Code Element", color: "#93b8dd", layer: "code", parent: "Component",
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
  layers: [],
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

/**
 * ArchiMate, core.
 *
 * The layered EA language, and the reason §5.58 exists: its whole grammar is that elements live in
 * bands and dependencies run downward. Ten elements out of roughly sixty, which needs saying —
 * this is not ArchiMate, it is the tenth of ArchiMate that carries most real models, and the
 * catalogue's own rule is that a starter is the smallest thing that is still useful rather than the
 * largest that is still defensible. Add the rest by hand where the estate earns them.
 */
export const ARCHIMATE: Framework = {
  id: "archimate",
  name: "ArchiMate (core)",
  family: "notation",
  blurb: "The layered EA language: motivation over business over application over technology.",
  answers: "Which business processes does this application serve, what does it run on, and which goal is any of it for?",
  grounding:
    "The Open Group ArchiMate® 3.2 Specification. Ten of its ~60 elements — the layering and the serving/realisation relationships are the part that carries most models.",
  layers: [
    { key: "motivation", name: "Motivation", blurb: "Why: the goals and requirements the rest of it is for." },
    { key: "business", name: "Business", blurb: "Who and what: actors, the processes they run, the services they offer." },
    { key: "application", name: "Application", blurb: "The software serving the business, and the data it keeps." },
    { key: "technology", name: "Technology", blurb: "What the software runs on." },
  ],
  nodeTypes: [
    { name: "Goal", color: "#a855f7", layer: "motivation",
      description: "An end state a stakeholder intends to achieve. A noun phrase, not a project.",
      fields: [{ key: "stakeholder", dataType: "text", description: "Whose goal it is.", required: true },
               { key: "measure", dataType: "text", description: "How anybody would know it was met." }] },
    { name: "Requirement", color: "#c084fc", layer: "motivation",
      description: "Something that must be realised for a goal to be met.",
      fields: [{ key: "statement", dataType: "text", description: "", required: true }] },

    { name: "Business Actor", color: "#f59e0b", layer: "business",
      description: "A person, team or organisation that performs behaviour. A role, not a name.",
      fields: [{ key: "kind", dataType: "enum", description: "", options: ["person", "team", "department", "organisation"] }] },
    { name: "Business Process", color: "#fbbf24", layer: "business",
      description: "A sequence of behaviour producing a defined outcome for the business.",
      fields: [{ key: "owner", dataType: "text", description: "" },
               { key: "frequency", dataType: "enum", description: "", options: ["continuous", "daily", "weekly", "monthly", "on demand"] }] },
    { name: "Business Service", color: "#fcd34d", layer: "business",
      description: "Behaviour offered to the outside world, described by what it gives rather than how.",
      fields: [{ key: "consumer", dataType: "text", description: "" }] },

    { name: "Application Component", color: "#3b82f6", layer: "application",
      description: "A modular, deployable, replaceable piece of software. What most people call an application.",
      fields: [{ key: "owner", dataType: "text", description: "", required: true },
               { key: "lifecycle", dataType: "enum", description: "", options: LIFECYCLE }] },
    { name: "Application Service", color: "#60a5fa", layer: "application",
      description: "Application behaviour exposed to the business, named for what it does for them.",
      fields: [{ key: "availability", dataType: "text", description: "" }] },
    { name: "Data Object", color: "#93c5fd", layer: "application",
      description: "Data structured for automated processing, that the business would recognise by name.",
      fields: [{ key: "classification", dataType: "enum", description: "", options: ["public", "internal", "confidential", "personal"] }] },

    { name: "Node", color: "#10b981", layer: "technology",
      description: "A computational or physical resource that hosts, manipulates or interacts with other resources.",
      fields: [{ key: "environment", dataType: "enum", description: "", options: ["development", "test", "staging", "production"] },
               { key: "location", dataType: "text", description: "" }] },
    { name: "Technology Service", color: "#34d399", layer: "technology",
      description: "Technology behaviour exposed upward: storage, compute, messaging, identity.",
      fields: [{ key: "provider", dataType: "text", description: "" }] },
  ],
  relationTypes: [
    { name: "serves", description: "Provides functionality to an element in the layer above. ArchiMate's workhorse.", rules: [
      { from: "Application Component", to: "Business Process", cardinality: "many-to-many" },
      { from: "Application Service", to: "Business Process", cardinality: "many-to-many" },
      { from: "Application Service", to: "Business Service", cardinality: "many-to-many" },
      { from: "Technology Service", to: "Application Component", cardinality: "many-to-many" },
      { from: "Node", to: "Application Component", cardinality: "many-to-many" },
    ] },
    { name: "realises", description: "A more concrete element makes a more abstract one real.", rules: [
      { from: "Application Component", to: "Application Service", cardinality: "many-to-many" },
      { from: "Business Process", to: "Business Service", cardinality: "many-to-many" },
      { from: "Business Process", to: "Requirement", cardinality: "many-to-many" },
      { from: "Application Component", to: "Requirement", cardinality: "many-to-many" },
    ] },
    { name: "assigned to", description: "An active element is allocated to perform behaviour.", rules: [
      { from: "Business Actor", to: "Business Process", cardinality: "many-to-many" },
      { from: "Node", to: "Technology Service", cardinality: "many-to-many" },
    ] },
    { name: "accesses", description: "Behaviour reads or writes a data object.", rules: [
      { from: "Application Component", to: "Data Object", cardinality: "many-to-many" },
      { from: "Application Service", to: "Data Object", cardinality: "many-to-many" },
    ] },
    { name: "triggers", description: "One piece of behaviour causes the next.", rules: [
      { from: "Business Process", to: "Business Process", cardinality: "many-to-many" },
    ] },
    { name: "influences", description: "A motivation element affects another, for better or worse.", rules: [
      { from: "Requirement", to: "Goal", cardinality: "many-to-many" },
      { from: "Goal", to: "Goal", cardinality: "many-to-many" },
    ] },
  ],
};
