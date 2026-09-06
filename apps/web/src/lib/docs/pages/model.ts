import type { DocPage } from "../types";

export const GRAPH: DocPage = {
  slug: "graph",
  title: "The knowledge graph",
  summary: "Every object in the workspace, what the agent proposes about it, and how to work on many at once.",
  keywords: ["entities", "relations", "inventory", "table", "bulk", "import", "csv", "merge", "proposals"],
  blocks: [
    { kind: "prose", text: "The Knowledge graph page is the model without the drawings: everything in the workspace, what state it is in, and what wants fixing." },
    { kind: "shot", src: "graph", alt: "The knowledge graph page with the health score, kinds and object list", caption: "The graph page. The score at the top is the estate's health; the list below is everything in it." },
    { kind: "heading", text: "Two views", id: "views" },
    {
      kind: "list",
      items: [
        "**Cards** — objects grouped by kind, the quickest way to browse.",
        "**Table** — every object as a row, with its attributes as columns. Select several and set a kind or an attribute on all of them at once.",
      ],
    },
    { kind: "shot", src: "graph-entities", alt: "The entity table with attribute columns and a multi-select", caption: "The table view. Bulk editing here is how a hundred objects get an owner without a hundred clicks." },
    { kind: "heading", text: "Proposals", id: "proposals" },
    { kind: "prose", text: "Below the list, the agent's proposals: duplicates to merge, kinds that are two spellings of one thing, objects with no type, relations with no label, attribute values that should be normalised, and — where intake has read a document — owners and lifecycles it can justify from a sentence somebody actually said." },
    { kind: "shot", src: "graph-proposals", alt: "Agent proposals with confidence levels, evidence and accept or dismiss buttons", caption: "Every proposal carries its evidence and a confidence. Nothing is applied until you accept it." },
    {
      kind: "steps",
      steps: [
        { do: "Read the detail line. It names both objects and where each is used." },
        { do: "Accept, or dismiss. A dismissal is remembered, so the same suggestion does not come back tomorrow." },
        { do: "Use “Accept the confident ones” for the bulk of them.", note: "It only takes proposals that need no judgement — never the ones with a field for you to fill in — and it tells you how many objects it will touch first." },
      ],
    },
    { kind: "heading", text: "Importing", id: "import" },
    { kind: "prose", text: "Import data takes CSV or JSON. Paste it, and the preview shows what it would create, what it would update and what it cannot read, before anything is written. An import records itself as the source of everything it creates, which is what makes provenance work afterwards." },
    { kind: "try", href: "/w/:slug/graph", label: "Open the knowledge graph" },
  ],
};

export const EXPLORER: DocPage = {
  slug: "explorer",
  title: "The graph explorer",
  summary: "The whole model as a graph you can walk, when a board is the wrong shape for the question.",
  keywords: ["explorer", "navigate", "force layout", "neighbourhood", "path"],
  blocks: [
    { kind: "prose", text: "Boards are curated. Sometimes you want the opposite: everything, laid out automatically, so you can follow a thread from one system to another without deciding in advance what the picture is." },
    { kind: "shot", src: "explorer", alt: "The graph explorer with a force-directed layout of the workspace", caption: "The explorer lays the whole workspace out by force, then lets you filter and focus." },
    {
      kind: "list",
      items: [
        "Click a node to focus it; its neighbourhood stays lit and the rest recedes.",
        "Filter by kind or relation type to strip the picture back to one layer.",
        "Adjust the hop depth to widen or narrow what counts as “near”.",
        "Found the view you wanted? Lay it out on a board to keep it.",
      ],
    },
    { kind: "note", tone: "why", title: "Why it is separate from boards", text: "A force layout is good at showing you structure you did not know about, and bad at being a diagram you present. Keeping them apart means the explorer can rearrange itself freely without ever moving something on a board somebody made deliberately." },
    { kind: "try", href: "/w/:slug/explore", label: "Open the explorer" },
  ],
};

