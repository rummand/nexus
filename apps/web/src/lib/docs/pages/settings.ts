import type { DocPage } from "../types";

export const MODELS: DocPage = {
  slug: "models",
  title: "What Nexus thinks with",
  summary: "Point the product at Claude, at GPT, or at a model on your own hardware — and at a different one for each job.",
  keywords: ["model", "provider", "api key", "anthropic", "claude", "openai", "gpt", "azure", "ollama", "vllm", "llama.cpp", "gateway", "litellm", "sovereign", "on-premise", "local", "settings", "token", "endpoint"],
  blocks: [
    { kind: "prose", text: "Four things in Nexus can use a model: **Compose** writes a board from a sentence, **Intake** reads a document for claims, the **graph agent** reviews the model, and **board agents** remark on what they watch. Everything else — drawing, the graph, viewpoints, the roadmap, health — works with no model at all. **Settings → Models** is where you say what those four talk to." },
    { kind: "shot", src: "models", alt: "The Models settings page with a provider card showing dialect, base URL, model id and a try-it button, the preset buttons below it, and the per-job assignment list", caption: "One card per provider, presets for the common ones, and — at the bottom — which model does which job." },

    { kind: "heading", text: "Adding one", id: "adding" },
    {
      kind: "steps",
      steps: [
        { do: "Pick the closest preset. It fills in the base URL and a sensible model id; nothing is written anywhere else.", note: "Anthropic, OpenAI, Azure OpenAI, Ollama, vLLM or llama.cpp, or any OpenAI-compatible gateway." },
        { do: "Correct the model id to whatever your endpoint actually answers to.", note: "claude-sonnet-4-5, gpt-4.1, llama3.3:70b — Nexus does not keep a list of model names, because that list is wrong within a month." },
        { do: "Add a key, if it is a hosted service. A model on your own hardware usually needs none." },
        { do: "Press **Try it**.", note: "It makes a real call with the real key. A reachable host and a key of the right shape answer a question nobody asked." },
      ],
    },
    { kind: "note", tone: "why", title: "Why there are only two kinds", text: "The choice on each card is *how to talk to it*, not who sells it: Anthropic's Messages API, or OpenAI's chat completions. Almost everything else in the world speaks the second one — Ollama, vLLM, llama.cpp, Azure, a national cloud's gateway — so modelling the dialect instead of the vendor makes a model you host yourself a first-class option rather than a special case." },

    { kind: "heading", text: "A model that never leaves your network", id: "sovereign" },
    { kind: "prose", text: "Pick **Ollama**, **vLLM or llama.cpp**, or **an OpenAI-compatible gateway**, set the base URL to your own host, and leave the key empty. Nexus sends no authorisation header when there is no key, and nothing leaves your network if the URL does not. This is the whole configuration — there is no separate “on-premise mode” to switch on, because the sovereign case is the same case." },
    { kind: "note", tone: "tip", text: "Small local models are worse at answering in a fixed shape. Nexus asks every one of them for a single named tool call and validates the answer before anything happens, so a bad answer is dropped rather than acted on — and a model that fences its JSON in a code block is still understood." },

    { kind: "heading", text: "Which model does which job", id: "jobs" },
    { kind: "prose", text: "The four jobs are genuinely different work. Reading a fifty-page transcript is not answering a question about two cards, and it is entirely reasonable to send one to a local model and keep the other on a frontier one. Each job can name a provider, and can override that provider's model id — so one endpoint can be used at two sizes." },
    {
      kind: "table",
      columns: ["The job", "What it is asked to do", "What it wants"],
      rows: [
        ["Compose", "Turn a sentence into a plan for a board", "Careful instruction-following; runs rarely"],
        ["Intake", "Read a long document and quote what it claims", "A large context window; runs on every document"],
        ["The graph agent", "Review the whole model and propose changes", "Judgement — this is the one to keep on the best model you have"],
        ["Board agents", "Remark on what they watch, answer a selection", "Speed, because this one is asked constantly"],
      ],
    },
    { kind: "prose", text: "Leave a job set to “whichever is first” and it uses the first enabled provider. That is the right setting until you have a reason for a different one." },

    { kind: "heading", text: "Where the choice comes from", id: "order" },
    {
      kind: "list",
      items: [
        "The provider set for **this job**, if there is one.",
        "Otherwise the **first enabled provider**.",
        "Otherwise the **environment** — `ANTHROPIC_API_KEY` and `NEXUS_MODEL` — so a deployment that has run on those for months does not lose its model because a settings page appeared.",
      ],
    },
    { kind: "prose", text: "When there is no usable model, nothing fails silently: each screen that would have used one says which of those three situations it is in and what to do about it." },

    { kind: "heading", text: "Keys", id: "keys" },
    { kind: "prose", text: "A key goes to the server and never comes back: no page and no action here returns one, and the card shows only that a key is stored. Keys are encrypted with AES-256-GCM under `NEXUS_SECRET_KEY`, an environment variable on the server." },
    { kind: "note", tone: "warning", title: "If NEXUS_SECRET_KEY is not set", text: "Keys are stored as they are, and the page says so in plain words at the top. Deriving a key from something already in the same database would be theatre — being told the truth is what lets you decide whether to fix it. Set it to a long random value and enter the keys again." },
    { kind: "note", tone: "tip", text: "Changing `NEXUS_SECRET_KEY` makes the stored keys unreadable. Nexus refuses to fall through to another provider when that happens — it tells you which key needs entering again, rather than quietly using something you did not choose." },

    { kind: "heading", text: "When it does not work", id: "trouble" },
    {
      kind: "table",
      columns: ["The card says", "What it means"],
      rows: [
        ["not tried", "Nobody has pressed Try it since the last change. Press it."],
        ["answering", "A real call came back. This is the only status worth trusting."],
        ["key refused", "The endpoint rejected the key — wrong key, wrong account, or no credit."],
        ["no answer", "Nothing at that address, or it did not reply. Check the base URL and whether the host is reachable from the server Nexus runs on, not from your laptop."],
      ],
    },
    { kind: "note", tone: "tip", text: "Replacing a key resets the status to “not tried”. Showing “answering” beside a key nobody has tried is a small lie that costs somebody an afternoon." },

    { kind: "try", href: "/w/:slug/settings/models", label: "Open model settings" },
  ],
};

