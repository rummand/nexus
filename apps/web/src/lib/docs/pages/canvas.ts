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
