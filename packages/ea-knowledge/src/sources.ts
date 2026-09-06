/**
 * The source registry: what the corpus is made of, and why each thing is in it.
 *
 * Two rules govern this file.
 *
 * 1. **Licence first.** Every entry names a licence that permits redistribution, because the
 *    corpus is committed to this repository and served from a product. The canon of enterprise
 *    architecture is mostly *not* open — TOGAF, ArchiMate, the BIZBOK, Ross/Weill, Bass/Clements —
 *    so those appear in `REFERENCES` as things to read, never as text we ship. Pretending
 *    otherwise would be the kind of quiet copyright problem that surfaces at the worst moment.
 * 2. **A reason to be here.** Each source says what it is good for. A corpus assembled by
 *    scraping whatever is free retrieves badly: the index has no way to tell an article that
 *    defines a term from one that mentions it.
 */

import type { Source } from "./types";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/** A Wikipedia article. Text is CC BY-SA 4.0, credited to the article's contributors. */
function wiki(title: string, topics: string[], why: string): Source {
  const slug = title.replace(/ /g, "_");
  return {
    id: `wp:${slug}`,
    title,
    kind: "mediawiki",
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
    fetchUrl: WIKI_API,
    license: "CC-BY-SA-4.0",
    attribution: "Wikipedia contributors",
    topics,
    why,
  };
}

/** A plain-text or Markdown document fetched over HTTP. */
function text(id: string, title: string, url: string, fetchUrl: string, license: Source["license"], attribution: string, topics: string[], why: string): Source {
  return { id, title, kind: "text", url, fetchUrl, license, attribution, topics, why };
}

/** The discipline itself: what enterprise architecture is and how it is practised. */
const DISCIPLINE: Source[] = [
  wiki("Enterprise architecture", ["discipline", "definition"], "The base definition every other source is read against."),
  wiki("Enterprise architecture framework", ["framework", "method"], "What a framework is for, and how the well-known ones differ."),
  wiki("Enterprise architecture planning", ["method", "roadmap"], "The planning tradition: data before applications before technology."),
  wiki("Business architecture", ["capability", "business"], "The business layer: capabilities, value streams, organisation."),
  wiki("Solution architecture", ["solution", "delivery"], "Where enterprise intent meets a single delivery."),
  wiki("Systems architecture", ["systems", "structure"], "Structure, components and their relations, in the general case."),
  wiki("Software architecture", ["software", "structure"], "Decisions that are expensive to change — the practical definition."),
  wiki("Reference architecture", ["pattern", "standardisation"], "How a reference model is meant to be used, and misused."),
  wiki("Business–IT alignment", ["alignment", "value"], "The question enterprise architecture exists to answer."),
  wiki("Digital transformation", ["change", "strategy"], "The change programme most architecture work is attached to."),
];

/** The frameworks and standards a practitioner is expected to know. */
const FRAMEWORKS: Source[] = [
  wiki("TOGAF", ["framework", "ADM"], "The most widely used framework; its phases shape most engagements."),
  wiki("ArchiMate", ["notation", "metamodel"], "The modelling language whose layers our meta-model is measured against."),
  wiki("Zachman Framework", ["framework", "taxonomy"], "The taxonomy that started the field: perspectives × interrogatives."),
  wiki("Federal Enterprise Architecture", ["framework", "government"], "The public-sector reference models, and a cautionary tale about volume."),
  wiki("Department of Defense Architecture Framework", ["framework", "viewpoint"], "Viewpoints as the organising idea, taken furthest."),
  wiki("NATO Architecture Framework", ["framework", "viewpoint"], "A viewpoint-led framework maintained outside the vendor world."),
  wiki("ISO/IEC 42010", ["standard", "viewpoint"], "The standard that defines architecture description, view and viewpoint."),
  wiki("Model-driven architecture", ["model", "abstraction"], "Where model-first thinking came from, and what it over-promised."),
  wiki("Metamodeling", ["metamodel", "abstraction"], "The type level: what a meta-model is and what it constrains."),
  wiki("Enterprise modelling", ["model", "method"], "Modelling the enterprise as an object in its own right."),
];

