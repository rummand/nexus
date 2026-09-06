import type { DocPage } from "../types";

export const SHORTCUTS: DocPage = {
  slug: "shortcuts",
  title: "Keyboard shortcuts",
  summary: "Everything the canvas responds to, in one place.",
  keywords: ["keyboard", "shortcuts", "keys", "hotkeys"],
  blocks: [
    { kind: "prose", text: "The same list is available on any board under Shortcuts in the topbar." },
    { kind: "heading", text: "Navigation", id: "navigation" },
    {
      kind: "keys",
      rows: [
        ["Scroll / two fingers", "Pan"],
        ["⌘ + scroll · pinch", "Zoom at the cursor"],
        ["Space + drag · middle mouse", "Pan"],
        ["⇧1 · ⇧2", "Fit board · fit selection"],
        ["⌘0 · ⌘+ · ⌘−", "100% · zoom in · zoom out"],
        ["⌘K", "Search the board · query the graph"],
        ["Esc", "Leave presentation mode"],
      ],
    },
    { kind: "heading", text: "Tools", id: "tools" },
    {
      kind: "keys",
      rows: [
        ["V · H", "Select · pan"],
        ["F · C · N", "Frame · card · note"],
        ["T · S", "Text · section"],
        ["R · O · D · L", "Rectangle · oval · rhombus · line"],
        ["Double-click", "Label a shape; on empty canvas, a new note"],
      ],
    },
    { kind: "heading", text: "Editing", id: "editing" },
    {
      kind: "keys",
      rows: [
        ["⌘Z · ⇧⌘Z", "Undo · redo"],
        ["⌘C · ⌘V · ⌘D", "Copy · paste · duplicate"],
        ["⌘A · ⌫ · Esc", "Select all · delete · deselect"],
        ["Arrows · ⇧Arrows", "Nudge by 1 · by 10"],
        ["⌘] · ⌘[", "Bring to front · send to back"],
        ["⇧ click · drag", "Add to selection · marquee"],
        ["Alt while dragging", "Ignore smart guides"],
        ["Right-click", "Object actions; turn a note into a card"],
      ],
    },
    { kind: "note", tone: "tip", text: "Tools revert to Select after one use, except Pan and Connector — connectors are usually drawn in batches." },
  ],
};

export const CONCEPTS: DocPage = {
  slug: "concepts",
  title: "Words used here",
  summary: "What Nexus means by object, relation, kind, viewpoint, change set and plateau.",
  keywords: ["glossary", "definitions", "terminology", "concepts", "entity", "relation"],
  blocks: [
    { kind: "prose", text: "Architecture vocabulary is overloaded — every word means three things depending on who is in the room. These are the meanings Nexus uses." },
    {
      kind: "table",
      columns: ["Word", "In Nexus"],
      rows: [
        ["Workspace", "One organisation's model. Everything — boards, objects, plans — belongs to exactly one."],
        ["Space", "A folder of boards, owned by a team."],
        ["Board", "An infinite canvas. A *view* of the model, not a document that owns anything."],
        ["Card", "The canvas face of an object. Two cards on two boards can be the same object."],
        ["Object (entity)", "A thing in the model: a system, a capability, a data object, a person."],
        ["Kind", "An object's type — Application, Business Capability. Emergent by default, declarable on the meta-model page."],
        ["Relation", "A labelled link between two objects. A labelled connector between two cards creates one."],
        ["Attribute", "A key/value on an object: owner, lifecycle, criticality. Free-form on purpose."],
        ["Viewpoint (saved view)", "A way of looking at a board: what is dimmed, which lens, where the camera sits."],
        ["Viewpoint (intake)", "Something a person expressed — a decision, risk, action, question or need — kept with who said it."],
        ["Lens", "A live optic over a board: impact, attribute, relations, query."],
        ["Source", "Something read into the model: a transcript, a document, an import. Objects point back at it."],
        ["Change set", "A named, dated set of intentions about the estate. Not applied until delivered."],
        ["Plateau", "A named, dated state: today plus the change sets that have landed by then."],
        ["Estate health", "A weighted score over six measures of whether the model can be trusted."],
      ],
    },
    { kind: "note", tone: "why", title: "Two things called viewpoint", text: "Unfortunate, and deliberate: both are the word the respective communities use. A saved view is ISO 42010's sense — a way of looking, for an audience. An intake viewpoint is a stance somebody took in a meeting. The context always makes it clear which is meant." },
  ],
};

export const FAQ: DocPage = {
  slug: "questions",
  title: "Questions people ask",
  summary: "Saving, collaboration, where the data lives, and what to do when something looks wrong.",
  keywords: ["faq", "troubleshooting", "help", "problem", "conflict", "backup", "collaboration", "undo"],
  blocks: [
    { kind: "heading", text: "Two of us opened the same board. What happens?", id: "conflict" },
    { kind: "prose", text: "Whoever saves second is refused rather than overwriting the first. The topbar becomes “Changed elsewhere — reload”, and reloading is the fix. Nexus has no way to merge two canvases, so refusing is the only honest option — real-time collaboration is a future piece of work, not something quietly half-done." },
    { kind: "heading", text: "I broke a board. Can I get it back?", id: "history" },
    { kind: "prose", text: "Yes. History in the topbar keeps automatic checkpoints while you work, plus one before any restore. Compare shows what differs between a checkpoint and the board as it is now, before you commit to going back." },
    { kind: "heading", text: "Why did deleting a card not delete the system?", id: "delete" },
    { kind: "prose", text: "Because a board is a view. Deleting a card takes it off that board; the object is still in the model and on any other board that shows it. To remove the object itself, delete it from the inventory or the entity table — that unlinks every card that showed it." },
    { kind: "heading", text: "The agent proposed something wrong.", id: "wrong-proposal" },
    { kind: "prose", text: "Dismiss it. The decision is remembered, so it will not come back. Proposals are rules and models reading your data; they are meant to be argued with, which is why each one shows the evidence rather than only the conclusion." },
    { kind: "heading", text: "Where does my data live?", id: "data" },
    { kind: "prose", text: "In one database belonging to the deployment — SQLite for a local instance, Postgres for a shared one. Boards, the graph, sources, plans: all of it. Nothing is sent to a model provider unless an API key is configured, and even then only the text of the request in hand." },
    { kind: "heading", text: "Nothing is happening when I ask in English.", id: "no-model" },
    { kind: "prose", text: "Compose and intake fall back to their rule engines when no model is configured — they still work, they are just literal. The Compose panel says so when that is the case. Setting an API key on the deployment turns the planner on." },
    { kind: "heading", text: "Can I get my model out?", id: "export" },
    { kind: "prose", text: "Boards export as PNG or SVG. The graph is readable over the HTTP API — `/api/graph/query` takes the same query grammar as the command bar. There is no proprietary format holding anything hostage." },
  ],
};
