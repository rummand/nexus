import type { DocPage } from "../types";

export const CANVAS: DocPage = {
  slug: "canvas",
  title: "The canvas",
  summary: "Navigating, drawing, arranging, presenting and exporting a board.",
  keywords: ["zoom", "pan", "frame", "note", "shape", "align", "present", "export", "png", "svg"],
  blocks: [
    { kind: "prose", text: "The canvas is infinite and everything on it lives in world coordinates, so a board never runs out of room and the zoom level is only ever about what you are looking at." },
    { kind: "heading", text: "Getting around", id: "navigating" },
    {
      kind: "keys",
      rows: [
        ["Scroll / two fingers", "Pan"],
        ["⌘ + scroll, or pinch", "Zoom at the cursor"],
        ["Space + drag, or middle mouse", "Pan from anywhere"],
        ["⇧1 · ⇧2", "Fit the whole board · fit the selection"],
        ["⌘0 · ⌘+ · ⌘−", "100% · zoom in · zoom out"],
      ],
    },
    { kind: "note", tone: "tip", text: "Zoom-to-fit knows where the floating panels are and fits into the space they leave, so nothing lands underneath the inspector." },
    { kind: "heading", text: "What you can draw", id: "objects" },
    {
      kind: "table",
      columns: ["Object", "Key", "What it is for"],
      rows: [
        ["Card", "C", "An architecture object: a system, a capability, a data object. Backed by the graph."],
        ["Note", "N", "A remark. Local to the board — it is not part of the model."],
        ["Text · Section", "T · S", "A paragraph, or a tinted heading to divide a board into areas."],
        ["Frame", "F", "A labelled region. Frames group things visually and become slides when you present."],
        ["Shape", "R · O · D", "Rectangle, oval, rhombus — for the parts of a picture that are not objects."],
        ["Connector", "L", "A line between two things. Label it and, between two cards, it becomes a relation."],
      ],
    },
    { kind: "note", tone: "why", title: "Why notes are not objects", text: "A note is deliberately outside the model. Not everything on a whiteboard is a claim about the organisation, and a tool that treats every scribble as an entity produces a graph nobody trusts. When a note turns out to matter, right-click it and promote it to a card." },
    { kind: "heading", text: "Arranging", id: "arranging" },
    {
      kind: "list",
      items: [
        "Drag with smart guides on; hold **Alt** to ignore them when you want an exact offset.",
        "Select two or more objects and the selection bar offers alignment; three or more adds distribute.",
        "**Arrows** nudge by 1, **⇧Arrows** by 10.",
        "The Viewpoint tab can arrange the whole board for you — group by kind, group by an attribute, or lay out by dependency.",
      ],
    },
    { kind: "heading", text: "Presenting and exporting", id: "sharing" },
    {
      kind: "steps",
      steps: [
        { do: "Press the Present button in the topbar to hide all chrome.", note: "If the board has frames, each frame becomes a slide; arrow keys move between them. Esc leaves." },
        { do: "Export from the topbar: PNG for a slide, SVG for something that stays sharp." },
        { do: "Share copies a link to the board. Anyone in the workspace opens the same board at the same place." },
      ],
    },
    { kind: "heading", text: "Saving", id: "saving" },
    { kind: "prose", text: "Boards save themselves. The topbar shows Saved, Saving… or Unsaved changes. If somebody else saves the same board while you have it open, your next save is refused rather than overwriting them — the pill becomes “Changed elsewhere — reload”, and reloading is the only honest fix, because Nexus has no way to merge two people's canvases." },
    { kind: "shot", src: "board-inspector", alt: "The Selection inspector showing a card's kind, title, description and attributes", caption: "The inspector edits the selected object. For a card, this is also editing the graph object behind it." },
  ],
};

