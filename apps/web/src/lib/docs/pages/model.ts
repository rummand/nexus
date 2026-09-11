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
  summary: "Three ways to walk the model, when a board is the wrong shape for the question.",
  keywords: ["explorer", "navigate", "focus", "hops", "neighbourhood", "path", "route", "blast radius", "impact", "upstream", "downstream", "isolated", "orphan", "map"],
  blocks: [
    { kind: "prose", text: "Boards are curated. The explorer is the opposite: the whole workspace graph, with three views over it, because “show me everything at once” answers no question anybody actually asks." },
    { kind: "shot", src: "explorer", alt: "The graph explorer showing one entity and its neighbourhood in concentric hop rings", caption: "Focus: one entity in the middle, its neighbourhood in rings. Radius is hop count, so distance means something." },
    { kind: "heading", text: "Three views", id: "views" },
    {
      kind: "table",
      columns: ["View", "The question it answers"],
      rows: [
        ["Focus", "What does this touch? One entity in the middle, everything within one, two or three hops in concentric rings. Arrows show which way each relation points."],
        ["Map", "What is the shape of the whole thing? Every connected entity at once, laid out by force. Entities connected to nothing are not here — they are a finding, and the rail lists them."],
        ["Paths", "How are these two connected? Pick two entities and every equally short route between them appears, not just one."],
      ],
    },
    { kind: "heading", text: "Blast radius", id: "impact" },
    { kind: "prose", text: "Relations point somewhere, and direction is the question. “What is downstream of this” — what goes with it if it is removed — and “what is upstream” — what would have to change for this to change — are opposite answers. The panel asks for one or the other, never both at once." },
    {
      kind: "list",
      items: [
        "Search the rail, or click anything in the picture, to stand on it.",
        "Every step you take is recorded as a walk; click a step to go back and branch from there.",
        "Filter by kind or by relationship type to strip the picture back to one layer.",
        "Found the view you wanted? Lay it out on a board to keep it.",
      ],
    },
    { kind: "note", tone: "why", title: "Why it opens on one entity, not on everything", text: "Overview-first is the wrong default for a graph. You always arrive with something in mind, and a force-directed cloud of the whole estate is the picture that is hardest to read and least likely to be what you wanted. So the explorer starts on the most connected entity — the least arbitrary opening move — and every other view is one click away." },
    { kind: "note", tone: "why", title: "Why unconnected entities are in a list, not on the canvas", text: "A force layout spreads things with no relationships evenly across the view, where they take up most of the picture and read as structure. They are the absence of structure, and usually the sign of something imported and never modelled — which is worth saying in words." },
    { kind: "try", href: "/w/:slug/explore", label: "Open the explorer" },
  ],
};

export const INVENTORY: DocPage = {
  slug: "inventory",
  title: "The inventory: browsing one type",
  summary: "Every type with data is a destination — filter it, search it, and edit values as the things the model says they are.",
  keywords: ["inventory", "fact sheet", "factsheet", "browse", "list", "filter", "facet", "search", "attributes", "edit", "bulk", "leanix", "applications"],
  blocks: [
    { kind: "prose", text: "A kind used to be a filter chip on a page of everything. It is a place now: **/w/…/type/Application** is the application inventory, with its own address, so it can be linked, bookmarked and sent to somebody." },
    { kind: "shot", src: "inventory", alt: "The application inventory with a facet rail on the left and a table of applications", caption: "Facets on the left, built from the type's own fields. Every value carries its count — including the things that have none." },
    { kind: "heading", text: "The facets", id: "facets" },
    {
      kind: "list",
      items: [
        "**Fields the meta-model declares come first**, in the order it declares them — that order is somebody's considered opinion about what matters. Keys that only exist in the data follow, commonest first.",
        "**“not set” is a value.** *Which applications have no owner* is the most useful question an inventory answers, and a rail that only lists the values present hides it.",
        "**A declared field with nothing in it still appears.** An empty facet is a finding: the model asked for something and nobody filled it in.",
        "Values inside one facet are ORed; separate facets are ANDed.",
      ],
    },
    { kind: "note", tone: "why", title: "Why choosing a value does not empty the rest of its facet", text: "Each facet counts against every *other* facet's selection, never its own. If it counted against itself, picking “active” would show every other lifecycle as zero and the filter would be a one-way door — you could narrow but never switch. It is a small rule and it is the difference between a rail you can explore with and one you have to keep resetting." },
    { kind: "heading", text: "Editing", id: "editing" },
    { kind: "prose", text: "Cells edit in place, as the thing the meta-model says they are: a declared enum is a dropdown of its options, a boolean is yes/no, a number takes numbers, a web address gets a link beside it. A key the model does not declare stays free text, because the model has no opinion about it." },
    { kind: "note", tone: "why", title: "Why the type matters here", text: "Editing a declared enum as free text is exactly how “Active” and “active” both end up in the column — and then Nexus needs a whole proposals system to normalise a mess it allowed in the first place. A model that declares a type and then ignores it when the value is typed is decoration. Set an enum's allowed values on the field, in the meta-model." },
    { kind: "note", tone: "tip", text: "A value already in the data that the model does not allow is shown, never blanked — the mismatch is a finding, and silently discarding it would destroy it. Clearing a field is always allowed, including a required one: requiredness is a statement about a finished record, not about a keystroke." },
    { kind: "try", href: "/w/:slug/graph", label: "Pick a type to browse" },
  ],
};

