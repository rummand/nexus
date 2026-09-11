"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, GitBranch, GitCommitHorizontal, ListChecks, Network, ShieldCheck } from "lucide-react";
import { switchRefAction } from "@/lib/change/actions";
import { divergenceWords, refKindWords, refName, type Divergence, type Ref } from "@/lib/change/ref";

/**
 * Which change set you are on, everywhere (§5.82).
 *
 * The owner's requirement, and the one thing #133 says makes a branching model survive contact
 * with people: an editor always shows the git branch in the corner, and a model that can be
 * worked on in more than one world has to do the same or somebody will spend an afternoon on the
 * wrong one.
 *
 * It sits above the navigation rather than inside it, because it is not a place you go — it is
 * the state every place you go is read in.
 */

export interface RefChoice {
  id: string;
  name: string;
  status: string;
  targetDate: string;
  changes: number;
}

/*
 * The prop is `at`, not `ref`: `ref` is reserved on a React component, and the compiler's lint
 * reads every `current` on it as a ref access during render.
 */
export function RefIndicator({
  workspaceId, slug, at: current, divergence, choices,
}: { workspaceId: string; slug: string; at: Ref; divergence: Divergence; choices: RefChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const onMain = current.kind === "main";
  const moved = divergenceWords(divergence);

  const go = (id: string | null) => {
    setError("");
    start(async () => {
      const r = await switchRefAction(workspaceId, id);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className={`ref-indicator${onMain ? "" : " off-main"}`} data-ref-indicator={onMain ? "main" : current.id}>
      <button
        type="button"
        className="ref-current"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        disabled={pending}
        data-ref-open
      >
        {onMain ? <GitCommitHorizontal size={14} /> : <GitBranch size={14} />}
        <span className="ref-name">
          <b data-ref-name>{refName(current)}</b>
          {/*
            On main this is what main *means*, which is worth saying out loud once on every page.
            On a change set it is how far you have moved, which is the question you actually have.
          */}
          <em>{onMain ? refKindWords(current) : moved || "nothing changed yet"}</em>
        </span>
      </button>

      {open && (
        <div className="ref-menu" role="menu" data-ref-menu>
          <button type="button" role="menuitem" className={onMain ? "on" : ""} onClick={() => go(null)} data-ref-choice="main">
            <GitCommitHorizontal size={13} />
            <span><b>main</b><em>{refKindWords({ kind: "main" })}</em></span>
            {onMain && <Check size={13} />}
          </button>

          {choices.length === 0 ? (
            <p className="ref-none">
              No open change sets. A plan on the roadmap is somewhere you can stand; a delivered or
              abandoned one is not.
            </p>
          ) : (
            choices.map((c) => {
              const here = !onMain && current.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  className={here ? "on" : ""}
                  onClick={() => go(c.id)}
                  data-ref-choice={c.id}
                >
                  <GitBranch size={13} />
                  <span>
                    <b>{c.name || "(unnamed change set)"}</b>
                    <em>{c.targetDate ? `${c.targetDate} · ` : ""}{c.changes} change{c.changes === 1 ? "" : "s"}</em>
                  </span>
                  {here && <Check size={13} />}
                </button>
              );
            })
          )}
          {error && <p className="ref-error">{error}</p>}
          {/*
            The checks live here rather than in the rail (§5.83): they are consulted when
            something is about to land, which is exactly when somebody is looking at this menu.
            The rail is capped at fourteen and its rule is frequency (§5.65).
          */}
          <Link className="ref-checks" href={`/w/${slug}/checks`} onClick={() => setOpen(false)} data-ref-checks>
            <ShieldCheck size={13} />
            <span>{onMain ? "What is failing on main" : "What would this change break?"}</span>
          </Link>
          <Link className="ref-checks" href={`/w/${slug}/tree`} onClick={() => setOpen(false)} data-ref-tree>
            <Network size={13} />
            <span>Every branch and commit</span>
          </Link>
          <Link className="ref-checks" href={`/w/${slug}/campaigns`} onClick={() => setOpen(false)} data-ref-campaigns>
            <ListChecks size={13} />
            <span>Campaigns</span>
          </Link>
        </div>
      )}
    </div>
  );
}
