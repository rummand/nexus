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
