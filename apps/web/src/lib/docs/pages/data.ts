import type { DocPage } from "../types";

export const INTAKE: DocPage = {
  slug: "intake",
  title: "Intake: documents into model",
  summary: "Feed a meeting transcript or a document in, review what it found, and commit what you agree with.",
  keywords: ["intake", "transcript", "meeting", "extract", "pipeline", "evidence", "commit", "teams", "minutes"],
  blocks: [
    { kind: "prose", text: "Most of what an organisation knows about its systems is in conversations. Intake takes a source — a Teams transcript, minutes, a document — and proposes what it says about the estate, with the sentence behind every claim." },
    { kind: "heading", text: "Adding a source", id: "adding" },
    { kind: "shot", src: "intake-new", alt: "The new source dialog with a pasted transcript", caption: "Paste a transcript or a document. There is a sample meeting if you want to see the shape of it first." },
    {
      kind: "steps",
      steps: [
        { do: "Open Intake and press New source." },
        { do: "Paste the text, or use the sample meeting.", note: "Teams and VTT transcript formats are recognised; so is plain text with “Name: said this” lines." },
        { do: "Give it a name that will mean something in six months — the source becomes an object in the graph, and everything it produces points back at it." },
      ],
    },
    { kind: "heading", text: "Running the pipeline", id: "pipeline" },
    { kind: "prose", text: "Running a source takes it through seven stages, each of which reports what it did. The pipeline is drawn rather than hidden, because an extraction you cannot inspect is an extraction you cannot correct." },
    { kind: "shot", src: "intake-run", alt: "The intake pipeline drawn stage by stage with counts", caption: "Seven stages, each with its own count. If a stage found nothing, it says so rather than passing an empty result along." },
    { kind: "heading", text: "Reviewing what it found", id: "review" },
    { kind: "shot", src: "intake-review", alt: "Extracted candidate objects, each with the sentence that produced it", caption: "Every proposed object carries the sentence it came from. Untick anything you disagree with." },
    {
      kind: "list",
      items: [
        "**Objects** — systems, capabilities, data objects and the people mentioned.",
        "**Connections** — relations the text implies, each with the sentence that implies it.",
        "**Viewpoints** — decisions, actions, risks, questions and needs somebody expressed, kept as records in their own right.",
        "**Passages** — the source itself, segmented, so you can read what was actually said.",
      ],
    },
    { kind: "note", tone: "why", title: "Why viewpoints are objects too", text: "“We are moving off Maximo next year” is not a fact about Maximo, it is something a person said on a date. Recording it as a viewpoint — with who said it and where — means the model can hold disagreement, and an owner proposed from it can show its working." },
    { kind: "heading", text: "Committing", id: "commit" },
    {
      kind: "steps",
      steps: [
        { do: "Untick anything wrong. The default is everything the run is confident about." },
        { do: "Press Commit. The objects join the graph, the meeting becomes a node, and every object it mentioned is linked to it with the quote." },
        { do: "Look at the Landscape tab to see what intake has brought in, as a graph." },
      ],
    },
    { kind: "shot", src: "intake-viewpoints", alt: "Extracted viewpoints: decisions, risks, actions and questions with their speakers", caption: "Viewpoints keep who said what. This is where an evidence-backed ownership proposal comes from later." },
    { kind: "note", tone: "tip", title: "With a model configured", text: "Where an API key is set, a model does the reading and the rules become the fallback. It is held to the same standard either way: every claim must quote the source verbatim, and a quote that is not in the text is rejected before you ever see it. The run says which engine read it and how many claims were refused." },
    { kind: "try", href: "/w/:slug/intake", label: "Open intake" },
  ],
};

