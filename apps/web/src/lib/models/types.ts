/**
 * Where the thinking happens.
 *
 * Until now a model was two environment variables, which meant one provider, chosen at deploy time,
 * for everything. That is wrong in three directions at once: an organisation that wants Claude for
 * one job and a local model for another cannot have it; a sovereign deployment cannot point Nexus
 * at its own gateway without a redeploy; and nobody can tell from inside the product what it is
 * talking to.
 *
 * So a provider is a row, a task chooses one, and the environment remains a fallback so that
 * nothing that worked yesterday stops working today.
 */

/**
 * How to talk to it, not who sells it.
 *
 * There are only two request shapes in the world that matter here — Anthropic's Messages API and
 * OpenAI's chat completions — and everything else speaks one of them. Ollama, vLLM, llama.cpp,
 * Azure, Together, a government cloud's gateway: all OpenAI-compatible. Modelling the *dialect*
 * rather than the vendor is what makes a sovereign endpoint a first-class option instead of a
 * special case.
 */
export type Dialect = "anthropic" | "openai";

export interface Provider {
  id: string;
  workspaceId: string;
  /** What a person calls it: "Anthropic", "Our gateway", "Ollama on the OT network". */
  name: string;
  dialect: Dialect;
  /** The API root. Empty means the dialect's public default. */
  baseUrl: string;
  /** The model id to use, e.g. claude-sonnet-4-5 or llama3.3:70b. */
  model: string;
  /** Set when a key is stored. The key itself never leaves the server. */
  hasKey: boolean;
  /** False when the key is stored without encryption because no NEXUS_SECRET_KEY is set. */
  keyEncrypted: boolean;
  enabled: boolean;
  /** What a probe last found. */
  status: "unknown" | "ok" | "unauthorised" | "unreachable";
  statusDetail: string;
  checkedAt: string | null;
  createdAt: string;
}

/**
 * The jobs a model does here.
 *
 * Separate because they are genuinely different work with different costs: reading a fifty-page
 * transcript is not the same job as answering a question about two cards, and an organisation
 * should be able to send the cheap, frequent one to a local model and keep the careful one on a
 * frontier model.
 */
export const TASKS = ["compose", "intake", "graph agent", "board agent"] as const;
export type Task = (typeof TASKS)[number];

export const TASK_LABEL: Record<Task, string> = {
  compose: "Compose — writing a board in English",
  intake: "Intake — reading a document for claims",
  "graph agent": "The graph agent — reviewing the model",
  "board agent": "Board agents — remarks and asking about a selection",
};

/** A resolved answer to "what do I call for this job". */
export interface ModelChoice {
  dialect: Dialect;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Where the choice came from, so the UI can say so. */
  from: "provider" | "environment";
  providerName: string;
}

export const DEFAULT_BASE: Record<Dialect, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
};

/** Ready-made starting points, so nobody has to remember a base URL. */
export const PRESETS: Array<{ id: string; name: string; dialect: Dialect; baseUrl: string; model: string; note: string; needsKey: boolean }> = [
  { id: "anthropic", name: "Anthropic", dialect: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5", note: "Claude, by API key.", needsKey: true },
  { id: "openai", name: "OpenAI", dialect: "openai", baseUrl: "https://api.openai.com", model: "gpt-4.1", note: "GPT and o-series, by API key.", needsKey: true },
  { id: "azure", name: "Azure OpenAI", dialect: "openai", baseUrl: "", model: "", note: "Your own deployment. Put the full endpoint in the base URL.", needsKey: true },
  { id: "ollama", name: "Ollama", dialect: "openai", baseUrl: "http://localhost:11434/v1", model: "llama3.3", note: "A model on this machine. No key, no traffic leaving.", needsKey: false },
  { id: "vllm", name: "vLLM or llama.cpp", dialect: "openai", baseUrl: "http://localhost:8000/v1", model: "", note: "A model your organisation hosts.", needsKey: false },
  { id: "gateway", name: "An OpenAI-compatible gateway", dialect: "openai", baseUrl: "", model: "", note: "LiteLLM, a government cloud, anything that speaks the same API.", needsKey: false },
];
