import Link from "next/link";
import { GitBranch, Layers } from "lucide-react";

/** Change sets and the states they produce are one screen; these are its two halves. */
export function RoadmapTabs({ slug, active }: { slug: string; active: "changes" | "plateaus" }) {
  return (
    <nav className="knowledge-tabs" aria-label="Roadmap sections">
      <Link href={`/w/${slug}/roadmap`} className={active === "changes" ? "active" : ""}><GitBranch size={14} /> Change sets</Link>
      <Link href={`/w/${slug}/roadmap/plateaus`} className={active === "plateaus" ? "active" : ""}><Layers size={14} /> Plateaus</Link>
    </nav>
  );
}
