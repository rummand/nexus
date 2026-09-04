/** Entity summary kept on the canvas for suggestions (a slice of the graph snapshot). */
export interface VocabEntity {
  id: string;
  name: string;
  kind: string;
  attributes?: Record<string, string>;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * When a card's title equals the name of an entity that is not the card's own, offer to link the
 * card to that entity instead of growing a duplicate. Same-kind matches win over other kinds.
 */
export function findLinkCandidate(title: string, currentEntityId: string | undefined, kind: string, entities: VocabEntity[]): VocabEntity | null {
  const t = norm(title);
  if (!t) return null;
  const matches = entities.filter((e) => e.id !== currentEntityId && norm(e.name) === t);
  if (matches.length === 0) return null;
  return matches.find((e) => norm(e.kind) === norm(kind)) ?? matches[0]!;
}
