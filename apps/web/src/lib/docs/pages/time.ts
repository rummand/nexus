import type { DocPage } from "../types";

export const ROADMAP: DocPage = {
  slug: "roadmap",
  title: "Change sets: planning against the model",
  summary: "Describe what you intend to do to the estate, see what it would break, sequence it, and deliver it.",
  keywords: ["roadmap", "change set", "retire", "impact", "deliver", "dependency", "plan", "transition"],
  blocks: [
    { kind: "prose", text: "The graph is the estate as it is. A change set is what you intend to do to it — introduce this, retire that, this changes hands, connect these two — and it stays an intention until you deliver it. As-is therefore stays true while a plan is free to be speculative and wrong, which is what planning is." },
    { kind: "shot", src: "roadmap", alt: "The roadmap with as-is and to-be counts and a change set opened", caption: "As-is on the left, to-be on the right, and the plans that get from one to the other in between." },
    { kind: "heading", text: "Writing a plan", id: "writing" },
    {
      kind: "steps",
      steps: [
        { do: "Press New change set. Give it a name people would recognise in a meeting, and a target date if you have one." },
        { do: "Add what it does, one line at a time: retire a system, introduce something new, change an attribute, connect two things.", note: "Say why. The reasoning is the part somebody will need in two years, and it is one field." },
        { do: "Watch the counts at the top. To-be updates as you write." },
      ],
    },
    { kind: "heading", text: "What it would break", id: "impact" },
    { kind: "prose", text: "As soon as a plan retires something, Nexus computes the impact from the graph — not from a checklist. It separates four ways of being attached, because they are four different problems:" },
    {
      kind: "table",
      columns: ["Attachment", "The problem"],
      rows: [
        ["depends on it", "Stops working."],
        ["is served by it", "Loses an input."],
        ["feeds it", "Has a feed with nowhere to go — the decommissioning job people forget."],
        ["is connected to it", "The honest answer when the relation has no verb to read."],
      ],
    },
    { kind: "prose", text: "It also names what would be left attached to nothing at all, and how much sits one hop further out. Direction is read from the relation vocabulary, so the same verb answers differently depending on which end is disappearing." },
    { kind: "heading", text: "Sequencing", id: "dependencies" },
    { kind: "shot", src: "roadmap-dependencies", alt: "A change set that waits for another, with its blocker named and Deliver disabled", caption: "This plan waits for another. It is numbered second in delivery order, and cannot be delivered until the first lands." },
    {
      kind: "list",
      items: [
        "Under **Waits for**, pick another change set. A plan that waits for nothing is a plan somebody can start.",
        "Delivery is refused while a blocker is outstanding — including a blocker of a blocker.",
        "An abandoned blocker counts as outstanding: a plan waiting on something that will not happen is stranded, and that is a decision for you, not for the tool.",
        "A circular dependency is refused as you draw it.",
        "A plan dated before something it waits for is told so. A date is a hope; the contradiction is still worth seeing.",
      ],
    },
    { kind: "note", tone: "why", title: "Why a sequenced plan is not “stale”", text: "A change set that connects to a system the *previous* plan introduces would look broken if it were checked against today's graph. Each plan is therefore projected in the context of what it waits for, so it reads as sequenced rather than as wrong." },
    { kind: "heading", text: "Delivering", id: "delivering" },
    {
      kind: "steps",
      steps: [
        { do: "Deliver applies the change set to the graph. The confirmation says exactly what it will do." },
        { do: "Introductions become real objects, with the plan recorded as where they came from." },
        { do: "Retirements set lifecycle to “retired” and sever the system's relations — the node stays.", note: "The graph is meant to outlive the things in it: a system you retired last year is the answer to “what did we replace it with”." },
        { do: "A plan with changes that no longer fit the graph is refused rather than half-applied. Fix or remove them first." },
      ],
    },
    { kind: "heading", text: "Seeing a board in the future", id: "overlay" },
    { kind: "prose", text: "On any board, open the Graph panel, switch to Viewpoint, and use **State of the model**. Pick a change set or a plateau and the board shows what that plan does to it: retiring systems struck through, changed ones marked, and a count of planned objects not yet drawn — with a button to place them." },
    { kind: "shot", src: "board-to-be", alt: "A board viewed as of a change set, with a retiring system struck through", caption: "The same board, seen as of a plan. Nothing on it has changed — this is a tint, not an edit." },
    { kind: "heading", text: "Scrubbing through the roadmap", id: "scrubber" },
    { kind: "prose", text: "Under the canvas there is a timeline: today, then every named state in date order. Click a stop, step with the arrows, or press play and watch the board become its own future — systems fading as they retire, planned ones arriving, the counts changing as you go. Every state is fetched once and kept, so it moves as fast as you can drag." },
    { kind: "shot", src: "board-scrubber", alt: "A board with the time scrubber at the bottom, moved to a future state, showing two retired systems", caption: "The same landscape at the far end of the roadmap. An audience does not read a diff table; it watches which box goes grey." },
    { kind: "note", tone: "tip", text: "The scrubber uses your plateaus when you have them, because those are the states people named. Before anyone has named one it falls back to the change sets, so it is useful from the first plan." },

    { kind: "note", tone: "warning", title: "Planned cards are drawings, not systems", text: "A card you place from a plan is marked planned and stays outside the graph: drawing an intention must never create the system. It becomes an ordinary card the moment the change set is delivered." },
    { kind: "try", href: "/w/:slug/roadmap", label: "Open the roadmap" },
  ],
};

