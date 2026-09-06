import type { Lesson } from "./types";

/**
 * The doctrine, in full.
 *
 * Kept in its own file so `lessons.ts` stays about *how* doctrine is selected and this stays about
 * *what* it says. Every entry quotes the corpus verbatim; `lessons.test.ts` fails otherwise, which
 * is what stops the file filling up with things that merely sound true.
 *
 * Order matters within a scope: `rankLessons` falls back to declared order when a task matches
 * nothing, so the most general rule of each scope comes first.
 */
export const LESSON_DATA: Lesson[] = [
  {
    id: "capability-is-not-the-org-chart",
    statement: "A capability is what the organisation does; the team that does it is not the capability.",
    detail:
      "Naming departments and colouring them in produces an organisation chart, not a capability model — and it goes stale at the next reorganisation. If a proposed capability disappears when the org chart changes, it was a team.",
    applies: ["compose", "intake", "modelling", "metamodel"],
    tags: ["capability", "organisation", "grouping", "business"],
    citation: {
      sourceId: "wp:Business_capability_model",
      quote:
        "Business capability models are very stable and organizationally neutral in nature. They are largely independent of specific organizational structures, reporting relationships, political agendas and cultural aspects of individual business leaders, current initiatives and projects.",
    },
  },
  {
    id: "capability-versus-process",
    statement: "A capability is what the organisation can do; a process is how it currently does it.",
    detail:
      "The two answer different questions and change at different speeds, so mixing them on one board or under one kind makes both unreadable. Bill a customer is a capability; the current monthly billing run is a process.",
    applies: ["compose", "modelling", "metamodel"],
    tags: ["capability", "process", "grouping"],
    citation: {
      sourceId: "wp:Business_capability_model",
      quote:
        "Business capability models represent high-level views of an organization from the perspective of its business capabilities. Essentially, they briefly describe everything that an organization can do.",
    },
  },
  {
    id: "group-applications-by-what-they-support",
    statement: "Group applications by the business function they support, not by the team that owns them.",
    detail:
      "Ownership groupings show you the organisation; capability groupings show you the estate — including two systems doing the same job, which is only visible once both are mapped to the same function.",
    applies: ["compose", "modelling"],
    tags: ["application", "capability", "grouping", "portfolio"],
    citation: {
      sourceId: "wp:Application_portfolio_management",
      quote:
        "Transparency also aids strategic planning efforts and diffuses business / IT conflict, because when business leaders understand how applications support their key business functions, and the impact of outages and poor quality, conversations turn away from blaming IT for excessive costs and toward how to best spend precious resources to support corporate priorities.",
    },
  },
  {
    id: "a-view-is-for-somebody",
    statement: "Every view exists for a stakeholder and answers their concerns; a board with no audience is decoration.",
    detail:
      "Before laying anything out, know who is going to read it and what they need to decide. That is what makes a viewpoint a viewpoint rather than a picture of everything.",
    applies: ["compose", "modelling"],
    tags: ["viewpoint", "stakeholder", "view", "layout"],
    citation: {
      sourceId: "wp:Software_architecture",
      quote:
        "Architecture documentation shows that all stakeholder concerns are addressed by modeling and describing the architecture from separate points of view associated with the various stakeholder concerns.",
    },
  },
  {
    id: "duplication-is-the-finding",
    statement: "Two systems doing the same work is a finding worth surfacing, not a tidiness problem.",
    detail:
      "Every duplicate is separately licensed, patched, integrated and staffed. Where the model shows two applications against one function, say so — that is the number a rationalisation case is made from.",
    applies: ["health", "modelling", "compose"],
    tags: ["duplicates", "application", "portfolio", "cost"],
    citation: {
      sourceId: "wp:Application_portfolio_management",
      quote:
        "Regardless of the duplication, each application is separately maintained and periodically upgraded, and the redundancy increases complexity and cost.",
    },
  },
  {
    id: "structure-follows-communication",
    statement: "Expect the architecture to mirror how the organisation communicates, and say so when it does.",
    detail:
      "When the model's clusters match the org chart exactly, that is a finding about the organisation, not a validation of the model. It is also why a boundary drawn against the communication structure will not hold.",
    applies: ["modelling", "metamodel"],
    tags: ["organisation", "structure", "coupling", "boundary"],
    citation: {
      sourceId: "wp:Conway's_law",
      quote:
        "Therefore, the technical structure of a system will reflect the social boundaries of the organizations that produced it, across which communication is more difficult.",
    },
  },
  {
    id: "one-model-per-context",
    statement: "Do not force one universal model on the whole enterprise; cut it into contexts that each hold together.",
    detail:
      "A single model that must satisfy every department ends up satisfying none, and every term in it means three things. Where two areas use the same word differently, that is a boundary, not an error to normalise away.",
    applies: ["metamodel", "modelling"],
    tags: ["domain", "decomposition", "metamodel", "boundary"],
    citation: {
      sourceId: "wp:Domain-driven_design",
      quote: "DDD is against the idea of having a single unified model; instead it divides a large system into bounded contexts, each of which have their own model.",
    },
  },
  {
    id: "a-model-conforms-to-its-metamodel",
    statement: "An untyped object is outside the model: the meta-model is what makes the rest of it mean anything.",
    detail:
      "A node with no kind cannot be counted, filtered, laid out or reasoned about — it is a drawing. Give it a kind from the vocabulary the workspace already uses, or declare a new one deliberately.",
    applies: ["metamodel", "health", "modelling"],
    tags: ["untyped", "metamodel", "type", "vocabulary"],
    citation: {
      sourceId: "wp:Metamodeling",
      quote: "A model conforms to its metamodel in the way that a computer program conforms to the grammar of the programming language in which it is written.",
    },
  },
  {
    id: "terms-before-diagrams",
    statement: "Agree what the words mean before drawing with them; a shared vocabulary is the model's foundation.",
    detail:
      "Interface, service, platform and capability each mean several things in one building. Reuse the terms the workspace already has rather than minting a synonym, and where a new one is genuinely needed, define it.",
    applies: ["metamodel", "intake", "modelling"],
    tags: ["vocabulary", "untyped", "metamodel", "semantics"],
    citation: {
      sourceId: "wp:Ontology_(information_science)",
      quote:
        "More simply, an ontology is a way of showing the properties of a subject area and how they are related, by defining a set of terms and relational expressions that represent the entities in that subject area.",
    },
  },
  {
    id: "ownership-is-authority-not-attendance",
    statement: "An owner is whoever holds the authority to decide about a thing — not whoever was in the room.",
    detail:
      "Record ownership only where somebody is accountable for decisions about the system. Attendance at a meeting, or being the person who raised a question about it, is evidence at best.",
    applies: ["health", "intake", "modelling"],
    tags: ["ownership", "owner", "governance", "accountability"],
    citation: {
      sourceId: "wp:Data_governance",
      quote: "Data governance involves delegating authority over data and exercising that authority through decision-making processes.",
    },
  },
  {
    id: "one-thing-one-node",
    statement: "One real thing gets one node; the same system under two names is a defect in the model, not two systems.",
    detail:
      "Consistent identity is what makes every count downstream true. Where two nodes are the same thing, merge them and keep the evidence — a portfolio built on two spellings of one name reports twice the estate it has.",
    applies: ["health", "modelling", "intake"],
    tags: ["duplicates", "identity", "data", "merge"],
    citation: {
      sourceId: "wp:Master_data_management",
      quote:
        "Master data management (MDM) is a discipline in which business and information technology collaborate to ensure the uniformity, accuracy, stewardship, semantic consistency, and accountability of the enterprise's official shared master data assets.",
    },
  },
  {
    id: "everything-should-trace-to-a-source",
    statement: "Every object should be able to say where it came from; an unsourced model is an opinion.",
    detail:
      "Provenance is what lets somebody disagree with a specific claim rather than with the whole picture, and what makes the model repairable when the source changes. Prefer ingesting the document that says a thing over drawing it.",
    applies: ["health", "intake", "modelling"],
    tags: ["provenance", "source", "evidence", "lineage"],
    citation: {
      sourceId: "wp:Data_lineage",
      quote:
        "Data lineage refers to the process of tracking how data is generated, transformed, transmitted and used across systems over time. It documents data's origins, transformations and movements, providing detailed visibility into its life cycle.",
    },
  },
  {
    id: "an-application-has-an-end",
    statement: "Record where a system is in its life, because everything is eventually replaced.",
    detail:
      "Lifecycle is the attribute that turns an inventory into a plan: it is what says which systems can carry new work and which are being carried. A system with no lifecycle is implicitly assumed to be fine forever.",
    applies: ["health", "modelling", "intake"],
    tags: ["lifecycle", "application", "roadmap"],
    citation: {
      sourceId: "wp:Application_lifecycle_management",
      quote: "ALM continues after development until the application is no longer used, and may span many SDLCs.",
    },
  },
  {
    id: "nothing-in-an-estate-is-really-isolated",
    statement: "A system recorded with no relations is unmapped, not independent.",
    detail:
      "Real systems are fed by something and feed something else. A node with no edges tells you the integration was never modelled, which is exactly the part an impact assessment needs.",
    applies: ["health", "modelling", "compose"],
    tags: ["orphans", "relations", "coupling", "integration"],
    citation: {
      sourceId: "wp:Coupling_(computer_programming)",
      quote:
        "In software engineering, coupling is the degree of interdependence between software modules, a measure of how closely connected two routines or modules are, and the strength of the relationships between modules.",
    },
  },
  {
    id: "a-decision-carries-its-reasons",
    statement: "Capture a decision with the reasoning behind it, not just the outcome.",
    detail:
      "The valuable half of a decision is why the alternatives were rejected: that is what tells somebody two years later whether the decision still holds. A decision recorded without its rationale cannot be revisited, only overturned.",
    applies: ["intake", "modelling"],
    tags: ["decision", "rationale", "record"],
    citation: {
      sourceId: "wp:Architectural_decision",
      quote:
        "An architectural decision captures the result of a conscious, often collaborative option selection process and provides design rationale for the decision making outcome",
    },
  },
  {
    id: "what-counts-as-an-application",
    statement: "An application is something deployed that does a job for the business — not a project, a team or a vendor.",
    detail:
      "Projects finish, teams reorganise, vendors supply several systems. Recording any of them as an application produces an inventory that cannot be counted or rationalised. Record the deployed thing, and attach the rest to it.",
    applies: ["intake", "metamodel", "modelling"],
    tags: ["application", "vocabulary", "inventory", "project"],
    citation: {
      sourceId: "wp:Application_portfolio_management",
      quote:
        "Application software — An executable software component or tightly coupled set of executable software components (one or more), deployed together, that deliver some or all of a series of steps needed to create, update, manage, calculate or display information for a specific business purpose.",
    },
  },
  {
    id: "legacy-is-a-judgement-not-a-date",
    statement: "“Legacy” is a claim about support and fit, not about age; record what was actually said.",
    detail:
      "An old system that is supported, understood and doing its job is not legacy. Treat the word as a viewpoint someone expressed — with the sentence they said it in — rather than as a lifecycle value you can infer from a date.",
    applies: ["intake", "modelling", "health"],
    tags: ["legacy", "lifecycle", "risk", "evidence"],
    citation: {
      sourceId: "wp:Legacy_system",
      quote: "Often referencing a system as \"legacy\" means that it paved the way for the standards that would follow it.",
    },
  },
];
