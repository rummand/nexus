/**
 * The Nexus mark (§5.79).
 *
 * A flat-cut geometric **N**: two stems and a diagonal, square apexes, even counters. A monogram
 * and nothing else — the mark of a system of record rather than of a drawing tool, which is what
 * an architecture team is putting on a slide in front of a steering committee.
 *
 * It has been two other things and both were wrong for that audience. A three-node share glyph
 * said "send this to somebody", which is a menu item, not a product. An N built out of dots and
 * edges was literal about the graph and read as playful at the size it is actually seen.
 *
 * Drawn on a 24 grid with 4.4-wide stems inset 4 from every edge, so the counters survive being
 * painted at sixteen pixels and there is no detail for a browser tab to turn to mud.
 */
export function NexusMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path fill="currentColor" d="M4 4h4.4v16H4zM15.6 4H20v16h-4.4zM8.4 4h4.05L20 20h-4.05z" />
    </svg>
  );
}
