"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";

/**
 * The window a fact sheet opens in (§5.77).
 *
 * An object is not worth losing your place over. You are three filters deep in the repository,
 * you open one application to check who owns it, and a full page navigation throws the list away:
 * the scroll position, the search, the facets, all of it, and the back button has to rebuild the
 * page to give them back. So the sheet opens *over* what you were doing, filling everything right
 * of the menu — the menu stays, because leaving the object is one click on wherever you were
 * going next, not a retreat through the history.
 *
 * It is a window, not a dialog: no dimmed backdrop, no trapped focus, nothing to dismiss before
 * the product will speak to you again. Three ways out, all of them cheap — the ×, Escape, and the
 * back button, which the intercepted route makes the same gesture.
 */
export function SheetWindow({
  children,
  name,
  kind,
  slug,
  entityId,
}: {
  children: React.ReactNode;
  name: string;
  kind: string;
  slug: string;
  entityId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      /*
       * Escape in a field belongs to the field: LiveValue uses it to put back what was there
       * before the edit. Closing the window out from under that would throw away the revert.
       */
      const el = event.target as HTMLElement | null;
      if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
      router.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <section className="fs-window" data-sheet-window={entityId} aria-label={`${name} — ${kind || "object"}`}>
      <header className="fs-window-bar">
        <span className="fs-window-name">
          <b>{name}</b>
          <em>{kind || "Untyped"}</em>
        </span>
        <Link className="fs-window-full" href={`/w/${slug}/fs/${entityId}`} data-sheet-full>
          Open on its own <ArrowUpRight size={12} />
        </Link>
        <button type="button" className="fs-window-close" onClick={() => router.back()} data-sheet-close aria-label="Close">
          <X size={15} />
        </button>
      </header>
      <div className="fs-window-scroll">{children}</div>
    </section>
  );
}
