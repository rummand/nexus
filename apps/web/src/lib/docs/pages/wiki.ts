import type { DocPage } from "../types";

export const WIKI: DocPage = {
  slug: "wiki",
  title: "The wiki",
  summary: "Pages that reference the model rather than copying it — and a board that writes its own first draft.",
  keywords: ["wiki", "pages", "documentation", "markdown", "embed", "notion", "confluence", "write up", "reference architecture", "handbook"],
  blocks: [
    { kind: "prose", text: "Every architecture wiki fails the same way: somebody writes a good page, the estate moves, and the page stays where it was. A year later nobody trusts any of it. The wiki in Nexus is built to make that failure mode structurally impossible for the parts that matter — a page **references** the model instead of quoting it." },
    { kind: "shot", src: "wiki-page", alt: "A wiki page drafted from a board, with the board rendered live inside the page above a table of its objects", caption: "A page written from a board. The drawing is not a screenshot — it is the board, rendered from its current document each time the page is read." },
    { kind: "heading", text: "Embedding the model", id: "embeds" },
    { kind: "prose", text: "A line beginning `:::` puts something from the model into the page. It is resolved when the page is read, so it is never out of date." },
    {
      kind: "table",
      columns: ["Write this", "And the page shows"],
      rows: [
        ["`:::board brd_landscape`", "The board, drawn from its current document. Change the board and the page changes."],
        ["`:::object ent_8f21c40a`", "One object with its kind, description and attributes as they are now."],
        ["`:::query kind:Application missing:owner`", "A live list of whatever matches today, with a link into the graph for the rest."],
      ],
    },
    { kind: "note", tone: "tip", text: "Add ` | some caption` to any of them to say what the reader should notice. The Insert buttons in the editor write the syntax for you." },
    { kind: "prose", text: "If the thing an embed points at is deleted, the page says so in place. A wiki that silently drops a diagram is worse than one that admits the diagram is gone, because only the second one gets fixed." },
    { kind: "heading", text: "Letting a board write the page", id: "writeup" },
    { kind: "prose", text: "Blank pages are how wikis stay empty. **New page → write up a board** produces a first draft that is already half true: the board embedded live, the objects grouped by kind, how they connect, and the notes somebody left on the canvas carried across as prose." },
    {
      kind: "list",
      items: [
        "A kind with more than six objects becomes a **live query** rather than a table — a list of six is worth reading, a list of forty is worth querying.",
        "If the board has frames, the draft takes its structure from them: your areas become the page's sections.",
        "Objects sitting outside every frame are named rather than quietly dropped.",
        "It ends with **Still to write** — why this shape, who owns what, what is planned. A draft that reads as finished is one nobody edits.",
      ],
    },
    { kind: "note", tone: "why", title: "Why the draft is not written by a model", text: "It is deterministic, so it works with no model provider configured and gives the same answer twice. More importantly, a model asked to describe a board writes prose that is true on the day it is written. The draft is made of references instead, so the parts that can go stale are the parts you wrote yourself — which is the right way round." },
    { kind: "heading", text: "Linking and structure", id: "structure" },
    {
      kind: "list",
      items: [
        "`[[Another page]]` links inside the wiki by title. A link to a page that does not exist yet is shown as unresolved rather than as plain text, so you can see what you have promised to write.",
        "Pages nest. Drag is not in yet, but a page created from another page is filed under it.",
        "Deleting a page moves its children up rather than taking them with it.",
        "Renaming a page keeps its address, because a link somebody pasted into a mail six months ago should still work.",
      ],
    },
    { kind: "note", tone: "tip", text: "Headings build the contents list on the right automatically, from the third heading onwards." },
    { kind: "try", href: "/w/:slug/wiki", label: "Open the wiki" },
  ],
};