export const META_MODEL: DocPage = {
  slug: "meta-model",
  title: "The meta-model",
  summary: "The types in your model: what grew from the data, what you have declared, and the rules between them.",
  keywords: ["types", "schema", "node type", "relation type", "fields", "rules", "declare", "diagram", "archimate"],
  blocks: [
    { kind: "prose", text: "Most tools make you adopt a meta-model before you can draw anything. Nexus works the other way round: you draw, types accumulate from what you actually called things, and the Meta-model page shows you what you have ended up with — then lets you make it deliberate." },
    { kind: "shot", src: "meta", alt: "The meta-model builder with node types, relation types and the detail of one type", caption: "Types on the left, the selected type on the right. The dot says whether a type was declared or simply appeared." },
    { kind: "heading", text: "Declared, from data, unused", id: "presence" },
    {
      kind: "table",
      columns: ["State", "Meaning"],
      rows: [
        ["Declared", "You have defined this type, and objects use it."],
        ["From data", "It appeared because somebody typed it on a card. Perfectly valid — declare it when you want to describe it or constrain it."],
        ["Unused", "Declared, but nothing uses it yet. Either the work has not happened or the type was a mistake."],
      ],
    },
    { kind: "heading", text: "What you can do with a type", id: "editing" },
    {
      kind: "list",
      items: [
        "Rename it — every object of that kind follows.",
        "Describe it, so the next person knows what belongs in it.",
        "Give it a parent type, and fields you expect its objects to carry.",
        "For a relation type, add rules: which node types it may join, and in which direction.",
        "See what the literature calls it — the EA knowledge base supplies a definition where the corpus has one, which is a cheap check on whether your “Capability” is really a department.",
      ],
    },
    { kind: "heading", text: "The diagram", id: "diagram" },
    { kind: "prose", text: "The Diagram tab draws the meta-model itself: types as boxes, relation types as labelled edges between them, laid out automatically. It is generated from the model every time, so unlike the diagram in the architecture handbook it cannot be out of date." },
    { kind: "shot", src: "meta-diagram", alt: "The meta-model diagram: node types as boxes joined by labelled relation-type edges", caption: "The type-level view. Edges are coloured by whether they were declared, observed in the data, or observed in violation of a rule." },
    { kind: "try", href: "/w/:slug/meta", label: "Open the meta-model" },
  ],
};

export const HEALTH: DocPage = {
  slug: "health",
  title: "Estate health",
  summary: "One number, the six measures behind it, and what actually moves them.",
  keywords: ["health", "score", "quality", "provenance", "duplicates", "orphans", "ownership", "lifecycle", "coverage"],
  blocks: [
    { kind: "prose", text: "A model is only worth as much as it is trusted, and trust comes from knowing what is wrong with it. The health score is a weighted average of six measures, each of which says what good looks like, how far off this workspace is *in a sentence about this workspace*, and what would move it." },
    { kind: "shot", src: "graph-health", alt: "The estate health panel expanded, showing six measures with scores and actions", caption: "Six measures. Each one is one click from the work that would improve it." },
    {
      kind: "table",
      columns: ["Measure", "What good looks like"],
      rows: [
        ["Provenance", "Every system can point at where it came from — a source, not somebody's memory."],
        ["Duplicates", "One thing, one object."],
        ["Typing", "Everything has a kind the meta-model knows."],
        ["Connectedness", "Nothing sits alone in the graph; an isolated system usually means the integrations were never mapped."],
        ["Ownership", "Every system has somebody accountable for decisions about it."],
        ["Lifecycle", "Every system says where it is in its life, so a roadmap can be built from the model."],
      ],
    },
    { kind: "heading", text: "Fixing rather than scolding", id: "fixing" },
    { kind: "prose", text: "Each measure shows how much of its gap the agent can already close from evidence in the graph — an owner justified by the person who raised an action about a system, a lifecycle justified by somebody saying it is out of support. Those appear as proposals with the sentence attached." },
    { kind: "note", tone: "why", title: "Why the score is weighted by population", text: "A measure over three objects cannot swing the headline. Otherwise a workspace with two untyped objects out of four would look catastrophic, and people would learn to ignore the number — which is the only real failure mode a metric has." },
    { kind: "note", tone: "tip", text: "Intake's own records — meetings, decisions, risks, the people who raised them — are excluded from the estate measures. A decision has no owner and no lifecycle, and counting it as a fault would be a way of manufacturing a bad score." },
    { kind: "try", href: "/w/:slug/graph", label: "See your score" },
  ],
};