export const CATALOGUE: DocPage = {
  slug: "catalogue",
  title: "The source catalogue",
  summary: "What Nexus could read on your estate, what the agent has found, and granting it access module by module.",
  keywords: ["connectors", "catalogue", "sources", "grant", "scope", "discovery", "scan", "sap", "servicenow"],
  blocks: [
    { kind: "prose", text: "The catalogue is a library rather than a settings page: browse the systems Nexus knows how to read, see which of them the agent has found signs of on your estate, and grant access to the parts you are willing to share." },
    { kind: "shot", src: "intake-catalogue", alt: "The source catalogue with providers, discovered systems and granted scopes", caption: "Providers by category, with what the agent found on this estate at the top." },
    { kind: "heading", text: "Discovery", id: "discovery" },
    { kind: "prose", text: "The estate scan reads what is already in the workspace — hostnames in descriptions, vendor names on cards, systems mentioned in transcripts — and matches them against the catalogue. Each finding is a request, not a connection: it says what it wants, why, and the evidence it is going on. Nothing has been read." },
    { kind: "heading", text: "Granting", id: "granting" },
    {
      kind: "steps",
      steps: [
        { do: "Open a provider. Its modules are a tree — SAP PM, and under it the object types like EQUI." },
        { do: "Tick only what you are willing to share. Each box says what Nexus would get and what it would do with it." },
        { do: "Grant. The scope is recorded, and can be revoked at any time." },
      ],
    },
    { kind: "note", tone: "warning", title: "What this does today", text: "Granting records the decision and the scope; it does not yet move data. The connectors themselves are the next piece of work. The catalogue exists first because deciding *what an agent may read* is a conversation worth having before anything is plugged in, not after." },
    { kind: "heading", text: "Systems the catalogue does not know", id: "unknown" },
    { kind: "prose", text: "The scan lists what it saw but could not identify. Registering one adds it to this workspace's catalogue, so the next scan recognises it — the library grows to fit the estate rather than the other way round." },
    { kind: "try", href: "/w/:slug/intake?view=catalog", label: "Open the catalogue" },
  ],
};

export const KNOWLEDGE: DocPage = {
  slug: "knowledge-base",
  title: "The EA knowledge base",
  summary: "A corpus of openly-licensed architecture writing, searchable with citations, and the doctrine the agents are taught from.",
  keywords: ["knowledge", "corpus", "rag", "retrieval", "citations", "doctrine", "togaf", "licence", "sources"],
  blocks: [
    { kind: "prose", text: "Nexus asks agents to do enterprise architecture. This is where the architecture knowledge lives: a curated corpus of openly-licensed writing, searchable without a model, and a set of short rules the agents are grounded in." },
    { kind: "shot", src: "knowledge", alt: "The knowledge base search results, each passage with its source and licence", caption: "Search answers with passages, never with prose of its own. Every one carries its source, section, licence and link." },
    { kind: "heading", text: "Searching it", id: "search" },
    {
      kind: "list",
      items: [
        "Retrieval is lexical, so it works with no model API key at all and every hit can say which of your words matched.",
        "A term the corpus has never seen is reported as such rather than approximated by the nearest article.",
        "British and American spellings are read as the same word.",
      ],
    },
    { kind: "heading", text: "Doctrine", id: "doctrine" },
    { kind: "prose", text: "Three paragraphs of encyclopedia in a prompt mostly add tokens. What changes an agent's behaviour is a short rule applied while it decides — “a capability is what the organisation does, not the team that does it”. The Doctrine tab lists those rules, grouped by which agent they are given to, and every one quotes a passage that is really in the corpus. A test fails if it is not." },
    { kind: "shot", src: "knowledge-doctrine", alt: "The doctrine tab: rules grouped by agent, each quoting the corpus", caption: "Each rule shows the passage it came from, so you can disagree with the source rather than with the machine." },
    { kind: "heading", text: "What is in it, and what is not", id: "licences" },
    { kind: "prose", text: "The corpus ships inside the product, which is redistribution — so the test is not “can I read it” but “may I ship it”. The Sources tab lists everything in it with its licence, and, separately, the works that belong on any reading list and are not ours to redistribute: TOGAF, ArchiMate, the BIZBOK, the textbooks. Those are cited and linked, never copied." },
    { kind: "shot", src: "knowledge-sources", alt: "The sources tab listing licences, the corpus and the works that cannot be redistributed", caption: "Every source, with its licence and a sentence saying why it is in the corpus." },
    { kind: "try", href: "/w/:slug/knowledge", label: "Search the knowledge base" },
  ],
};

