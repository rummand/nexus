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
    { kind: "note", tone: "tip", text: "While you drag, the board draws the card where it would land, at the size it will be — so you can see whether it fits before you let go. Drag a whole kind by its **+** and you get the grid, with a count above it. A drop onto one of the floating panels is refused rather than putting the card underneath one." },
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
    { kind: "heading", text: "Asking without placing anything", id: "ask" },
    { kind: "prose", text: "You do not always want an agent standing there. Select any objects on a board — one, or a dozen — and the Selection panel offers **Ask about these**. The selection is the scope, which is the fastest way there is of saying “these ones”, and nothing is set up, saved or left behind." },
    { kind: "shot", src: "ask-selection", alt: "Two cards selected, with an Ask about these box and three suggested questions in the Selection panel", caption: "Two cards selected. The selection is the scope — ask in the box, or take one of the three it offers." },
    {
      kind: "list",
      items: [
        "The answer is prose from a model and is presented as such. What makes it usable is the list under it: each object it read, with the words it read on that object.",
        "Click a citation to fly to the object it names.",
        "A citation that cannot be found on the object it names is dropped, and the drop is counted where you can see it.",
        "An answer with nothing left to cite is still shown — marked as an opinion rather than a reading, so you can weigh it.",
      ],
    },
    { kind: "note", tone: "warning", title: "It needs a model", text: "Waking an agent, or asking about a selection, needs `ANTHROPIC_API_KEY` and `NEXUS_MODEL` configured. Without them Nexus says so where you asked rather than failing quietly — and every other part of it carries on working." },
    { kind: "try", href: "/w/:slug", label: "Open a board and place one" },
  ],
};

/**
 * Two people on one board.
 *
 * Written for the moment somebody notices a cursor that is not theirs and wants to know what the
 * rules are — because on a shared canvas the rules are the feature. It says plainly what merges,
 * what does not, and what happens when the connection goes, since all three are things a person
 * will otherwise have to discover by losing something.
 */
export const TOGETHER: DocPage = {
  slug: "together",
  title: "Two people on one board",
  summary: "Cursors, who has hold of what, the one thing that locks, and what happens when the connection drops.",
  keywords: ["multiplayer", "collaboration", "together", "presence", "cursors", "shared", "live", "conflict", "lock", "workshop", "real-time"],
  blocks: [
    { kind: "prose", text: "Open a board somebody else already has open and you are both on it. Their cursor moves, what they have selected is outlined in their colour, and anything they change appears on your screen as they do it. Nobody presses share and nobody presses save." },
    { kind: "shot", src: "board-together", alt: "A board with somebody else's coloured cursor on it, their name beside it, an outline around the card they have selected and their initials in the topbar", caption: "Somebody else on the same board: their pointer, what they have hold of, and the field they are typing in." },
    { kind: "note", tone: "why", title: "Why this replaced “changed elsewhere — reload”", text: "Until now the second person to save was refused, because refusing is the only honest answer when there is no merge. It was the right answer to the wrong question: an architecture canvas is a thing two people stand in front of, and the fix was to be able to merge rather than to apologise better." },
    { kind: "heading", text: "What you can see", id: "presence" },
    {
      kind: "table",
      columns: ["On the board", "What it is"],
      rows: [
        ["A coloured arrow with a name", "Their pointer, in **board** coordinates — if you are zoomed out further than they are it still points at the same card, not at the same bit of glass."],
        ["A thin coloured outline", "What they have selected. Quieter than your own selection, because it is information rather than a handle."],
        ["Initials in the topbar", "Everybody on this board. One person in two tabs is two cursors, and the same colour, because it is one person."],
        ["**Shared** instead of **Saved**", "The board is writing itself down for all of you together, rather than each tab saving its own copy."],
      ],
    },
    { kind: "heading", text: "What happens when you both touch the same thing", id: "conflicts" },
    {
      kind: "table",
      columns: ["Both of you", "What happens"],
      rows: [
        ["Move different cards", "Both moves land. This is almost always what is happening."],
        ["Move the same card", "The later move wins — a real conflict with a defined answer, decided by the order the server heard them rather than by whose network was quicker."],
        ["Type in the same field", "You cannot. The first person in has it; for everybody else it turns their colour and goes read-only until they leave it."],
        ["Delete something the other is editing", "It goes. A board is a shared drawing, and a delete is as legitimate as a move."],
        ["Undo", "Undoes **your** last change, never theirs. Ctrl+Z on a shared board has to mean what it means everywhere else."],
      ],
    },
    { kind: "note", tone: "why", title: "Why a lock on text and nothing else", text: "Positions, colours and kinds merge under “the last one wins” without losing anything — there is one value and somebody set it. Two people typing into one field under that same rule silently eat each other's characters, which looks like the product losing your work. Locking the field is a smaller promise, kept: nobody can be halfway through a sentence and have it rewritten underneath them." },
    { kind: "note", tone: "tip", text: "The lock is presence, not a state. It lifts the moment they click elsewhere, close the tab or lose their connection — there is nothing to release, and nothing that can get stuck." },
    { kind: "heading", text: "When the connection goes", id: "offline" },
    { kind: "prose", text: "The board does not stop. It reconnects by itself, and while it is down your tab goes back to saving for itself — which is also what happens if a corporate proxy will not carry the connection at all. In that state two people editing at once is the old story again: the second save is refused and says so, because your tab genuinely cannot see what the other person did." },
    { kind: "note", tone: "warning", title: "One instance", text: "The shared session lives in the server's memory, so it works when everybody is talking to the same instance — which is the deployment Nexus ships as. Behind a load balancer spreading people across replicas, two people could land in different sessions and not see each other. That is the same limit that makes a single database file work today, and it lifts with the same change." },
    { kind: "heading", text: "Something else changed the board", id: "elsewhere" },
    { kind: "prose", text: "Approving an import, restoring a version or deleting a relation rewrites a board from outside the canvas. If you are standing on it when that happens the new version simply arrives, in front of everybody on it. That used to be the case that required a reload." },
    { kind: "try", href: "/w/:slug", label: "Open a board", note: "Open the same one in a second window to see it for yourself." },
  ],
};
