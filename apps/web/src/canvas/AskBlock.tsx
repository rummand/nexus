"use client";

import { useState, useTransition } from "react";
import { Bot, CornerDownLeft } from "lucide-react";
import { askAboutSelection } from "@/lib/agent/board-actions";
import { scopeFromElements, type Answer } from "@/lib/agent/remarks";
import { useCanvasStore } from "./store";
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
 */

const SUGGESTIONS = [
  "What is missing here that I would need before a design review?",
  "Does anything here contradict anything else?",
  "What would break if this went away?",
];

export function AskBlock({ ids, label }: { ids: ElementId[]; label: string }) {
  const store = useCanvasStore();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setError(null);
    setAnswer(null);
    setQuestion(q);
    start(async () => {
      const result = await askAboutSelection({ question: q, scope: scopeFromElements(ids, store.getState().elements) });
      if ("error" in result) setError(result.error);
      else setAnswer(result);
    });
  };

  return (
    <section className="ask-block" data-ask-block>
      <header><Bot size={13} /> Ask about {label}</header>
      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this"
          aria-label="Ask about the selection"
          data-ask-input
        />
        <button type="submit" disabled={pending || !question.trim()} aria-label="Ask">
          {pending ? "…" : <CornerDownLeft size={13} />}
        </button>
      </form>

      {!answer && !error && !pending && (
        <div className="ask-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}

      {error && <p className="ask-error">{error}</p>}

      {answer && (
        <div className="ask-answer" data-ask-answer>
          <p>{answer.answer || "It had nothing to say about that."}</p>
          {answer.cites.length > 0 ? (
            <ul>
              {answer.cites.map((c, i) => (
                <li key={i}>
                  <button type="button" onClick={() => store.getState().focusElement(c.about)} title="Show me">{c.label}</button>
                  <span>“{c.quote}”</span>
                </li>
              ))}
            </ul>
          ) : (
            // An uncited answer is not hidden — it is marked, so the reader knows to weigh it.
            <p className="ask-uncited">Nothing on the board was quoted for this, so take it as an opinion rather than a reading.</p>
          )}
          {answer.rejected.length > 0 && (
            <p className="ask-uncited">{answer.rejected.length} citation{answer.rejected.length === 1 ? "" : "s"} could not be found on the objects named, and {answer.rejected.length === 1 ? "was" : "were"} dropped.</p>
          )}
        </div>
      )}
    </section>
  );
}