export const BOARDS_AND_GRAPH: DocPage = {
  slug: "boards-and-graph",
  title: "Cards, objects and attributes",
  summary: "How a drawing becomes a model, and how to keep the two in step.",
  keywords: ["entity", "relation", "attribute", "link", "duplicate", "merge", "inventory", "lifecycle", "owner"],
  blocks: [
    { kind: "prose", text: "A card carries a hidden id that points at a graph object. Two cards on two boards with the same id are two views of one system, and editing either edits the system. That is why renaming something on a board renames it everywhere." },
    { kind: "shot", src: "board-graph-panel", alt: "The Graph panel's Inventory tab, listing objects by kind", caption: "The Inventory tab lists every object in the workspace. Drag one onto the canvas to place it, or click the + button." },
    { kind: "heading", text: "Attributes", id: "attributes" },
    { kind: "prose", text: "Attributes are free-form key/value pairs on an object: owner, lifecycle, criticality, vendor, cost. There is no fixed list, because every organisation records something different — the set of keys you actually use becomes your emergent attribute schema, visible on the Meta-model page." },
    {
      kind: "list",
      items: [
        "Add them in the inspector, on the card, under Attributes.",
        "Some values read as a warning and are tinted: **lifecycle** of “end of life”, **criticality** of “high”, a compliance value of “non-compliant”.",
        "The Attribute lens colours a whole board by any key, which is the fastest way to see where the risk sits.",
        "The entity table on the Knowledge graph page can set an attribute on many objects at once.",
      ],
    },
    { kind: "heading", text: "Avoiding duplicates", id: "duplicates" },
    {
      kind: "steps",
      steps: [
        { do: "When you type a name that matches an object that already exists, the card offers to link to it. Accept unless you genuinely mean a second thing." },
        { do: "If duplicates get in anyway, the Knowledge graph page proposes merges, and each proposal names both objects and where they are used." },
        { do: "Accepting a merge rewrites every board that referenced the loser, including the one you have open.", note: "It cannot be undone, so the confirmation says how many objects it will touch." },
      ],
    },
    { kind: "note", tone: "warning", title: "Deleting", text: "Deleting a card removes it from that board only. Deleting an *object* — from the inventory or the entity table — removes it from the model and unlinks every card that showed it. The graph is meant to outlive individual boards, so the two are deliberately different actions." },
    { kind: "try", href: "/w/:slug/graph", label: "Open the knowledge graph" },
  ],
};

export const VIEWPOINTS: DocPage = {
  slug: "viewpoints",
  title: "Viewpoints and lenses",
  summary: "Ways of looking at a board: dim by kind, four lenses, and saved views.",
  keywords: ["lens", "impact", "filter", "dim", "saved view", "query lens", "relations"],
  blocks: [
    { kind: "prose", text: "A board usually has more on it than any one conversation needs. Rather than making you build a second board for every audience, Nexus lets you look at the same board differently and save that look." },
    { kind: "shot", src: "board-viewpoint", alt: "The Viewpoint tab with expand, relations, cleanup and lens controls", caption: "The Viewpoint tab. Everything here changes what you see, not what is on the board." },
    { kind: "heading", text: "The lenses", id: "lenses" },
    {
      kind: "table",
      columns: ["Lens", "What it shows"],
      rows: [
        ["Impact", "Select a card and everything within N hops lights up, badged with its distance. The rest dims. Direction can be inbound, outbound or both."],
        ["Attribute", "Colours every card by the value of one attribute, with a legend. Use it for lifecycle, owner, criticality."],
        ["Relations", "Colours the connectors by relation type, so you can see which kind of coupling dominates."],
        ["Query", "Runs a graph query and highlights the matches, with a button to place any that are not on the board yet."],
      ],
    },
    { kind: "shot", src: "board-lens-impact", alt: "A board with the impact lens active, showing hop badges and dimmed unrelated objects", caption: "The impact lens: what a selected system reaches, and how far away each thing is." },
    { kind: "heading", text: "Dimming by kind", id: "kinds" },
    { kind: "prose", text: "Under Kinds on this board, click any kind to dim it. This is per-viewer and never touches the document — useful for showing a business audience the capabilities without the infrastructure." },
    { kind: "heading", text: "Saved views", id: "saved" },
    { kind: "steps", steps: [
      { do: "Set the board up the way you want it: dim what you do not need, pick a lens, position the camera." },
      { do: "Name it at the bottom of the Viewpoint tab and press Save." },
      { do: "Applying a saved view restores the dimming, the lens and the camera position.", note: "Saved views live with the board, so anyone who opens it can use them." },
    ] },
  ],
};