export const LANDING: DocPage = {
  slug: "landing-zone",
  title: "The landing zone",
  summary: "Upload the exports you actually have, work on them where you can see them, and take only what you agree with — reversibly.",
  keywords: ["import", "landing zone", "servicenow", "spreadsheet", "excel", "sharepoint", "csv", "batch", "staging", "approve", "rollback", "apm", "portfolio", "provenance", "conflict", "match"],
  blocks: [
    { kind: "prose", text: "What you have is a ServiceNow export, an old spreadsheet, a SharePoint list and a Word document from a governance review. What most tools offer is a CSV template. The landing zone takes the files you have, folds them into one object per thing, matches them against the model you already have, and shows you exactly what would change — before anything does." },
    { kind: "shot", src: "apm-review", alt: "A staged batch of four files with each column's meaning shown and editable, and the objects listed below", caption: "Four files, one review. Every column's meaning is proposed with a reason and can be changed; nothing is in the model yet." },
    { kind: "heading", text: "What it can read", id: "formats" },
    {
      kind: "table",
      columns: ["Format", "Notes"],
      rows: [
        ["CSV, TSV", "Quoted fields, commas and newlines inside them, CRLF, UTF-16 and byte-order marks — the things a decade-old export actually contains."],
        ["JSON", "A list of records, including ServiceNow's `{ result: [...] }` wrapper. A reference field's readable half is taken."],
        ["Excel (.xlsx)", "The first worksheet, with shared and inline strings. It says which sheet it read when there are several."],
        ["Word (.docx)", "Kept as prose rather than columns — a document is read for claims by intake, not squeezed into a table."],
        ["Markdown, plain text", "The same: prose."],
      ],
    },
    { kind: "heading", text: "One object, several files", id: "folding" },
    { kind: "prose", text: "The same application in a ServiceNow export and a SharePoint list is one thing arriving twice, and discovering that here rather than in the model is the point. Rows are folded on the source's own key where there is one and on the name otherwise — and two rows that both carry keys are never folded, however alike their names, because that is what a key is for." },
    { kind: "note", tone: "why", title: "Provenance per field, not per record", text: "ServiceNow says the owner is Asset Management; the spreadsheet says Grid Ops. Both are kept, against the file and column they came from, and the winner is decided by the order the files are in. Storing only the winner is how an estate model becomes an argument nobody can settle — the losing value is exactly what you need when somebody asks where a number came from." },
    { kind: "heading", text: "What it will not decide for you", id: "questions" },
    {
      kind: "table",
      columns: ["It finds", "It does"],
      rows: [
        ["A row with no name", "Holds it. There is nothing to call the object."],
        ["The same key on two rows of one file", "Holds both. A source's own identifier cannot mean two things."],
        ["A name close to one you have", "Asks. “PI-Historian (prod)” may or may not be “PI Historian”, and guessing wrong is the merge nobody can undo."],
        ["Two files that disagree", "Takes the more trusted one and shows you the other."],
        ["A column that names people", "Leaves it out until you tick the box. An old spreadsheet carries people."],
        ["A connection to something nobody has", "Flags it. That relation would go nowhere."],
        ["Something the export used to list and no longer does", "Tells you. Retired, out of scope, or a filtered export — only you know, and nothing is deleted for you."],
      ],
    },
    { kind: "heading", text: "Seeing it before taking it", id: "board" },
    { kind: "prose", text: "**Draw it on a board** lays the whole batch out by what would happen to each object: new, changed, unchanged, held, rejected. Four hundred rows in a list is a thing you scroll past; the same four hundred on a canvas is a thing whose shape you can see. Every card is marked planned, so drawing it creates nothing." },
    { kind: "shot", src: "apm-board", alt: "The staged batch drawn on a board in lanes for new, changed and held, with hatched planned cards", caption: "The batch as a board. Hatched cards are claims — walk around it, annotate it, put an agent beside it." },
    { kind: "heading", text: "Approving, and putting it back", id: "approve" },
    {
      kind: "steps",
      steps: [
        { do: "Work through **Needs you**. Accept, hold or reject each row; a held row is never written.", note: "You can accept the 300 clean rows and keep arguing about the 40 — approving takes whatever is accepted at that moment." },
        { do: "Approve. New objects are created, matched ones updated, and relations drawn between things that exist." },
        { do: "Every object it creates records the batch it came from, so “where did this come from” is a query rather than somebody's memory." },
        { do: "**Roll it back** if it was wrong." },
      ],
    },
    { kind: "note", tone: "why", title: "What an honest rollback will not do", text: "It reverts what it wrote and only what it wrote. An object it created is deleted only if nobody has connected anything to it or drawn it on a board since; a field is restored only if it still holds the value the batch put there. Everything it declines to touch is counted and named, because a rollback that quietly leaves half the estate changed is worse than one that admits it cannot finish." },
    { kind: "note", tone: "tip", text: "Re-importing next month's export is an update, not a copy, wherever a source key column was mapped: the key is stored on the object the first time and matched on afterwards, even if the system has been renamed since." },
    { kind: "try", href: "/w/:slug/apm", label: "Open the landing zone" },
  ],
};
