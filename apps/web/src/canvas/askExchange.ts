import type { Answer } from "@/lib/agent/remarks";

/**
 * An exchange with the agent, written down as a comment (§5.53).
 *
 * The point of keeping an answer is not the prose — it is that somebody reading it in three months
 * can tell what was asked, what the machine said, and which words on which objects it was resting
 * on. So the comment carries all three, and says plainly that a model wrote the middle part. An
 * agent's answer pasted in as though a person had written it would be the worst possible outcome
 * of this feature.
 */

export interface Exchange {
  question: string;
  answer: Answer;
}

const MAX = 4000; // the comment body limit — see lib/comments/threads.ts

export function asComment(turns: Exchange[]): string {
  const lines: string[] = [];
  for (const turn of turns) {
    lines.push(`Q: ${turn.question}`);
    lines.push(turn.answer.answer || "(it had nothing to say about that)");
    for (const cite of turn.answer.cites) lines.push(`— ${cite.label}: “${cite.quote}”`);
    if (!turn.answer.cites.length) lines.push("— nothing on the board was quoted for this");
    lines.push("");
  }
  /*
   * Said once, at the end, rather than on every turn: the reader needs to know a model wrote this
   * before they act on it, and repeating it per answer would bury the answers themselves.
   */
  lines.push("Asked of the board agent; the prose is the model's and the quotes were checked against the objects named.");
  const body = lines.join("\n").trim();
  return body.length > MAX ? `${body.slice(0, MAX - 1)}…` : body;
}