export const COMPOSE: DocPage = {
  slug: "compose",
  title: "Writing a board instead of drawing it",
  summary: "Compose builds a board from a few lines of English — or from a request, when a model is configured.",
  keywords: ["compose", "script", "generate", "llm", "planner", "natural language"],
  blocks: [
    { kind: "prose", text: "Dragging forty cards into place is not architecture, it is data entry. Compose describes the board you want in a few lines and builds it from the graph." },
    { kind: "shot", src: "board-compose", alt: "The Compose panel with a five-line script", caption: "Five lines. Each one is echoed back as the query it compiled to, so you can see what it understood." },
    { kind: "heading", text: "The lines you can write", id: "grammar" },
    {
      kind: "table",
      columns: ["Line", "What it does"],
      rows: [
        ["`add all applications`", "Puts matching objects on the board."],
        ["`add applications owned by Grid Operations`", "The same, narrowed by an attribute."],
        ["`remove data objects`", "Takes matching objects off it."],
        ["`expand 2 hops`", "Pulls in the neighbours of what is already there."],
        ["`connect them`", "Draws the relations between what is on the board."],
        ["`group by kind` · `group by owner`", "Puts the cards in labelled frames."],
        ["`colour by lifecycle`", "Colours the cards by an attribute."],
        ["`lay out as flow`", "grid, columns, rows, circle or flow — flow layers by dependency."],
        ["`title Application landscape`", "Adds a heading."],
        ["`clear`", "Empties the board first."],
      ],
    },
    { kind: "shot", src: "board-compose-built", alt: "A board built from a Compose script, with each line reported back", caption: "Every line reports what it did. A line it cannot read says so instead of failing silently." },
    { kind: "note", tone: "warning", title: "Building replaces the board", text: "A build clears what is there first. The confirmation says how many objects it will replace, and version history keeps the previous state — History in the topbar will restore it." },
    { kind: "heading", text: "With a model configured", id: "planner" },
    { kind: "prose", text: "If the deployment has an API key set, you can write a request in plain English instead of the line grammar. The planner reads the graph first — you will see what it looked at — and then proposes steps. Those steps go through the same validator as anything you typed: the model can only ever propose moves the instruction set already allows, so a confused answer produces a poor board rather than an unexpected change to your model." },
    { kind: "prose", text: "The board keeps the script that produced it. Reopen the Compose panel later and it is still there, ready to edit and re-run." },
    { kind: "try", href: "/w/:slug", label: "Open a board and press Compose" },
  ],
};