export const PLATEAUS: DocPage = {
  slug: "plateaus",
  title: "Plateaus: states you can name",
  summary: "Name the states people talk about, and get the difference between any two of them.",
  keywords: ["plateau", "target architecture", "transition", "baseline", "compare", "diff", "milestone", "togaf"],
  blocks: [
    { kind: "prose", text: "People do not talk about change sets. They talk about states: “after the platform migration”, “target architecture 2028”. A plateau is that state, as an object — a name, a date, and which change sets have landed by then." },
    { kind: "shot", src: "plateaus", alt: "The plateaus strip with as-is and two named states, each with counts and a health score", caption: "As-is, then the named states. Each one shows what the estate looks like and scores at that point." },
    { kind: "heading", text: "Building one", id: "building" },
    {
      kind: "steps",
      steps: [
        { do: "Press New plateau. Name it the way people say it out loud." },
        { do: "Add the change sets that have landed by then.", note: "Adding a plan pulls in whatever it waits for, and tells you how many it took." },
        { do: "Removing a plan is refused if something else in the plateau still needs it — the message names what." },
      ],
    },
    { kind: "note", tone: "why", title: "Why membership is explicit", text: "It would be easy to say “everything dated before this date”. But two plateaus can share a date, a plan can be deliberately excluded from one branch of a roadmap, and a membership you can see is one you can argue with in a meeting." },
    { kind: "heading", text: "Comparing", id: "comparing" },
    { kind: "prose", text: "This is the part worth having. “What changes between today and 2028” is the question a roadmap is actually asked, and nobody answers it by putting two pictures side by side. Pick a plateau, pick what to compare it with — today, or another plateau — and read the difference." },
    { kind: "shot", src: "plateaus-compare", alt: "Two future plateaus compared: what arrives, what goes, what changes, and the health delta", caption: "Two future states compared with each other. The health score moves with them." },
    {
      kind: "list",
      items: [
        "**Arrives** and **Goes** — objects that exist in one state and not the other.",
        "**Changes** — renames, retypes, and attributes that move, with both values.",
        "Connections made and severed.",
        "Estate health at each end, so a roadmap can claim a number rather than a shape.",
      ],
    },
    { kind: "note", tone: "tip", text: "The diff compares by object identity, not by name. Renaming a system reads as a change to it rather than as one thing dying and another being born — which matters the first time you rationalise a naming convention." },
    { kind: "try", href: "/w/:slug/roadmap/plateaus", label: "Open plateaus" },
  ],
};
