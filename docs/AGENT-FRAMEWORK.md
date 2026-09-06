# The agent framework — a design note

**Status:** built, revs 65–69. Written 2026-09-06 in answer to "we need an agentic OS: a framework
of agents, described, alive, controlled, and able to build new agents with a human in the loop", and
kept here as the reasoning behind what now exists. What was decided differently in the building is
noted inline; the current behaviour is in `BRIEF.md` §5.31–§5.35.

Read `BRIEF.md` first. This note only covers what is not there yet.

---

## 0. The principle this is built on

We love agents. We are building for humans and for human insight.

Those are not in tension, but they do decide every argument below. An agent in Nexus exists to put a
better question in front of a person, faster than they could have asked it. It does not exist to
have opinions of its own about the estate, and it never gets to be the last word on one. Concretely:

- **Everything an agent produces is a proposal.** It is reviewable, it quotes its evidence, and it
  is one click from being refused for ever. This is already true of the graph agent (§5.26) and it
  is the rule the rest of the framework has to keep.
- **An agent that cannot say why is worse than no agent.** A blank field at least tells the truth.
- **The measure of an agent is whether people accept what it says.** Not tokens, not runs, not
  "tasks completed". If a person dismisses nine of an agent's ten suggestions, that agent is
  failing, and the product should say so out loud rather than keep producing.
- **The human stays the author of the model.** The graph is what an organisation believes about
  itself. An agent may draft; a person signs.

## 1. What we already have, and why it matters

It is worth being clear about this before shopping, because it is the part no framework provides.

| Piece | Where | What it gives us |
|---|---|---|
| Plan-then-validate | `lib/compose/validate.ts`, `lib/agent/validate.ts`, `lib/intake/validate-extraction.ts` | A model emits a plan in a closed language; a typed validator decides what executes. Prompt injection stops being interesting, because there is no verb for the dangerous thing. |
| Evidence discipline | intake and the graph agent | Every claim quotes its source, and the quote is *checked*. Unquotable claims are dropped and counted where the reviewer can see the count. |
| A review queue with memory | `agent_decisions`, `agent_proposals` | Accept / dismiss, decisions remembered, one current run per workspace. |
| Grounding | `packages/ea-knowledge` | Doctrine retrieved per task and cited, so an agent's vocabulary mistakes are correctable by argument rather than by prompt-fiddling. |
| A model of the estate | the graph | The thing agents are *for*. |

Everything in this note is scaffolding around that. If a framework asks us to move any of it inside
its own abstractions, that framework is the wrong choice.

## 2. What is actually missing

1. **Agents cannot be described.** Each one is a hand-written module. There is no way for a person
   to define an agent, or for us to list what agents exist.
2. **Agents are not alive.** They run when somebody clicks. There is no schedule, no trigger, no
   run history, no budget.
3. **Agents cannot be controlled as a fleet.** No owner, no kill switch, no per-agent acceptance
   rate, no audit of what changed because of which agent.
4. **Agents cannot reach anything.** No tool protocol, so no ServiceNow, no CMDB, no Entra.
5. **Models are an environment variable.** One provider, one key, set at deploy time.

## 3. The survey — what is worth taking, and what is not

### Take: LiteLLM (MIT, self-hostable) — the provider problem

A self-hosted proxy presenting one OpenAI-compatible endpoint in front of 140-plus providers,
including Anthropic, OpenAI, Azure, Bedrock, Vertex — **and** Ollama and vLLM, which is how a
sovereign deployment gets local models with no traffic leaving the organisation. It brings routing,
fallbacks, per-key budgets, rate limits and cost tracking, all of which we would otherwise write
badly ourselves.

The decisive argument is not features: it is that provider credentials stop living in the Nexus
process. Nexus holds a gateway URL and a gateway key; the gateway holds the provider secrets. That
is a much easier thing to defend to a security review, and it is the same seam an air-gapped
deployment needs.

### Take: MCP — the tool problem, in both directions