export const SEARCH: DocPage = {
  slug: "search",
  title: "Searching and the query grammar",
  summary: "The command bar, and the clauses you can use to ask the graph a question.",
  keywords: ["search", "query", "command bar", "find", "filter", "kind", "related"],
  blocks: [
    { kind: "prose", text: "Press ⌘K on a board. The command bar searches what is on the board, and — if what you typed parses as a query — asks the whole graph instead, with a Place button to bring the results onto the canvas." },
    { kind: "shot", src: "board-command-bar", alt: "The command bar with a structured query typed into it", caption: "A structured query. Clauses combine with a space and are ANDed together." },
    {
      kind: "table",
      columns: ["Clause", "Matches"],
      rows: [
        ["`kind:Application`", "Objects of that kind."],
        ["`owner:\"Grid Operations\"`", "Any attribute key and value. Quote anything containing a space."],
        ["`has:owner` · `missing:owner`", "The attribute is present, or absent."],
        ["`related:Maximo`", "Within one hop of that object, either direction."],
        ["`to:SCADA` · `from:SCADA`", "A relation pointing at it, or leading away from it."],
        ["`rel:\"depends on\"`", "Restricts the relation type used by related / to / from."],
        ["`on:\"Application landscape\"`", "Already placed on a board whose name contains this."],
        ["`billing`", "Free text over names, descriptions and attribute values."],
      ],
    },
    { kind: "note", tone: "tip", text: "The same grammar drives the Query lens and Compose's `add` lines, so a query you find useful in the command bar can be pasted straight into a script." },
    { kind: "prose", text: "The search box in the sidebar is different: it looks across boards and objects in the whole workspace, and is the quickest way to find where something is drawn." },
  ],
};

export const TIMELINE: DocPage = {
  slug: "timeline",
  title: "Laying a board out on a time axis",
  summary: "Any attribute that reads as a date can become the axis of a board — end of support, contract renewal, the date a plan lands.",
  keywords: ["timeline", "time axis", "date", "end of support", "lifecycle", "lanes", "swimlane", "roadmap", "arrange", "layout"],
  blocks: [
    { kind: "prose", text: "Most tools have a roadmap screen: a fixed picture, built from a fixed data model, that you cannot use for anything else. Nexus has a timeline *layout* instead. If the cards on a board carry an attribute that reads as a date, that attribute can be the axis, and anything else about them can be the lanes. A roadmap is then one of the things you can say with it rather than a screen of its own." },
    { kind: "shot", src: "board-timeline", alt: "A landscape board laid out along end of support, with year columns and a lane for cards with no date", caption: "An ordinary landscape board, laid out along end of support. The relations came with the cards — this is the same board, moved." },
    { kind: "heading", text: "Doing it", id: "doing" },
    {
      kind: "steps",
      steps: [
        { do: "Open the Graph panel and switch to Viewpoint. If anything on the board has a date-shaped attribute, a **Timeline** group appears.", note: "Only attributes that actually parse as dates are offered. Laying a board out by “owner” and getting one column would look like a broken feature rather than a misunderstanding." },
        { do: "Pick the attribute for **Along** — the axis." },
        { do: "Optionally pick **In lanes by**: kind, or any other attribute. Lanes are ordered busiest first." },
        { do: "Press Lay out. The layout is placed below whatever is already on the board, so nothing you drew is overwritten." },
      ],
    },
    { kind: "heading", text: "Dates it understands", id: "dates" },
    {
      kind: "table",
      columns: ["You type", "It reads"],
      rows: [
        ["`2027-03-14`", "14 March 2027"],
        ["`2027-03`", "March 2027"],
        ["`2027 Q3` or `Q3 2027`", "the third quarter of 2027"],
        ["`March 2027`, `Mar 2027`", "March 2027"],
        ["`2027`", "the year — but only if the number could plausibly be a year"],
      ],
    },
    { kind: "note", tone: "why", title: "Why “1200” is not a date", text: "It is a cost, a count or a port number. A card silently placed in the year 1200 is a lie the reader has no way to catch; a card parked in the “no date” lane is a question somebody can answer. Anything that does not clearly parse goes in that lane rather than being guessed at." },
    { kind: "heading", text: "How the axis is drawn", id: "axis" },
    {
      kind: "list",
      items: [
        "The granularity is chosen from the span: months for a few months, quarters for a year or two, years beyond that.",
        "Every period between the first and the last gets a column, **including the empty ones** — so a gap in the plan is visible rather than closed up.",
        "Columns are equal width rather than a linear time scale. A linear scale spends most of the board on the gap between two clusters and squeezes the clusters into nothing: accurate, and unreadable.",
        "Cards in the same lane and period stack downwards, and the lane grows to hold them.",
      ],
    },
    { kind: "note", tone: "tip", text: "Compose can do it in a line: `lay out applications on a timeline by end of support in lanes by owner`. The lanes are frames and the period labels are section blocks, so everything the layout draws is an ordinary board object you can rename, recolour or delete." },
    { kind: "try", href: "/w/:slug", label: "Open a board and try it" },
  ],
};