/** Capability, process and value — the business-side vocabulary. */
const BUSINESS: Source[] = [
  wiki("Business capability model", ["capability", "business"], "The one artefact executives actually read; also the most abused."),
  wiki("Capability management", ["capability", "planning"], "Capabilities as a planning unit rather than a diagram."),
  wiki("Business process modeling", ["process", "notation"], "Process as distinct from capability — the distinction most models lose."),
  wiki("Business Process Model and Notation", ["process", "notation"], "The notation processes are actually drawn in."),
  wiki("Value stream mapping", ["value", "process"], "Value streams: the horizontal cut through capabilities."),
  wiki("Business Model Canvas", ["strategy", "business"], "A one-page business model, and where architecture attaches to it."),
  wiki("Balanced scorecard", ["strategy", "measurement"], "How strategy is measured, which is what a roadmap must connect to."),
  wiki("Operating model", ["operating model", "organisation"], "Standardisation and integration as the two axes of an operating model."),
  wiki("Wardley map", ["strategy", "evolution"], "Evolution of components — why not everything deserves a bespoke build."),
  wiki("Stakeholder analysis", ["stakeholder", "governance"], "Who a view is for, which is what makes it a viewpoint."),
];

/** Applications, integration and the estate. */
const APPLICATIONS: Source[] = [
  wiki("Application portfolio management", ["portfolio", "application"], "Rationalising an estate: the direct use case for this product."),
  wiki("IT portfolio management", ["portfolio", "investment"], "Portfolio thinking applied to investment rather than assets."),
  wiki("Application lifecycle management", ["lifecycle", "application"], "Lifecycle as an attribute with consequences, not a label."),
  wiki("Legacy system", ["legacy", "risk"], "What makes a system legacy, beyond its age."),
  wiki("Technical debt", ["debt", "risk"], "The metaphor architects argue with finance in."),
  wiki("Total cost of ownership", ["cost", "portfolio"], "The number a rationalisation case is made in."),
  wiki("Commercial off-the-shelf", ["buy", "sourcing"], "Buy-versus-build, and what a package does to your process."),
  wiki("Enterprise resource planning", ["ERP", "application"], "The system most estates are organised around."),
  wiki("Enterprise asset management", ["asset", "application"], "Asset-heavy industries' core system — the utility case."),
  wiki("Configuration management database", ["CMDB", "inventory"], "The other inventory in the building, and why it disagrees with yours."),
];

/** Integration: how the estate is wired together. */
const INTEGRATION: Source[] = [
  wiki("Enterprise Integration Patterns", ["integration", "pattern"], "The pattern language integration conversations are held in."),
  wiki("Enterprise service bus", ["integration", "middleware"], "The centralising answer, and what it costs."),
  wiki("Service-oriented architecture", ["service", "integration"], "Services as the unit of reuse; the generation before microservices."),
  wiki("Microservices", ["service", "decomposition"], "Decomposition by business capability, and its operational bill."),
  wiki("Event-driven architecture", ["event", "integration"], "Events as the coupling-reducing alternative to request/response."),
  wiki("Publish–subscribe pattern", ["event", "pattern"], "The mechanic under most event architectures."),
  wiki("API management", ["API", "governance"], "Interfaces as managed products rather than incidental endpoints."),
  wiki("Representational state transfer", ["API", "style"], "The dominant interface style, stated properly."),
  wiki("Interoperability", ["integration", "standard"], "What integration is for, at the level a regulator cares about."),
  wiki("System integration", ["integration", "delivery"], "Integration as a delivery activity with its own failure modes."),
];

/** Data and knowledge. */
const DATA: Source[] = [
  wiki("Data architecture", ["data", "structure"], "The data layer as a first-class architecture concern."),
  wiki("Data governance", ["data", "ownership"], "Ownership and stewardship — where the owner attribute comes from."),
  wiki("Master data management", ["data", "identity"], "One identity for a thing across systems: the merge problem, industrialised."),
  wiki("Data mesh", ["data", "ownership"], "Domain ownership of data products; the current counter-argument to the lake."),
  wiki("Data warehouse", ["data", "analytics"], "The classical analytical store and its architecture."),
  wiki("Data lineage", ["data", "provenance"], "Provenance for data — the same argument this product makes for models."),
  wiki("Entity–relationship model", ["model", "data"], "Entities and relationships, the shape a knowledge graph inherits."),
  wiki("Knowledge graph", ["graph", "semantics"], "The representation Nexus stores the estate in."),
  wiki("Ontology (information science)", ["semantics", "metamodel"], "Ontology versus taxonomy — the distinction the meta-model rests on."),
  wiki("Resource Description Framework", ["semantics", "graph"], "Triples: the minimal graph statement, and its vocabulary discipline."),
  wiki("Semantic Web", ["semantics", "standard"], "Where the shared-vocabulary idea comes from."),
  wiki("Unified Modeling Language", ["notation", "model"], "The notation most technical modelling still borrows from."),
];

