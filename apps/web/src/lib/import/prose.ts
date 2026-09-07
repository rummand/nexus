import type { Extraction } from "@/lib/intake/types";
import type { ProseClaim } from "./stage";

/**
 * The document, as claims about the same objects.
 *
 * Until now a batch could contain a Word document and did nothing with it: the file was kept, and
 * the page said reading it for claims was the intake pipeline's job. That was two pipelines side by
 * side for one obvious piece of work — the governance review in the batch is *about* the systems in
 * the export, and its sentence about Maximo belongs on the Maximo record, not in a different part
 * of the product.
 *
 * So the prose in a batch goes through intake's extractor (§5.15) and comes back here to be folded
 * into the staged records like any other source. Everything intake already guarantees comes with
 * it: a claim is only kept if it can be quoted from the passage it came from, and the quote travels
 * with the value so a reviewer sees the sentence rather than an assertion.
 *
 * What is deliberately dropped: viewpoints — decisions, actions, risks, the things somebody *said*.
 * They are not claims about the estate's shape and they have their own place on the intake screen.
 * An import is about what the model should contain.
 */

/** The kinds intake writes as records of what was said. They are evidence, not estate. */
const RECORD_KINDS = new Set(["meeting", "document", "person", "topic", "decision", "action", "risk", "question", "need"]);

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function claimsFrom(extraction: Extraction): ProseClaim[] {
  const byKey = new Map(extraction.candidates.map((c) => [c.key, c]));
  const claims: ProseClaim[] = [];

  for (const candidate of extraction.candidates) {
    if (RECORD_KINDS.has(norm(candidate.kind))) continue;
    const name = candidate.name.trim();
    if (!name) continue;

    // The first mention is the sentence a reader would be shown; intake has already checked that
    // it really occurs in the source, so nothing here needs to trust the model again.
    const quote = candidate.mentions[0]?.quote?.trim() ?? "";
    const attributes: ProseClaim["attributes"] = {};
    for (const [key, value] of Object.entries(candidate.attributes)) {
      if (!String(value).trim()) continue;
      // The sentence that states *this* value where the extractor gave one, and the sentence that
      // introduced the object otherwise — a quote is only useful if it says the thing it is under.
      attributes[key] = { value: String(value), quote: candidate.attributeQuotes?.[key] ?? quote };
    }

    const relations = extraction.relations
      .filter((relation) => relation.from === candidate.key)
      .flatMap((relation) => {
        const other = byKey.get(relation.to);
        if (!other?.name.trim()) return [];
        return [{ kind: relation.kind, target: other.name, quote: relation.mentions[0]?.quote?.trim() ?? quote }];
      });

    claims.push({
      name,
      kind: RECORD_KINDS.has(norm(candidate.kind)) ? "" : candidate.kind,
      description: candidate.description,
      attributes,
      relations,
      confidence: candidate.confidence,
    });
  }
  return claims;
}

/** One sentence for the review: how this document was read, and what came out of it. */
export function describeProse(extraction: Extraction, claims: ProseClaim[]): string {
  const attributes = claims.reduce((n, c) => n + Object.keys(c.attributes).length, 0);
  const relations = claims.reduce((n, c) => n + c.relations.length, 0);
  const how = extraction.engine === "model" ? "read by the model" : "read by the rules";
  if (!claims.length) {
    return `Nothing about the objects in this batch was found in it (${how}). It is kept with the batch.`;
  }
  return (
    `${how}: ${claims.length} object${claims.length === 1 ? "" : "s"} mentioned` +
    `${attributes ? `, ${attributes} attribute${attributes === 1 ? "" : "s"}` : ""}` +
    `${relations ? `, ${relations} relation${relations === 1 ? "" : "s"}` : ""}. ` +
    `Every value carries the sentence it came from.`
  );
}