export const CONNECTIONS: DocPage = {
  slug: "connections",
  title: "Letting something else ask",
  summary: "Nexus speaks MCP: another team's assistant can ask your model what depends on what — and suggest corrections a person still accepts.",
  keywords: ["mcp", "model context protocol", "api", "integration", "key", "token", "connect", "claude code", "assistant", "outside", "read-only", "propose", "endpoint", "bearer"],
  blocks: [
    { kind: "prose", text: "The model of your estate is the thing other people's agents most want to read. “What depends on Maximo?” “What is out of support next year?” “What does this organisation call an interface?” Nexus answers those over **MCP** — the protocol assistants and coding agents already speak — so somebody's tool can ask your architecture model directly instead of guessing." },
    { kind: "shot", src: "connections", alt: "The Connections settings page with a key issued, showing the once-only key panel, the key list and the MCP client configuration block", caption: "Issue a key, point a client at the endpoint. The key is shown once, because only a hash of it is stored." },

    { kind: "heading", text: "What it can and cannot do", id: "boundary" },
    {
      kind: "table",
      columns: ["Scope", "What it can do"],
      rows: [
        ["Read the model", "Search it, describe any object with its relations and provenance, follow what depends on what, read the vocabulary and the health score."],
        ["Read, and may propose", "All of that, and it may leave a suggestion in the review queue — where a person accepts or dismisses it exactly as they would one of your own agents'."],
      ],
    },
    { kind: "note", tone: "why", title: "There is no third scope", text: "No tool here changes the model. Not for a trusted client, not with a special flag. An outside suggestion goes through the same validator your own agent's goes through — it must quote the object it names, and an unquotable claim is discarded — and then it waits for a person. That is the whole boundary, and it is what makes handing out a key a small decision rather than a large one." },

    { kind: "heading", text: "Pointing a client at it", id: "connect" },
    {
      kind: "steps",
      steps: [
        { do: "Issue a key, and copy it.", note: "It is shown once. Nexus stores only a hash, so nothing — including that page — can print it back." },
        { do: "Add the endpoint to your client's MCP configuration.", note: "The page shows the exact block, with your instance's own address filled in." },
        { do: "Ask it to call list_kinds first.", note: "An agent that has read your vocabulary suggests things in your words rather than in its own." },
      ],
    },
    {
      kind: "list",
      items: [
        "**search_model** — the workspace's own query language: `kind:Application missing:owner`, `related:Maximo`, or plain words.",
        "**describe_object** — one object, its attributes, every relation with direction, the boards it is on, and where the record came from.",
        "**what_depends_on** — everything within N relations, with how far away each thing is.",
        "**list_kinds** — the vocabulary: kinds, attributes and relation types, with counts.",
        "**estate_health** — the score and each measure behind it.",
        "**propose_change** — with a propose key: one suggestion, quoted, into the review queue.",
      ],
    },

    { kind: "heading", text: "Keeping track", id: "keys" },
    { kind: "prose", text: "Each key shows when it was last used, which is what tells you months later whether it is still in anything's configuration. **Revoke** stops it being answered immediately; a revoked key can then be forgotten entirely." },
    { kind: "note", tone: "tip", text: "A key that may propose appears in **Agents** as an agent of its own, with a scope, a budget and an acceptance rate. What arrives from outside is measured exactly like what your own agents say — including whether anybody keeps it." },
    { kind: "heading", text: "The other direction", id: "outbound" },
    { kind: "prose", text: "Nexus can also **ask your systems**. If a CMDB, wiki or ticket tracker speaks MCP — increasingly they do — add it under *Servers Nexus can ask*, press **Ask what it can do**, and it lists the tools that server offers. Pick one, fill in what it needs, and read the answer." },
    { kind: "note", tone: "why", title: "Why the answer is not imported", text: "What a remote system returns is text, not truth. It becomes an **intake source** — read for claims, every claim quoted and checked against the words it came from, and reviewed by a person before any of it reaches the model. A one-click “sync” would be shorter and would quietly make somebody else's system an author of your architecture." },
    {
      kind: "steps",
      steps: [
        { do: "Add the server: a name, its MCP URL, and a key if it wants one." },
        { do: "Press Ask what it can do.", note: "Nexus shakes hands and lists its tools. If it cannot be reached, the message says which of the likely reasons it is." },
        { do: "Pick a tool, fill in its arguments, and ask." },
        { do: "Read what came back, then keep it as a source.", note: "Two steps on purpose: evidence somebody has looked at is worth more than evidence that arrived." },
      ],
    },
    { kind: "try", href: "/w/:slug/settings/connections", label: "Open connections" },
  ],
};