/** Structure, decomposition and the decisions that survive. */
const DESIGN: Source[] = [
  wiki("Domain-driven design", ["domain", "decomposition"], "Bounded contexts: the best available answer to where to cut."),
  wiki("Separation of concerns", ["principle", "structure"], "The principle every layering argument reduces to."),
  wiki("Coupling (computer programming)", ["coupling", "structure"], "Coupling, stated precisely enough to measure."),
  wiki("Cohesion (computer science)", ["cohesion", "structure"], "The other half of the pair; a good model maximises it."),
  wiki("Conway's law", ["organisation", "structure"], "Why the architecture keeps matching the org chart."),
  wiki("Architectural decision", ["decision", "record"], "Decisions as artefacts — the ADR practice."),
  wiki("Design pattern", ["pattern", "reuse"], "Patterns as named, reusable solutions with stated trade-offs."),
  wiki("Strangler fig pattern", ["migration", "pattern"], "How a legacy system is actually replaced."),
  wiki("Anti-pattern", ["pattern", "risk"], "Named failure modes; useful when reviewing a model."),
  wiki("Non-functional requirement", ["quality", "requirement"], "The qualities architecture is judged on."),
];

/** Running it: operations, quality, reliability. */
const OPERATIONS: Source[] = [
  wiki("IT service management", ["service", "operations"], "The operational counterpart to the architecture view."),
  wiki("ITIL", ["service", "process"], "The process vocabulary most operations teams already use."),
  wiki("COBIT", ["governance", "control"], "Governance and control objectives, the audit-facing view."),
  wiki("IT governance", ["governance", "decision"], "Who decides what — the part of architecture that is not drawing."),
  wiki("Capability Maturity Model Integration", ["maturity", "assessment"], "Maturity models, used well and badly."),
  wiki("Site reliability engineering", ["reliability", "operations"], "Reliability as an engineering discipline with budgets."),
  wiki("Observability (software)", ["observability", "operations"], "Whether you can tell what the estate is doing."),
  wiki("High availability", ["availability", "quality"], "Availability, stated in numbers a business can sign."),
  wiki("Scalability", ["scalability", "quality"], "Scaling as a property of the design, not the hardware."),
  wiki("IT disaster recovery", ["continuity", "risk"], "RTO and RPO: the attributes a criticality rating implies."),
];

/** Security, risk and compliance. */
const SECURITY: Source[] = [
  wiki("Enterprise information security architecture", ["security", "architecture"], "Security as an architecture layer rather than a bolt-on."),
  wiki("Zero trust security model", ["security", "principle"], "The current default posture for a distributed estate."),
  wiki("Identity management", ["identity", "security"], "Identity as shared infrastructure across the estate."),
  wiki("Defense in depth (computing)", ["security", "principle"], "Layered control: why one boundary is never the answer."),
  wiki("Threat model", ["security", "method"], "Modelling what can go wrong, in the same breath as what should."),
  wiki("Regulatory compliance", ["compliance", "risk"], "The obligation side of an architecture decision."),
  wiki("General Data Protection Regulation", ["privacy", "compliance"], "The regulation that made data ownership a modelling attribute."),
  wiki("NIS 2 Directive", ["compliance", "critical infrastructure"], "The European obligation utilities are currently rebuilding for."),
  wiki("Critical infrastructure protection", ["risk", "utility"], "Why an energy estate is not an ordinary IT estate."),
  wiki("Business continuity planning", ["continuity", "risk"], "Continuity as the reason criticality is recorded at all."),
];

/** Platforms and infrastructure. */
const PLATFORM: Source[] = [
  wiki("Cloud computing", ["cloud", "platform"], "The delivery model most target architectures assume."),
  wiki("Platform as a service", ["cloud", "platform"], "Where the responsibility boundary sits in each model."),
  wiki("Infrastructure as code", ["automation", "platform"], "Infrastructure as a described, versioned thing."),
  wiki("DevOps", ["delivery", "organisation"], "The operating model most delivery organisations now claim."),
  wiki("Continuous delivery", ["delivery", "practice"], "Delivery cadence as an architectural constraint."),
  wiki("Containerization (computing)", ["platform", "packaging"], "The packaging unit under most current platforms."),
  wiki("Kubernetes", ["platform", "orchestration"], "The orchestration substrate worth naming as an IT component."),
  wiki("Edge computing", ["platform", "distribution"], "Compute at the edge — unavoidable in a grid estate."),
  wiki("Digital twin", ["model", "operations"], "A live model of a physical asset; the operational cousin of this product."),
  wiki("Internet of things", ["device", "data"], "Where the measurement data in a utility estate comes from."),
];