export const BOARD_AGENTS: DocPage = {
  slug: "agents-on-the-board",
  title: "Agents on the board",
  summary: "Put an agent where the work is, tell it what to watch in your own words, and read what it says on the objects it is talking about.",
  keywords: ["agent", "board agent", "remark", "watch", "scope", "wake", "ai", "assistant", "annotation"],
  blocks: [
    { kind: "prose", text: "An agent in Nexus is an object on a board, not a feature of a page. You place it where the work is — beside the systems it should watch, inside the frame that scopes it, on the board the conversation is happening on. It has a name you give it, a purpose you write in your own words, and a scope decided by where you put it." },
    { kind: "prose", text: "What it produces is a **remark**: a short note pinned to one object, quoting the words on that object which prompted it. An agent on a board changes nothing by speaking. That is what makes it safe to have several of them, always there, in the middle of your thinking." },
    { kind: "heading", text: "Putting one down", id: "placing" },
    {
      kind: "steps",
      steps: [
        { do: "Pick the **Agent** tool (or press A) and click where you want it." },
        { do: "Name it for the job: “Succession watch”, “Ownership”, “Where does this contradict itself”." },
        { do: "Write what it is for. This is the whole interface — it is the instruction the agent is given, so say it the way you would say it to a colleague.", note: "Two agents on one board with different purposes really are two different agents, not two copies of one feature." },
        { do: "Choose what it can see, then press **Wake**." },
      ],
    },
    { kind: "heading", text: "What it can see", id: "scope" },
    {
      kind: "table",
      columns: ["Scope", "What it reads"],
      rows: [
        ["the board", "Everything drawn here."],
        ["its frame", "Whatever frame you dropped it into — the smallest one that contains it. Drag it somewhere else and its job changes."],
        ["what it joins", "Only the objects you connect it to with a line."],
      ],
    },
    { kind: "note", tone: "why", title: "Why scope is a place, not a query", text: "Every other tool would make you write a filter. On a canvas, where a thing sits already means something: this frame is the OT estate, these three cards are the ones under discussion. Dragging an agent into a frame is a faster and more honest way of saying what it should watch than any query language, and anyone looking at the board can see what it is watching without being told." },
    { kind: "heading", text: "Reading what it said", id: "remarks" },
    {
      kind: "list",
      items: [
        "Objects it has something to say about get a small badge. Click it to read the remark, in place.",
        "Every remark quotes the words on that object which prompted it — a remark it cannot ground is thrown away before you see it.",
        "**Keep as a note** turns it into an ordinary note beside the object. That is the only way an agent's words become part of the board: you make them yours.",
        "**Dismiss** removes it. **Look again** re-reads. The bin on the agent takes back everything it said.",
        "One remark per object per run, and silence is a valid answer — an agent that fills a board with observations is one nobody finishes reading.",
      ],
    },
    { kind: "note", tone: "tip", text: "An agent is an ordinary object: drag it, duplicate it, lock it, delete it, and it appears in the board's version history like everything else. Its remarks travel with the board, so a colleague opening it later sees what was said." },
    { kind: "note", tone: "warning", title: "It needs a model", text: "Waking an agent needs `ANTHROPIC_API_KEY` and `NEXUS_MODEL` configured. Without them the agent says so on the board rather than failing quietly — and every other part of Nexus carries on working." },
    { kind: "try", href: "/w/:slug", label: "Open a board and place one" },
  ],
};