export const FACT_SHEET: DocPage = {
  slug: "fact-sheet",
  title: "The fact sheet: one object, one page",
  summary: "Every object has an address, opens in a window over whatever you were doing, and is edited by typing in it.",
  keywords: ["fact sheet", "factsheet", "object", "page", "edit", "inline", "save", "autosave", "undo", "sections", "attributes", "history", "window", "leanix", "link"],
  blocks: [
    { kind: "prose", text: "An object is a thing, not an annotation on a list. **/w/…/fs/…** is its address — the name, the description, every attribute in the section its type puts it in, what it is connected to, where it sits, which boards it is on, and everything that has ever happened to it. It is a link you can send." },
    { kind: "shot", src: "fact-sheet", alt: "An application's fact sheet open in a window over the repository, with its attributes in sections and its history beside them", caption: "Opened from a list, the sheet is a window over it: everything right of the menu, nothing of the menu." },
    { kind: "heading", text: "Why it is a window and not a page", id: "window" },
    { kind: "prose", text: "Click a row and the sheet opens **over** the list you were reading, filling the area right of the navigation. The list underneath keeps its search, its facets and its scroll position, so checking one application's owner does not cost you the three filters it took to find it. The address in the bar still changes — the object is linkable and refreshable — and there are three ways out, all cheap: the **close** button, **Escape**, and the browser's back button, which are the same gesture here." },
    { kind: "note", tone: "tip", text: "Open the link cold — from a mail, a bookmark, a new tab — and there is nothing behind it to cover, so it renders as a whole page instead. Same sheet, same edits. **Open on its own** in the window's bar does that deliberately." },
    { kind: "heading", text: "There is no save button", id: "editing" },
    { kind: "prose", text: "The value on the page *is* the field. Click it, change it, look away — it is written. The canvas has worked this way since the beginning and nobody has ever asked where its save button is." },
    {
      kind: "list",
      items: [
        "**It writes when you look away, not as you type.** One edit is one entry in the history, not eleven.",
        "**It says so quietly.** The word *saved* appears beside the field for a moment; a field that flashes on every keystroke teaches you to watch the chrome instead of the content.",
        "**It can be taken back.** *undo* sits next to *saved* and puts the previous value straight back.",
        "**Escape belongs to the field.** Pressed while typing it reverts what you typed; pressed outside a field it closes the window.",
      ],
    },
    { kind: "note", tone: "why", title: "Why an unprompted autosave is defensible here", text: "Because nothing is anonymous. Every edit lands in the object's history with the editor's name and the time on it, and the graph's history page shows it beside everything else that changed. A save button protects you from a system that forgets who did what; this one remembers." },
    { kind: "heading", text: "Sections, and what the type does not know", id: "sections" },
    { kind: "prose", text: "A declared field names the section it belongs to — Lifecycle, Ownership, Fit for purpose — and you set that on the type in the **meta-model**. The page renders sections in the order the modeller declared them, not alphabetically: somebody decided Ownership comes before Cost." },
    {
      kind: "list",
      items: [
        "**A declared field appears even when it is empty.** An unanswered required field is a finding; hiding it makes the page look complete when it is not.",
        "**Keys nobody declared go in one group.** It is called *From the data*, and on an imported estate it holds most of them — a section rather than an error.",
        "**Nothing is filed by guesswork.** A regex would put `lxCostCentre` under Lifecycle often enough that no heading on the page could be trusted.",
        "The header counts what is filled against what is declared, and says when a required field is blank.",
      ],
    },
    { kind: "try", href: "/w/:slug/repository", label: "Open an object" },
  ],
};