/** The energy-utility context this product is being built in. */
const UTILITY: Source[] = [
  wiki("Smart grid", ["energy", "utility"], "The domain the seed workspace models."),
  wiki("SCADA", ["operations", "energy"], "The control system every utility architecture has to account for."),
  wiki("IEC 61850", ["standard", "energy"], "Substation communication: a standard that constrains the estate."),
  wiki("Common Information Model (electricity)", ["standard", "data"], "CIM: the shared data model for electrical networks."),
  wiki("Distributed generation", ["energy", "change"], "The change driving most current utility architecture work."),
  wiki("Demand response", ["energy", "process"], "A business capability that only exists because of the data estate."),
  wiki("Transmission system operator", ["energy", "organisation"], "The organisation type the product owner works for."),
  wiki("Distribution system operator", ["energy", "organisation"], "The counterpart at distribution level."),
  wiki("Outage management system", ["energy", "application"], "An application class at the centre of grid operations, and a good worked example of one."),
  wiki("Advanced metering infrastructure", ["energy", "data"], "Metering as the largest data source in a utility estate."),
];

/** Sources outside the encyclopedia. */
const PRIMARY: Source[] = [
  text(
    "12factor:toc",
    "The Twelve-Factor App",
    "https://12factor.net/",
    "https://raw.githubusercontent.com/heroku/12factor/master/content/en/toc.md",
    "MIT",
    "Adam Wiggins and contributors",
    ["platform", "principle", "delivery"],
    "A short, opinionated standard for how a deployable application should behave; MIT-licensed, so it can be shipped rather than linked.",
  ),
];

/** Every source in the corpus. */
export const SOURCES: Source[] = [
  ...DISCIPLINE,
  ...FRAMEWORKS,
  ...BUSINESS,
  ...APPLICATIONS,
  ...INTEGRATION,
  ...DATA,
  ...DESIGN,
  ...OPERATIONS,
  ...SECURITY,
  ...PLATFORM,
  ...UTILITY,
  ...PRIMARY,
];

/**
 * Works that belong in an EA reading list but cannot be ingested.
 *
 * Keeping this visible is the honest thing to do: a knowledge base that never mentions TOGAF's
 * own text or the standard textbooks looks either ignorant or evasive. It is neither — those are
 * simply not ours to redistribute, and the corpus says so out loud.
 */
export const REFERENCES: Array<{ title: string; author: string; url: string; reason: string }> = [
  { title: "TOGAF Standard, 10th Edition", author: "The Open Group", url: "https://www.opengroup.org/togaf", reason: "Free to read after registration; redistribution is not permitted." },
  { title: "ArchiMate 3.2 Specification", author: "The Open Group", url: "https://pubs.opengroup.org/architecture/archimate3-doc/", reason: "Readable online; the text is licensed to The Open Group and cannot be shipped." },
  { title: "Enterprise Architecture as Strategy", author: "Ross, Weill & Robertson", url: "https://www.hbs.edu/faculty/Pages/item.aspx?num=25736", reason: "Copyrighted book. The operating-model idea is covered by open sources instead." },
  { title: "Software Architecture in Practice", author: "Bass, Clements & Kazman", url: "https://www.pearson.com/", reason: "Copyrighted book; quality-attribute scenarios are its lasting contribution." },
  { title: "A Guide to the Business Architecture Body of Knowledge (BIZBOK)", author: "Business Architecture Guild", url: "https://www.businessarchitectureguild.org/", reason: "Members-only publication." },
  { title: "Building Evolutionary Architectures", author: "Ford, Parsons & Kua", url: "https://evolutionaryarchitecture.com/", reason: "Copyrighted book; fitness functions are the idea worth borrowing." },
  { title: "bliki: articles on architecture", author: "Martin Fowler", url: "https://martinfowler.com/architecture/", reason: "Freely readable, all rights reserved — cite and link, never copy." },
  { title: "The C4 model for visualising software architecture", author: "Simon Brown", url: "https://c4model.com/", reason: "Freely readable; licence does not clearly permit redistribution." },
];
