import type { DocPage } from "../types";

export const START: DocPage = {
  slug: "start",
  title: "Start here",
  summary: "What Nexus is, the five ideas it rests on, and a ten-minute tour.",
  keywords: ["introduction", "overview", "tour", "concepts", "getting started"],
  blocks: [
    {
      kind: "prose",
      text: "Nexus is an infinite canvas whose drawings are backed by a graph. You draw the way you would in Miro — cards, connectors, frames, notes — and everything you draw becomes part of one model of your organisation, shared across every board in the workspace. Rename a system on one board and it is renamed everywhere, because there is only one of it.",
    },
    {
      kind: "prose",
      text: "That is the whole trick. Most architecture tools make you choose between a repository that nobody wants to open and a whiteboard that nobody can query. Here the picture and the model are the same thing seen twice.",
    },
    { kind: "shot", src: "home", alt: "The Nexus workspace home, with spaces, boards and the navigation sidebar", caption: "The workspace home. Boards live in spaces; spaces belong to teams." },
    { kind: "heading", text: "The five ideas", id: "ideas" },
    {
      kind: "list",
      items: [
        "**A board is a view, not a document.** Cards are the canvas face of graph objects. Deleting a card takes it off that board and leaves the object alone.",
        "**The meta-model emerges.** You are not asked to choose a framework before you can draw. Types grow from what you actually put on boards, and you declare them when you are ready to be strict.",
        "**Agents propose, people decide.** Nothing an agent finds changes the model on its own. Every suggestion arrives with the evidence behind it and an accept or dismiss.",
        "**Everything carries its provenance.** An object should be able to say where it came from — which meeting, which document, which import.",
        "**The model has a future tense.** Change sets describe what you intend to do to the estate, and plateaus name the states those changes produce.",
      ],
    },
    { kind: "heading", text: "A ten-minute tour", id: "tour" },
    {
      kind: "steps",
      steps: [
        { do: "Open a board from the home page.", note: "The seeded workspace has an application landscape, a capability map and an integration overview." },
        { do: "Click a card. The inspector on the right shows its kind, title, description and attributes — and, underneath, what it is connected to in the graph." },
        { do: "Open the Graph panel on the left and switch to Viewpoint. Try the Impact lens on a selected card to see what depends on it." },
        { do: "Go to Knowledge graph in the sidebar. This is every object in the workspace, its health score, and what the agent proposes fixing." },
        { do: "Go to Roadmap. Two plans are already there; open one to see what it would break." },
      ],
    },
    { kind: "try", href: "/w/:slug", label: "Open your workspace home", note: "Everything in this guide works against your own workspace." },
    {
      kind: "note",
      tone: "why",
      title: "Why there is no wizard",
      text: "You can start drawing on an empty board and never fill in a form. The structure is meant to accumulate from the work rather than be declared before it — which is the difference between a model people maintain and one they abandon after the project that funded it.",
    },
  ],
};

export const FIRST_BOARD: DocPage = {
  slug: "first-board",
  title: "Your first board",
  summary: "Draw something, and watch it become part of the model.",
  keywords: ["new board", "create", "card", "connector", "tutorial"],
  blocks: [
    {
      kind: "prose",
      text: "The fastest way to understand Nexus is to put four boxes on a board and then go and look at the graph. This takes about five minutes.",
    },
    {
      kind: "steps",
      title: "Draw it",
      steps: [
        { do: "From the workspace home, choose a space and click New board — or pick one of the starters if you want a shape to begin from." },
        { do: "Press C and click on the canvas. That places an architecture card.", note: "The title is focused straight away, so just type the name." },
        { do: "Fill in the kind — Application, Business Capability, whatever you actually call it. The colour follows the kind." },
        { do: "Place two or three more the same way." },
        { do: "Press L, then drag from the edge of one card to another to connect them. Type a label on the connector: “depends on”, “feeds”, “master data”." },
      ],
    },
    { kind: "shot", src: "board", alt: "A board showing application cards connected by labelled connectors", caption: "An application landscape. Every card here is also an object in the graph." },
    {
      kind: "steps",
      title: "See what happened",
      steps: [
        { do: "Open the Graph panel on the left (the database icon in the rail) and stay on the Inventory tab. Your new objects are in it." },
        { do: "Go to Knowledge graph in the sidebar. The cards you drew are entities; the connectors you labelled are relations." },
        { do: "Open a second board and drag the same object out of the inventory onto it. It is the same object, on two boards." },
      ],
    },
    {
      kind: "note",
      tone: "tip",
      title: "Naming matters more than kinds",
      text: "If you type a name that already exists, Nexus offers to link to the existing object instead of making a second one. Take the offer — two spellings of one system is the single most common way a model stops being trustworthy.",
    },
    { kind: "try", href: "/w/:slug", label: "Go and make a board" },
  ],
};