export const HIERARCHY: DocPage = {
  slug: "hierarchy",
  title: "Containment: what sits inside what",
  summary: "Capability trees, C4 levels and organisation charts need one relationship that is not a relation.",
  keywords: ["hierarchy", "containment", "parent", "child", "tree", "capability map", "level", "nested", "roll up", "rollup", "breakdown", "decompose", "import", "leanix"],
  blocks: [
    { kind: "prose", text: "Most things in Nexus are connected by relations, which go anywhere and mean whatever the relationship type says. Containment is the exception: a thing sits **inside** exactly one other thing, and that single constraint is what makes a capability map, a C4 breakdown or an organisation chart possible." },
    { kind: "heading", text: "Why it is not just a relation called “contains”", id: "why" },
    {
      kind: "list",
      items: [
        "**Counts roll up through it.** A capability's weight is its own plus everything beneath it, at any depth. No ordinary relation implies that, because no ordinary relation means *part of*.",
        "**One parent, so it is a tree.** A tree can be walked, indented, collapsed and summed. A relation kind called “contains” is a graph edge with none of those guarantees: nothing stops two parents, and nothing stops a ring.",
      ],
    },
    { kind: "heading", text: "Doing it", id: "doing" },
    {
      kind: "steps",
      steps: [
        { do: "Open an object. **Where it sits** shows the chain above it, what is directly inside it, and how much is beneath in total." },
        { do: "Use **Move inside…** to put it somewhere else, or lift it to the top level.", note: "The list shows each candidate's full path, because three things called “Asset Register” is ordinary in a real estate and a list of identical names cannot be chosen from." },
        { do: "Click anything in the chain or the children list to walk there." },
      ],
    },
    { kind: "heading", text: "Where a hierarchy comes from", id: "importing" },
    { kind: "prose", text: "Most trees are not drawn by hand — they arrive. A column in a file can mean **parent**: the row names what it sits inside, and the import writes that as containment rather than as a connection. A LeanIX workspace brings its own hierarchy across the same way, for every type that nests." },
    {
      kind: "list",
      items: [
        "A parent naming something the import has never heard of is **a question, not a blocker**. The object still arrives, at the top level, which is what an unknown parent means.",
        "A move that would close a ring is refused, including one two rows in the same file would close between them.",
        "Rolling the import back puts each object back where it was, unless somebody has moved it since.",
      ],
    },
    { kind: "prose", text: "In a list of one type, the **Inside** column shows what contains each one — or “top level” — with the number beneath it. That is how 200 capabilities read as the tree they are rather than as 200 rows." },
    { kind: "note", tone: "why", title: "What happens when you delete a parent", text: "The children are lifted to the grandparent, not deleted with it. Removing a capability should remove the level, not the estate underneath it — and losing everything below would be the kind of data loss nobody notices until a week later. There is deliberately no database cascade on the column for the same reason." },
    { kind: "note", tone: "tip", text: "A move that would put something inside itself, or inside something it already contains, is not offered at all — a ring has no top and nothing can walk it. The rule is enforced on the server too, so an agent or an import cannot make one either." },
    { kind: "try", href: "/w/:slug/graph", label: "Open the knowledge graph" },
  ],
};