Model Context Protocol is now the default way an agent reaches a system, and every framework speaks
it. Two uses, and the second matters more than the first:

- **Outbound:** Nexus agents reach ServiceNow, Entra, a CMDB, a wiki through MCP servers, rather
  than us writing a bespoke connector per source. This is the cheapest possible answer to the
  catalogue's unbuilt half (§5.16).
- **Inbound:** *Nexus itself becomes an MCP server.* The estate model is the thing other people's
  agents most want to read — "what depends on Maximo", "what is out of support next year" — and we
  can expose that read-only, with writes offered only as proposals into the review queue. Somebody
  else's coding agent can then ask our graph a question and *suggest* a correction, and the
  suggestion lands in front of an architect exactly like ours do. That is Nexus becoming
  infrastructure without giving up the boundary.

### Take, later: A2A's Agent Card — the description problem

A2A reached 1.0 in April 2026 under the Linux Foundation, with signed Agent Cards describing what
an agent can do and how to invoke it, and native support across LangGraph, CrewAI, AutoGen and the
major clouds. We should **adopt the Agent Card as our description format now** — it is a JSON
document, it costs nothing, and it means our agents are describable in a vocabulary the rest of the
industry already reads. We should **not** adopt the distributed A2A runtime until we actually have
agents crossing a trust boundary, which we do not.

### Probably not: LangGraph, CrewAI, AutoGen/AG2 as the core

LangGraph is the strongest of these for our shape of problem — a directed graph with conditional
edges, checkpointing, time travel, and human-in-the-loop interrupts, and it overtook CrewAI on
adoption during 2026 precisely because that maps to audit trails and rollback points. CrewAI is
faster to stand up role-based crews; AutoGen suits conversational multi-agent patterns we do not
have.

But all three want to own the control flow, and our control flow is not the interesting part. Our
agents are: read some scoped slice of the graph, call a model once or twice, emit proposals through
a validator, stop. That is a hundred lines, and a graph runtime around it buys nothing while adding
a dependency that would sit between us and the boundary we care about.

Revisit LangGraph the day one agent genuinely needs cycles, sub-agents and mid-run interrupts —
for example a research agent that reads the corpus, drafts a meta-model, checks it against the
graph, and revises. Adopt it *inside* one agent, never as the frame around all of them.

### Not yet: Temporal

Temporal is the right answer to durable execution when a run lasts hours, spans processes, and must
survive a deploy — an intake pipeline over ten thousand CIs, say. Human approval is a signal the
workflow blocks on, which is exactly our review queue's shape. The usual production pattern is
Temporal outside, agent logic inside. It is real, and it is premature: our longest run is seconds.
Write agents so their state is in Postgres rather than in a variable, and adopting Temporal later
stays cheap.

### Read, don't adopt: OpenClaw

The most-starred self-hosted agent framework on GitHub (MIT, ~380k stars by mid-2026), model-
agnostic, local-first, memory in plain Markdown. It is worth reading for its persistence and
gateway design. It is a personal always-on assistant, not a governed enterprise review loop, and
its trust model is not ours.

## 4. The proposal

### 4.1 An agent is an object in the graph

Not a config file. An `Agent` is a kind in the meta-model, with attributes, and with relations to
the things it reads and the things it may touch.

This is the Nexus-native answer, and it earns its keep three times over: an EA tool for an AI-native
organisation *should* have the organisation's agents in its model; the canvas, lenses, health and
change sets all work on it for free; and "which agents can see customer data" becomes a graph query
rather than a spreadsheet.

An agent definition is roughly:

```
name            Vocabulary reviewer
owner           <relation to a Team or Person — never null>
purpose         One sentence a person can judge the agent against.
scope           A graph query: what it may read. Never "everything" by default.
verbs           Which proposal actions it may emit, from the closed list.
grounding       Which knowledge-base scope it is given.
model           Which configured provider/model it uses.
trigger         manual | schedule | on-change
budget          runs per day, tokens per run, spend per month
status          draft | active | paused | retired
```

