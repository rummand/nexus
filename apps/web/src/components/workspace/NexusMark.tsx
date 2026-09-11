/**
 * The Nexus mark (§5.79).
 *
 * An **N drawn as a graph**: four nodes at the corners, three edges between them — the left stem,
 * the diagonal, the right stem. Read as a letter it is the product's initial; read as a picture it
 * is what the product is, which is the only thing a mark for this product should be.
 *
 * What it deliberately is not is the previous one, which was a three-node share glyph — the icon
 * every collaboration tool ships, and one a reader has already learned to mean "send this to
 * somebody". A mark for a graph product should not be borrowed from a menu item.
 *
 * Drawn on a 24 grid with nothing below two pixels of stroke, so it survives a 16px favicon: the
 * nodes are solid rather than ringed, the edges run centre to centre with the nodes painted over
 * them, and there is no detail that a browser tab would turn to mud.
 */
export function NexusMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.4 5.6v12.8M6.4 5.6l11.2 12.8M17.6 5.6v12.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="6.4" cy="5.6" r="2.7" fill="currentColor" />
      <circle cx="6.4" cy="18.4" r="2.7" fill="currentColor" />
      <circle cx="17.6" cy="5.6" r="2.7" fill="currentColor" />
      <circle cx="17.6" cy="18.4" r="2.7" fill="currentColor" />
    </svg>
  );
}