export const META_MODEL: DocPage = {
  slug: "meta-model",
  title: "The meta-model",
  summary: "The types in your model: what grew from the data, what you have declared, how they stack, whether the data obeys it, and where to start.",
  keywords: ["types", "schema", "node type", "relation type", "fields", "rules", "declare", "diagram", "archimate", "conformance", "compliance", "standard", "starter model", "best practice", "framework", "c4", "uml", "ddd", "domain-driven", "sysml", "mbse", "it4it", "safe", "archimate", "notation", "layer", "layers", "stack", "business layer", "application layer", "technology layer"],
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

    { kind: "heading", text: "Conformance: does the data obey the model?", id: "conformance" },
    { kind: "prose", text: "Declaring a type is a claim about the estate — that an application has an owner, that a lifecycle is one of four words, that “depends on” joins two applications and nothing else. The Conformance tab checks the estate against every one of those claims and shows you where they are not true." },
    { kind: "shot", src: "meta-conformance", alt: "The conformance tab: two headline percentages, a plain-English verdict, and expandable groups of named breaches", caption: "Two numbers, a sentence, and then the actual objects. Every breach names one thing and links to it." },
    {
      kind: "table",
      columns: ["Number", "What it means"],
      rows: [
        ["Of what could be checked", "Of the objects and connections whose type you declared, the share that break none of your rules."],
        ["Of a declared type at all", "The share of the whole estate the model describes. A perfect first number over a tiny second one means you are grading the exam you wrote."],
      ],
    },
    { kind: "prose", text: "The breaches are grouped by what kind of problem they are — an undeclared kind, a missing required field, a value outside its vocabulary, a value that is not the type it was declared as, an undeclared relation type, a connection no rule allows. Open a group and you get the objects themselves, each with a sentence: *“Maximo” has no owner, and Application requires one.*" },
    { kind: "note", tone: "why", title: "Why nothing is blocked", text: "The model grows out of the work here. A canvas that refused a card because a field was empty would stop the drawing that produces the model in the first place — so conformance reports and leaves the decision to a person. When the data and the model disagree, either can be the one that is wrong." },
    { kind: "note", tone: "tip", text: "Conformance is not estate health. Health asks whether your estate is in good shape by general EA standards — provenance, duplicates, orphans. Conformance asks the narrower question: does it obey the rules *you* wrote. An estate can be in poor health and perfectly conformant, or immaculate and conform to nothing." },

    { kind: "heading", text: "Layers: the stack", id: "layers" },
    { kind: "prose", text: "A layer groups object types and relation types into an ordered stack — business over application over technology being the one everybody arrives already having an opinion about. The claim a stack makes is that dependencies run **downward**, which is what makes it worth having and what lets the data be checked against it." },
    { kind: "shot", src: "meta-layers", alt: "The Layers tab: the current stack, the layering read out of the estate with the counts behind each band, and the connections that run up the stack", caption: "The stack you have, the stack the data suggests, and where the two disagree — on one page." },
    {
      kind: "table",
      columns: ["Where a layer came from", "What it means"],
      rows: [
        ["By hand", "Somebody typed it. Yours entirely."],
        ["A framework", "Adopting C4, ArchiMate, IT4IT or SAFe brings that framework's own bands and puts its types in them."],
        ["From the data", "The agent read it out of the estate — see below."],
      ],
    },
    { kind: "heading", text: "Reading the stack out of the estate", id: "inferred-layers" },
    { kind: "prose", text: "Most tools make you configure a layering before you have any data. Nexus can work the other way round, which is the whole premise: **your data already describes your meta-model**. If nineteen connections run Application → Server and none run back, Server is underneath — that is not a guess about names, it is what the graph says." },
    {
      kind: "list",
      items: [
        "Every band says what put it there: *“3 of the 5 connections between this band and the one above run downward.”*",
        "A near-tie is reported rather than presented as a finding — a stack resting on 6 against 5 is something you should know about.",
        "Connections dropped to break a loop are named, because a stack drawn out of a cyclic graph has had a decision taken for it.",
        "A kind nothing connects is left out. The data cannot say where it belongs, so nothing pretends otherwise.",
        "Familiar names — Business, Application, Technology — are used **only when the data agrees with the conventional order**. If your estate stacks differently, every band is named after its own largest type instead.",
      ],
    },
    { kind: "note", tone: "why", title: "Why the word list can never decide a grouping", text: "A layer name comes from a small vocabulary so the bands arrive with something readable on them. What is *in* a band is decided by the graph and nothing else. Naming a band “Technology” because it holds Server and Database is a convenience; putting Server and Database in the same band is a finding." },
    { kind: "prose", text: "Accepting the reading is additive, like everything else that writes a model: a band you already have is reused, and a type you placed yourself stays where you put it. A kind that has never been declared is declared as part of it — a kind that is not a type cannot be in a layer." },
    { kind: "heading", text: "Where the data disagrees with your stack", id: "upward" },
    { kind: "prose", text: "Once a stack exists, every connection that runs *up* it is listed with its count. Either the connection is wrong or one of the two types is in the wrong band; as everywhere else, nothing is blocked and the decision is yours." },
    { kind: "note", tone: "tip", text: "The Diagram tab draws the bands once your model is layered: types sit at the height of their layer, so an edge pointing upward looks like an edge pointing upward. Types not in any layer sit below the stack in a dashed band rather than being quietly placed at the bottom." },

    { kind: "heading", text: "Modelling frameworks", id: "frameworks" },
    { kind: "prose", text: "A model that grows only from what was imported first ends up with somebody else's spreadsheet column headings as its vocabulary. But the deeper thing an architect chooses is not a set of types — it is a **way of describing systems**, and those have names people already argue about. The Frameworks tab lets you adopt one, or several, or none." },
    { kind: "shot", src: "meta-frameworks", alt: "The Frameworks tab: notations, domain methods and operating models, with one expanded to show its levels, types and what adopting it would add", caption: "Nine frameworks in four families. Each says what question it answers, where the practice comes from, and exactly what adopting it would add here." },
    {
      kind: "table",
      columns: ["Family", "What is in it"],
      rows: [
        ["Notations", "**C4** — four levels of zoom over one software system. **UML class** — classes, interfaces and the six relationships, minus the ninety per cent of UML nobody draws."],
        ["Domain and engineering methods", "**Domain-driven design** — bounded contexts, aggregates and the context map. **Model-based systems engineering** — requirements, functions, blocks and the traces that prove each one is met."],
        ["Operating models", "**IT4IT** — the four IT value streams and the data objects that flow along them. **SAFe** — strategic themes down to features, and the trains that deliver them."],
        ["Portfolio models", "**Application portfolio**, **business capability model**, **integration and data flow** — the estate itself, in the three shapes an EA team reaches for first."],
      ],
    },
    { kind: "heading", text: "Adopting one", id: "adopting" },
    {
      kind: "list",
      items: [
        "Adopting **only ever adds**. Nothing is renamed, nothing is deleted, and no object is touched.",
        "Anything you have already declared is left exactly as it is — so a framework is safe on a workspace that has been running for a year.",
        "The summary is worked out against *your* model, not an empty one, so it tells you what would change here. Adopt the same one twice and the second time does nothing.",
        "You can adopt more than one: the software in C4, the domain in DDD, the funding in SAFe. Where two frameworks want the same type, it is declared once.",
        "Every type a framework brought carries a small tag saying which one — provenance, not ownership. You can rename it, describe it and add fields like any other type.",
      ],
    },
    { kind: "note", tone: "why", title: "Why stopping does not delete anything", text: "Choosing to stop modelling with a framework removes the statement and nothing else. By the time somebody changes their mind, the types it brought may hold hundreds of objects — and a modelling decision reversed must not take the estate with it. The types stay, still tagged with where they came from, to be deleted one at a time by somebody who has looked at what is in them." },
    { kind: "note", tone: "tip", text: "Free form is a real answer. A workspace that adopts nothing and lets the model grow out of the drawing is using Nexus exactly as designed — the frameworks are there for the teams who already think in one." },
    { kind: "note", tone: "tip", text: "Adopting a framework usually makes the conformance numbers worse, and that is the point: before, nothing was declared, so nothing could be wrong. The breaches were already there — you just had no rules to see them against." },

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

export const FLEET: DocPage = {
  slug: "agent-fleet",
  title: "The agents you have",
  summary: "Every agent in the workspace, what each is watching, and whether anybody is listening to it.",
  keywords: ["fleet", "agents", "acceptance", "kept", "dismissed", "governance", "control", "audit", "manage"],
  blocks: [
    { kind: "prose", text: "Agents in Nexus are scattered on purpose: one beside a frame, one on a board, one asked from a selection, one reading the graph. Scattering is only humane if there is one place that answers how many there are, what each is watching, and whether anybody is listening to them. That is the **Agents** page." },
    { kind: "shot", src: "agent-fleet", alt: "The Agents page listing an agent with what it watches, remarks waiting, kept and dismissed counts, and a percentage", caption: "One row per agent, with the number that matters on the right." },
    { kind: "heading", text: "The number it leads with", id: "acceptance" },
    { kind: "prose", text: "Not runs. Not tokens. Not remarks made. **Kept** — how often a person turned what an agent said into a note of their own. It is the only measure that says whether the thing is helping somebody think, which is the whole reason to have it." },
    {
      kind: "table",
      columns: ["What it says", "What to do"],
      rows: [
        ["Nobody has answered it yet", "Wake it, and answer what it says. The number is meaningless until you do."],
        ["Too early to say", "Fewer than four answers. Keep going."],
        ["People keep most of what it says", "It is earning its place. Consider one like it elsewhere."],
        ["Mixed", "Rewrite what you asked it for. The purpose is usually the problem, not the model."],
        ["Almost everything it says is waved away", "Change its purpose or delete it. An agent nobody keeps is not quiet and cheap — it is noise with a running cost."],
      ],
    },
    { kind: "note", tone: "why", title: "Why measure the human, not the machine", text: "Every other metric an agent could report — how many things it looked at, how fast, how confidently — is a measure of the agent talking. Whether a person kept what it said is the only one that measures it being useful, and it is the one that gets worse when an agent starts padding." },
    { kind: "heading", text: "Deleted agents", id: "gone" },
    { kind: "prose", text: "Removing an agent from a board does not erase how it did. Its record stays at the bottom of the page, under the name it had — which is worth reading before somebody writes the same agent again." },
    { kind: "note", tone: "tip", text: "Described agents are listed above the board ones, because they are the ones that can be governed: an owner, a scope, verbs and a budget. Their suggestions go to the review queue on the Knowledge graph page, under the name of the agent that made them." },
    { kind: "heading", text: "Agents that suggest agents", id: "suggested" },
    { kind: "prose", text: "**Ask what is missing** puts the question to an agent: it reads the model and the fleet, and suggests an agent nobody has written — with the reason it saw. What comes back is a *proposal*, in the same sense as everything else here. It is stored as **proposed**, which cannot run at all, not even a dry run, until you approve it. Approving makes it an ordinary draft, so its first opinions are still read before it is given a voice." },
    { kind: "note", tone: "why", title: "It cannot hand on what it does not have", text: "No agent may create an agent that can do something it cannot do itself, or spend more than it has. An agent that may only fill in attributes cannot propose one that merges objects — the suggestion is refused, in the open, with that sentence. Without that rule, “agents building agents” is privilege escalation with a friendly name, and every other safeguard here is decoration." },
    {
      kind: "steps",
      steps: [
        { do: "Press Ask what is missing — on the Agents page, or on one agent's own page.", note: "On the Agents page the workspace's reviewer asks. On an agent's page, that agent asks, and its own verbs and budget are the ceiling." },
        { do: "Read the reason. A suggestion that does not name what it read in your model is refused before you see it." },
        { do: "Approve, or say no.", note: "Approving makes it a draft. Saying no deletes it; nothing was created in the meantime." },
      ],
    },
    { kind: "try", href: "/w/:slug/agents", label: "See your agents" },
  ],
};

export const DESCRIBED: DocPage = {
  slug: "describing-an-agent",
  title: "Writing an agent down",
  summary: "Give an agent a purpose, an owner, a scope, verbs and a budget — then read what it would say before letting it say it.",
  keywords: ["agent", "define", "describe", "scope", "verbs", "budget", "owner", "draft", "dry run", "governance", "run log", "audit", "pause", "retire"],
  blocks: [
    { kind: "prose", text: "A board agent (see the previous page) is described by **where it sits**. This is the other kind: an agent described in **words** — what it is for, who is answerable for it, what it may read, what it may propose and what it may spend. Everything on the form is the answer to a question somebody will one day ask about your fleet." },
    { kind: "shot", src: "agent-described", alt: "The form for describing an agent: name, purpose, owner, grounding, a scope query with a count, the five verbs as checkboxes, model and budget", caption: "One screen, and every field on it is a limit." },

    { kind: "heading", text: "The fields", id: "fields" },
    {
      kind: "table",
      columns: ["Field", "What it decides"],
      rows: [
        ["What it is for", "The instruction it gets. Two agents are two agents because of this sentence, so write it as you would a brief for a person."],
        ["Owner", "A team, always. An agent nobody owns is nobody's to switch off."],
        ["What it may read", "A graph query. Only the objects it matches go into the prompt — an agent for the OT estate cannot comment on finance systems because it was never shown them."],
        ["What it may propose", "Any of the five changes. Nothing here writes anything: every one is a proposal a person still has to accept."],
        ["Grounded in", "Which doctrine from the EA knowledge base shapes it, and gets cited in what it says."],
        ["Model", "Its own provider, or whatever Settings → Models has set for the graph agent."],
        ["Budget", "Runs a day, and proposals a run. Both are enforced before a model is called."],
      ],
    },
    { kind: "note", tone: "why", title: "Why a scope is required", text: "It would be easy to default to “the whole model”, and that is exactly how a fleet stops being accountable: six agents all reading everything, and no way to answer what any of them can see. Writing the query is a minute's work and it is the minute that makes the rest legible. Write `*` when an agent really should read all of it." },

    { kind: "heading", text: "Draft first", id: "draft" },
    { kind: "prose", text: "A new agent starts as a **draft**, and a draft runs as a **dry run**: you see exactly what it would have proposed, and nothing reaches the review queue. Read its first few opinions, fix the sentence, run it again — then **Give it a voice** when you like what it says. It is the same courtesy you would extend to a new colleague, and it costs one call." },
    {
      kind: "steps",
      steps: [
        { do: "Describe it, and save. It is a draft." },
        { do: "Press Dry run.", note: "One call. The run appears below with everything it would have said, and everything checking threw away." },
        { do: "Read the dropped ones too.", note: "“Quoted words that X does not say” means the model invented something. A lot of those means the purpose is pointing it at work it cannot do from what it can see." },
        { do: "Give it a voice — or change what you asked it for and dry run again." },
      ],
    },

    { kind: "heading", text: "The run log", id: "runs" },
    { kind: "prose", text: "Every run leaves a row, whatever happened: what it read, what it proposed, what was thrown away in checking and why, which model answered, how long it took. Runs a budget or a pause **refused** are recorded too — an agent that has been silently refused eleven times is a fact you need." },
    { kind: "note", tone: "why", title: "Why failed and refused runs are kept", text: "A log that records only what worked is a log that flatters. The two questions worth asking about an agent months later — is it saying anything useful, and is it quietly not running — are both answered by the rows a tidier log would have dropped." },
    { kind: "note", tone: "tip", text: "Its suggestions appear in the review queue on the Knowledge graph page, labelled with the agent's name — so a reviewer knows whose judgement they are reading, and the fleet can say how often people keep it." },

    { kind: "heading", text: "Pausing and retiring", id: "status" },
    {
      kind: "list",
      items: [
        "**Draft** — runs, says nothing. Where every agent begins.",
        "**Active** — runs for real, and what it proposes reaches the review queue.",
        "**Paused** — will not run. Its history is kept.",
        "**Retired** — finished, kept so its record outlives it. Bring it back to draft to run it again.",
      ],
    },
    { kind: "try", href: "/w/:slug/agents", label: "See your agents" },
  ],
};

/**
 * Agents on a schedule, and the digest that makes them worth having.
 *
 * The page a person opens when they notice something ran without them, so it leads with the rules
 * rather than the feature: what runs unattended, what stops it, and where the evidence is.
 */
export const UNATTENDED: DocPage = {
  slug: "while-you-were-away",
  title: "Agents that run themselves",
  summary: "Putting an agent on a schedule, what stops it, and the digest of what happened while you were away.",
  keywords: ["schedule", "scheduled", "unattended", "overnight", "digest", "cron", "automatic", "ambient", "budget", "trigger", "while you were away"],
  blocks: [
    { kind: "prose", text: "An agent you have to remember to run is a tool. An agent that has already looked, and is waiting to tell you what it found, is the reason to have agents at all. Any **active** agent can be given a schedule, and everything it produces still waits for a person — a scheduled agent is not a more powerful agent, it is the same agent with nobody watching." },
    { kind: "heading", text: "Giving one a schedule", id: "schedule" },
    {
      kind: "table",
      columns: ["Choice", "What it means"],
      rows: [
        ["Only when asked", "The default, and right for most. It runs when you press the button."],
        ["About once an hour", "For something watching a fast-moving corner of the estate. Wants 24 runs a day of budget."],
        ["About once a day", "The usual choice. One run, most mornings."],
        ["About once a week", "For a review that would be noise more often than that."],
      ],
    },
    { kind: "note", tone: "why", title: "Why “about”, and not 02:00", text: "A fixed time needs a timezone, and a workspace is an organisation rather than a place — an EA team at an energy operator is not all in one country. So a daily agent is one that runs when it has not run for a day. It drifts by a few minutes, which is the honest cost, and it never runs twice because the clocks went back." },
    { kind: "note", tone: "tip", text: "A schedule only moves an **active** agent. A draft still runs when you ask — that is what a draft is for — but nothing unattended happens until somebody has read what it does and made it active." },
    { kind: "heading", text: "What stops it", id: "limits" },
    {
      kind: "list",
      items: [
        "**Its budget.** Runs a day is counted before the model is called, so an hourly agent with a budget of 12 does twelve runs and refuses the rest — and the refusals are written down, which is how you find out rather than guessing.",
        "**Its status.** Paused, retired or not yet approved, and it does not run. Nothing about a schedule overrides that.",
        "**Its scope.** Unchanged: it reads the objects its query matches and nothing else, whoever started it.",
        "**Nothing else.** There is no separate, looser path for unattended work. It is the same run.",
      ],
    },
    { kind: "heading", text: "While you were away", id: "digest" },
    { kind: "prose", text: "When something has happened, the workspace home opens with a short panel: which agents ran without being asked, what they proposed, what anybody accepted or dismissed since, and — first, because it is the thing people least expect — any agent that refused to run and why." },
    { kind: "note", tone: "why", title: "Why it is usually not there", text: "Most mornings nothing happened, and on those mornings the panel does not appear at all. A digest that speaks every day gets skimmed, and then skipped, and then the one morning it has something to say it is already invisible. Silence is what keeps the rest of it worth reading." },
    { kind: "note", tone: "tip", text: "Dismissing it is the only thing that moves the window — reading is not dismissing, so a glance on a phone does not cost you the digest you meant to read properly. Proposals that were already waiting when you dismissed it will not bring it back; only new ones will." },
    { kind: "heading", text: "If nothing ever runs", id: "trouble" },
    {
      kind: "table",
      columns: ["What you see", "Usually"],
      rows: [
        ["The agent says “not while it is not active”", "It is a draft. Make it active."],
        ["Runs appear, all refused", "Its budget is smaller than its schedule wants. The editor warns about this when you pick one."],
        ["Nothing at all in the run log", "No model is configured for the graph-agent job — see *What Nexus thinks with*."],
        ["It ran, and proposed nothing", "Often the right answer. An agent that finds nothing wrong should say nothing."],
      ],
    },
    { kind: "try", href: "/w/:slug/agents", label: "Open the fleet" },
  ],
};

export const WHAT_CHANGED: DocPage = {
  slug: "what-changed",
  title: "What changed, and who changed it",
  summary: "The knowledge graph's own history: every change to an object, whose it was, and where it happened.",
  keywords: ["history", "audit", "audit trail", "changed", "who", "provenance", "timeline", "log", "accountability", "what changed", "undo"],
  blocks: [
    { kind: "prose", text: "Boards have had version history for a long time. The **graph** — the model itself — now has one too. Every change to an object is written down with its before and after, the hand that made it, and where it happened: a person in the drawer, a board save, an overnight agent, an import." },
    { kind: "shot", src: "history", alt: "The What changed page, grouped by day, with coloured chips naming the person, agent or import behind each change", caption: "What changed. Filter by hand — “only what the agents did” is the question people actually ask." },
    { kind: "heading", text: "Where to read it", id: "where" },
    {
      kind: "list",
      items: [
        "**What changed**, in the sidebar: everything in the workspace, newest first, grouped by day. Filter by people, agents, imports or boards, or type an object's name.",
        "**The entity drawer**: the same timeline, for one object. Open anything from the knowledge graph and scroll to *History*.",
      ],
    },
    { kind: "heading", text: "What counts as a change", id: "what" },
    {
      kind: "table",
      columns: ["Recorded", "Not recorded"],
      rows: [
        ["A name, a kind, a description", "Cards moved, resized or recoloured on a board"],
        ["An attribute set, changed or removed", "A board renamed, a space created"],
        ["An object created, deleted or merged away", "A proposal you dismissed without accepting"],
        ["A relation drawn or removed, on both ends", "A change set you have written but not delivered"],
      ],
    },
    { kind: "note", tone: "why", title: "Why the board's own edits are elsewhere", text: "Moving a card is a change to a picture, not to the estate. Boards keep their own version history for that, and mixing the two would bury the six changes that mattered under six hundred that did not. A card edit appears here only when it reaches the model — because then it *is* the model." },
    { kind: "heading", text: "It does not record your typing", id: "coalescing" },
    { kind: "prose", text: "Renaming a card takes eleven keystrokes and four autosaves. The history folds those into the one change they add up to: *renamed it from “Maximo” to “Maximo EAM”*. Change something and change it straight back, and nothing is written at all — because nothing happened." },
    { kind: "note", tone: "tip", text: "Folding only applies within a couple of minutes, to the same person, in the same place. If somebody else edits the same field in between, both changes stand: “Maria changed it and Tobias changed it back” is two facts, not zero." },
    { kind: "heading", text: "Deleted objects keep their history", id: "deleted" },
    { kind: "prose", text: "A deletion is the most interesting thing that can happen to an object, so the history of a deleted object survives it — with the name it had. That is the difference between an audit trail and a list of things that currently exist." },
    { kind: "note", tone: "why", title: "Why an agent's work says whose it is", text: "Since agents can run on a schedule, the model can change while nobody is watching. A system of record that cannot tell an overnight agent's work from a colleague's is not one. The actor is recorded at the moment of the write and never guessed afterwards — where nothing can be established, it says so." },
    { kind: "try", href: "/w/:slug/history", label: "See what changed" },
  ],
};
