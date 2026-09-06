/**
 * Tokenisation for the lexical index.
 *
 * No dependencies and no embeddings: the corpus has to be searchable in an environment with no
 * model API key at all, otherwise the "standalone module" claim is false. Where a key exists the
 * retriever reranks on top of this (see `retrieve.ts`); it never replaces it.
 */

/**
 * Words carrying no signal in an EA corpus. The list is deliberately short: aggressive stopping
 * hurts phrase queries ("as is" and "to be" are architecture terms, not noise), so anything a
 * practitioner might actually type stays in.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "of", "in", "on", "at", "by", "for", "with", "from", "into", "about", "over", "under",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "it", "its", "they", "them", "their", "he", "she", "his", "her", "we", "our", "you", "your",
  "i", "me", "my", "which", "who", "whom", "whose", "what", "when", "where", "how", "why",
  "can", "could", "may", "might", "must", "shall", "should", "will", "would",
  "have", "has", "had", "having", "do", "does", "did", "doing",
  "not", "no", "nor", "so", "such", "as", "also", "more", "most", "other", "some", "any", "all",
  "there", "here", "one", "two", "up", "out", "down", "off", "again", "further", "once",
  // Query connectives: people type them to relate two terms, and they carry no topic themselves.
  "versus", "vs", "between", "difference", "compared",
]);

/** Terms whose plural-looking ending is part of the word. Stripping it changes the meaning. */
const NO_STEM = new Set(["as", "is", "its", "business", "process", "access", "class", "analysis", "basis", "status", "bus", "gas", "less", "series", "species", "ops", "devops", "aws"]);

/**
 * Words that end in -ise but are not the British spelling of an -ize word.
 *
 * Turning "advise" into "advize" would be harmless — both query and document go through the same
 * function — but "practise"/"practice" and "precise" are ordinary words a reader would be baffled
 * to see mangled in the "matched" list, and that list is part of the explanation.
 */
const NOT_BRITISH_ISE = new Set([
  "advise", "arise", "chastise", "comprise", "compromise", "concise", "demise", "devise", "disguise",
  "excise", "exercise", "expertise", "franchise", "guise", "improvise", "incise", "merchandise",
  "noise", "otherwise", "paradise", "poise", "praise", "precise", "premise", "promise", "raise",
  "revise", "rise", "supervise", "surmise", "surprise", "televise", "treatise", "wise",
]);

/** British spellings whose American form the corpus actually uses. */
const SPELLING: Array<[RegExp, string]> = [
  [/isation$/, "ization"],
  [/isations$/, "izations"],
  [/yse$/, "yze"],
  [/ysed$/, "yzed"],
  [/ysing$/, "yzing"],
  [/centre$/, "center"],
  [/metre$/, "meter"],
  [/licence$/, "license"],
  [/defence$/, "defense"],
  [/offence$/, "offense"],
  [/programme$/, "program"],
  [/catalogue$/, "catalog"],
  [/dialogue$/, "dialog"],
  [/behaviour/, "behavior"],
  [/colour/, "color"],
  [/favour/, "favor"],
  [/labour/, "labor"],
  [/neighbour/, "neighbor"],
  [/honour/, "honor"],
  [/modelling/, "modeling"],
  [/modelled/, "modeled"],
  [/labelled/, "labeled"],
  [/travelling/, "traveling"],
  [/cancelled/, "canceled"],
];

/**
 * British spelling to the American form the sources are written in.
 *
 * The corpus is largely American English and the people using Nexus are not; "rationalise" finding
 * nothing while "rationalize" finds an article is a papercut with no defensible reason. Applied to
 * both sides, so it costs nothing and means the two spellings are one term.
 */
export function normaliseSpelling(word: string): string {
  for (const [pattern, replacement] of SPELLING) {
    if (pattern.test(word)) return word.replace(pattern, replacement);
  }
  if (word.length > 5 && !NOT_BRITISH_ISE.has(word)) {
    const m = /^(.*)is(e|ed|es|ing|er|ers)$/.exec(word);
    if (m) return `${m[1]}iz${m[2]}`;
  }
  return word;
}

/**
 * A deliberately timid stemmer: plurals and a handful of endings, nothing more.
 *
 * A full Porter stemmer conflates words this corpus needs to keep apart ("capability" and
 * "capable", "governance" and "govern" are fine to merge, but "architecture" → "architectur" then
 * colliding with "architect" loses the distinction between the discipline and the person). Since
 * both the query and the documents go through the same function, being timid costs recall only
 * where a user types an inflection we do not handle — which the phrase boost mops up.
 */
export function stem(raw: string): string {
  const word = normaliseSpelling(raw);
  if (word.length <= 3 || NO_STEM.has(word)) return word;
  // -ize / -ization to one root: "rationalise", "rationalize" and "rationalization" are the same
  // question asked three ways, and a reader who types one should find the other two.
  const ize = /^(.*iz)(e|es|ed|ing|ation|ations|ational)$/.exec(word);
  if (ize && ize[1]!.length > 3) return ize[1]!;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ses") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) return word.slice(0, -1);
  return word;
}

/** Split text into raw lowercase words, keeping intra-word dots and hyphens out of the way. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^a-z0-9+#'.]+/)
    .map((w) => w.replace(/^['.]+|['.]+$/g, ""))
    .filter(Boolean);
}

/** Index terms: words, stopped and stemmed. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const w of words(text)) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.push(stem(w));
  }
  return out;
}

/** Query terms, keeping the order (used for the phrase boost). */
export function queryTerms(query: string): { terms: string[]; phrase: string } {
  return { terms: tokenize(query), phrase: words(query).join(" ") };
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}
