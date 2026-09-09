"use client";

import { useState, useTransition } from "react";
import { Bot, CornerDownLeft, MessageSquarePlus, RotateCcw } from "lucide-react";
import { askAboutSelection } from "@/lib/agent/board-actions";
import { scopeFromElements, type Answer } from "@/lib/agent/remarks";
import { useCanvasStore } from "./store";
import { useComments } from "./comments/CommentsContext";
import { asComment } from "./askExchange";
import { elementName } from "./document";
import type { ElementId } from "./document";

/**
 * Ask about what you have selected.
 *
 * The other two agents need somewhere to live — a page, or a spot on the board. This one needs
 * nothing: point at some objects and ask. Selection *is* scope, which is the fastest way there is
 * of saying "these ones", and it means the agent is available in the middle of any piece of work
 * without anybody setting one up first.
 *
 * The answer is prose from a model and is labelled as such. What makes it usable is the list of
 * what it read underneath — every citation checked against the object it names, and the unfindable
 * ones dropped before they are shown.
 *
 * Two things the first version got wrong (§5.53). The exchange was thrown away the moment the
 * selection changed, so a good answer could not be kept or shown to anybody; and each question
 * replaced the last, so a follow-up — which is what a second question nearly always is — started
 * from nothing.
 */

const SUGGESTIONS = [
  "What is missing here that I would need before a design review?",
  "Does anything here contradict anything else?",
  "What would break if this went away?",
];

interface Turn {
  question: string;
  answer: Answer;
}

export function AskBlock({ ids, label }: { ids: ElementId[]; label: string }) {
  const store = useCanvasStore();
  const comments = useComments();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setError(null);
    setKept(null);
    start(async () => {
      const state = store.getState();
      const result = await askAboutSelection({
        workspaceId: state.workspaceId,
        question: q,
        scope: scopeFromElements(ids, state.elements),
        // Only the prose goes back: the citations were checked against these same objects and
        // re-sending them would be telling the model what it already has in front of it.
        earlier: turns.map((t) => ({ question: t.question, answer: t.answer.answer })),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setTurns((all) => [...all, { question: q, answer: result }]);
      setQuestion("");
    });
  };

  /**
   * The exchange becomes a comment on the board (§5.50), which is the only way an agent's answer
   * ever becomes something a colleague can find. Remarks have had *keep as a note* since §5.27;
   * an answer had nothing, so a good one survived exactly as long as the selection did.
   */
  const keep = () => {
    if (!turns.length) return;
    const single = ids.length === 1 ? store.getState().elements[ids[0]!] : undefined;
    start(async () => {
      const err = await comments.say({
        body: asComment(turns),
        ...(single ? { elementId: single.id, anchorLabel: elementName(single) } : {}),
      });
      setKept(err ?? "Kept as a comment — open Comments to see it.");
    });
  };

  const last = turns[turns.length - 1];

  return (
    <section className="ask-block" data-ask-block>
      <header>
        <Bot size={13} /> Ask about {label}
        {turns.length > 0 && (
          <button type="button" className="ask-reset" title="Start again" onClick={() => { setTurns([]); setError(null); setKept(null); }}>
            <RotateCcw size={11} />
          </button>
        )}
      </header>

      {/* Scrolled here rather than in the panel, so the box you type the next question into stays
          next to the answer you are reading it against. */}
      <div className={turns.length ? "ask-exchange" : undefined} ref={(el) => el?.scrollTo({ top: el.scrollHeight })}>
      {turns.map((turn, i) => (
        <div key={i} className="ask-answer" data-ask-answer>
          <p className="ask-question">{turn.question}</p>
          <p>{turn.answer.answer || "It had nothing to say about that."}</p>
          {turn.answer.cites.length > 0 ? (
            <ul>
              {turn.answer.cites.map((c, j) => (
                <li key={j}>
                  <button type="button" onClick={() => store.getState().focusElement(c.about)} title="Show me">{c.label}</button>
                  <span>“{c.quote}”</span>
                </li>
              ))}
            </ul>
          ) : (
            // An uncited answer is not hidden — it is marked, so the reader knows to weigh it.
            <p className="ask-uncited">Nothing on the board was quoted for this, so take it as an opinion rather than a reading.</p>
          )}
          {turn.answer.rejected.length > 0 && (
            <p className="ask-uncited">{turn.answer.rejected.length} citation{turn.answer.rejected.length === 1 ? "" : "s"} could not be found on the objects named, and {turn.answer.rejected.length === 1 ? "was" : "were"} dropped.</p>
          )}
        </div>
      ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={last ? "Ask a follow-up" : "Ask anything about this"}
          aria-label={last ? "Ask a follow-up about the selection" : "Ask about the selection"}
          data-ask-input
        />
        <button type="submit" disabled={pending || !question.trim()} aria-label="Ask">
          {pending ? "…" : <CornerDownLeft size={13} />}
        </button>
      </form>

      {turns.length === 0 && !error && !pending && (
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}

      {error && <p className="ask-error">{error}</p>}

      {last && (
        <div className="ask-keep">
          <button type="button" onClick={keep} disabled={pending} data-ask-keep>
            <MessageSquarePlus size={12} /> Keep as a comment
          </button>
          {kept && <small>{kept}</small>}
        </div>
      )}
    </section>
  );
}
