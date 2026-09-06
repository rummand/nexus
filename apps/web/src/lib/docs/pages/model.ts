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

export const AGENT: DocPage = {
  slug: "agent",
  title: "Asking the agent to read the model",
  summary: "A model reads the whole graph and proposes corrections — each one quoting the words it read, and none of them applied until you say so.",
  keywords: ["agent", "llm", "model", "proposal", "review", "queue", "grounded", "citation", "ai", "classify"],
  blocks: [
    { kind: "prose", text: "Most of what Nexus proposes comes from rules: two objects with one name, a kind spelled two ways, an attribute almost every sibling carries. Rules are fast, free and always give the same answer — and they can only ever find what somebody wrote a rule for. A rule can see that two objects share a name. It cannot see that “PI Server” and “Historian” are the same product, that something described as “our work-order system” is an Application, or that a description saying “pulls meter reads from the head-end” is a relation nobody has drawn." },
    { kind: "prose", text: "**Ask the agent** on the Knowledge graph page hands the whole graph to a model and asks what is wrong with it. What comes back is a *proposal*, in the same review queue as the rules', marked with an **agent** badge." },
    { kind: "shot", src: "graph-proposals", alt: "The agent proposals queue with merges, a kind rename and attribute suggestions", caption: "The review queue. The agent's suggestions arrive here beside the rules', and are accepted or dismissed the same way." },
    { kind: "heading", text: "What it may propose", id: "verbs" },
    {
      kind: "table",
      columns: ["Change", "When"],
      rows: [
        ["Set a kind", "An object has no kind, or the wrong one."],
        ["Rename a kind", "The workspace spells one kind two ways, or uses a word the field does not."],
        ["Merge", "Two objects are the same thing recorded twice."],
        ["Set an attribute", "An attribute is missing and the object's own words answer it."],
        ["Connect", "Two objects are related and nobody has drawn it."],
      ],
    },
    { kind: "prose", text: "That is the entire list. There is no verb for deleting an object, editing a board, changing a grant or reaching anything outside the graph — so the worst a confused or hostile model can produce is a suggestion somebody has to click." },
    { kind: "heading", text: "Every claim quotes the graph", id: "evidence" },
    { kind: "prose", text: "The agent has to name the object it read and copy the words that justify the change, and the words are checked against that object's own text. A claim it cannot quote is thrown away before you see it — and the count of what was thrown away is shown, so you can tell the difference between a quiet agent and a wrong one." },
    { kind: "note", tone: "why", title: "Why the quote, and not just a confidence score", text: "A confidence score is the model's opinion of its own opinion. A quote is checkable: “the model thinks this is an Application” is an assertion, and “the model read *work-order management system* on it” is evidence. This is the same rule intake applies to a transcript." },
    { kind: "heading", text: "How much its opinion is worth", id: "confidence" },
    {
      kind: "list",
      items: [
        "An agent proposal is never **high** confidence, so it is never in **Accept the confident ones**. A model's guess should not be applied fifty at a time by somebody in a hurry.",
        "A proposed merge is always **low**: it is the one action here that cannot be undone.",
        "It will never overwrite an attribute that already has a value. If you answered, that is the answer.",
        "Where the agent and a rule spot the same thing, one card is shown — the one that can say why.",
      ],
    },
    { kind: "heading", text: "What it was reading", id: "grounding" },
    { kind: "prose", text: "The run is grounded in the EA knowledge base: the practice most relevant to the task is retrieved and put in front of the model, and the statements it was given are shown under the queue. This agent's expensive mistake is a vocabulary one — calling a department a capability, a file drop an interface — and the corpus has the field's own definitions." },
    { kind: "heading", text: "Housekeeping", id: "housekeeping" },
    {
      kind: "list",
      items: [
        "The agent runs when you ask it, never on page load. It costs money and a second or two, and an agent that runs unbidden is one people learn to resent.",
        "There is one current run per workspace: asking again replaces the last answer rather than piling up.",
        "Accepting or dismissing removes the card and remembers the decision, so a later run cannot raise it again.",
        "**Clear the agent's run** throws the whole answer away without deciding on any of it.",
      ],
    },
    { kind: "note", tone: "tip", text: "The button appears only when a model is configured (`ANTHROPIC_API_KEY` and `NEXUS_MODEL`). Without one the panel says so and the rules carry on by themselves — nothing here is required for the rest of Nexus to work." },
    { kind: "try", href: "/w/:slug/graph", label: "Open the knowledge graph" },
  ],
};