Everything in that list exists so a person can answer "what is this thing allowed to do" without
reading code.

### 4.2 Alive: a runtime, deliberately dull

A row per run (`agent_runs`): agent, trigger, started, finished, tokens, cost, what it proposed,
what was rejected in validation, what a human then accepted or dismissed. A scheduler that fires
triggers. That is the whole runtime. No new dependency.

The interesting part is the last column: **acceptance rate is a first-class metric.** An agent whose
proposals are dismissed nine times in ten appears at the top of the agent list with that number next
to it, because that is a broken agent and the product should say so rather than keep costing money.

### 4.3 Controlled: the fleet view

A page listing every agent with owner, scope, last run, spend this month, acceptance rate, and a
pause switch. An activity feed of what changed because of an agent, filterable to one agent. Nothing
an agent did should be untraceable to the run that proposed it and the person who accepted it — the
graph already records `source`, and it should record the run.

### 4.4 Agents building agents — the same trick, one level up

This is the request that needs the most care, and the pattern we already have answers it.

An agent proposing a new agent is **just another proposal**, in a closed language, validated, queued
and signed by a human:

1. An agent emits an `Agent` definition, in the schema above, with a reason and a quote from the
   graph justifying why the estate needs it ("forty-one Interfaces have no owner and no rule covers
   them").
2. The validator checks the definition the way `lib/agent/validate.ts` checks a proposal: the scope
   query must parse and must return something; the verbs must be a subset of the parent's verbs;
   the budget must be within the parent's remaining budget; the owner must be a real team.
3. **Capability monotonicity** is the rule that makes this safe: *no agent may create an agent that
   can do something it cannot do itself.* Without it, "agents building agents" is a privilege
   escalation with a friendly name.
4. A human approves it. The new agent starts in `draft`, does one dry run, and shows what it *would*
   have proposed before it is allowed to propose anything for real.
5. Definitions are versioned and roll back, and every version records who approved it.

The dry run is the part that keeps this humane. A person should be able to see an agent's first
opinions before granting it a voice, exactly as they would with a new colleague.

### 4.5 Providers as an admin setting — including sovereign ones

A Settings → Models screen, per workspace, replacing `ANTHROPIC_API_KEY` / `NEXUS_MODEL`:

- Connections to Anthropic, OpenAI, Azure OpenAI, Bedrock, Vertex, or **any OpenAI-compatible
  endpoint** — which covers a self-hosted LiteLLM gateway, Ollama, vLLM, and an in-country
  government cloud.
- A default model per task (compose, intake extraction, the graph agent, each custom agent), because
  these have genuinely different cost and quality needs.
- A per-provider health check that says plainly whether it can be reached, what it costs and what
  the last error was — the same honesty the Compose panel already shows.
- Secrets encrypted at rest, never returned to the browser, redacted in logs.

**One thing we must not build, and should say so plainly.** "Sign in with your Claude or ChatGPT
subscription and let Nexus use it" is not available to us. Anthropic's consumer terms restrict
Pro/Max OAuth credentials to Claude Code and claude.ai; since early 2026 those tokens are rejected
elsewhere with an explicit error, and accounts have been restricted over it. OpenAI's position on
subscription credentials in third-party products is similarly narrow. The legitimate routes are an
API key, an enterprise/commercial agreement, or a self-hosted model — and a sovereign deployment
wants the third one anyway. *Sign in with Google/Microsoft for **identity*** is a different thing
and is fine; it belongs with authentication, not here.

## 5. Order of work — and what happened

1. ✅ **Providers as a setting** (§4.5) — rev 65, brief §5.31. Two dialects rather than a vendor
   list, which is what made a self-hosted endpoint an ordinary choice; a model per job; keys
   encrypted, or stored plainly and *said so*.
2. ✅ **Agent as an object, and the run log** (§4.1–4.2) — rev 66, brief §5.32. The graph agent is
   now the workspace's own **Model reviewer**, an ordinary definition. Two things were added in the
   building: a **draft is a dry run**, so an agent's first opinions are read before it is given a
   voice; and refused runs are logged, because an agent quietly stopped by its budget is the fact
   somebody most needs.
3. ✅ **Nexus as an MCP server** — rev 67, brief §5.33. Six reading tools plus `propose_change`. The
   test suite asserts the tool list, so "nothing here writes" stays true rather than remaining true
   by habit.
4. ✅ **The fleet view and acceptance rate** (§4.3) — rev 62 (board agents) and rev 66, brief §5.28
   and §5.32. Acceptance is attributed per agent by copying the agent's name onto the decision
   before the proposal is deleted.
5. ✅ **MCP outbound** — rev 69, brief §5.35. The "first real source connector" turned out to be
   *any* MCP server, which is a better answer than a bespoke ServiceNow client. What a remote server
   returns becomes an intake source and nothing more.
6. ✅ **Agents proposing agents** (§4.4) — rev 68, brief §5.34. Capability monotonicity is enforced
   by the same function a person's form goes through, and a proposed agent cannot run at all until
   somebody approves it.

**Still open, and deliberately:** triggers and schedules (an agent runs when asked), spend in money
rather than in runs, and Temporal-style durable execution — all of which the note argues are
premature until a run lasts longer than a few seconds.

## 6. Open questions for the product owner

- Is the first sovereign target a self-hosted gateway in the organisation's own cloud, or genuinely
  air-gapped with local weights? The second is achievable and changes what "good" means for model
  quality.
- Should an agent be able to run against *someone else's* workspace — a central EA team's agent
  reviewing a business unit's model? That is a permissions question we have not had to answer yet.
- Who is allowed to approve a new agent? Any editor, or a named role? (This is the first thing in
  Nexus that really needs roles.)
- Do we want agents to be able to open change sets — to propose a *plan* rather than a *correction*?
  It is the natural next verb, and it is a much bigger claim than "this object has the wrong kind".

## Sources

- [Best open-source agent frameworks, 2026 — Firecrawl](https://www.firecrawl.dev/blog/best-open-source-agent-frameworks)
- [The best AI agent frameworks in 2026 — LangChain](https://www.langchain.com/resources/ai-agent-frameworks)
- [LangGraph vs Temporal — LangChain](https://www.langchain.com/resources/langgraph-vs-temporal)
- [A2A surpasses 150 organizations — Linux Foundation](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- [A survey of agent interoperability protocols (MCP, ACP, A2A, ANP)](https://arxiv.org/html/2505.02279v1)
- [The state of agentic AI standards in 2026](https://dev.to/alexmercedcoder/the-state-of-agentic-ai-standards-in-2026-mcp-a2a-webmcp-osi-and-the-protocol-stack-taking-3o2l)
- [What is LiteLLM — open-source LLM gateway for 140+ providers](https://a2a-mcp.org/blog/what-is-litellm)
- [LiteLLM as an MCP gateway: sovereign AI data residency](https://stribog.com/blog/litellm-self-hosted-mcp-model-gateway-ai-data-residency)
- [OpenAI-compatible LLM APIs 2026: Ollama, vLLM & LiteLLM](https://vucense.com/dev-corner/openai-compatible-llm-apis-2026/)
- [Claude Code authentication — OAuth tokens vs API keys](https://code.claude.com/docs/en/authentication)
- [Why we don't offer Claude Pro/Max subscription auth in a third-party agent](https://openclawlaunch.com/guides/hermes-claude-subscription)
- [Human-in-the-loop AI agents: 2026 control guide](https://allainews.net/human-in-the-loop-ai-agents/)
- [Self-evolving agents: a developer's guide](https://dev.to/chen115y/self-evolving-agents-a-developers-guide-40e7)
- [What is OpenClaw — Milvus](https://milvus.io/blog/openclaw-formerly-clawdbot-moltbot-explained-a-complete-guide-to-the-autonomous-ai-agent.md)
