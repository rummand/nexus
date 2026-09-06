"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "@/lib/docs";

/**
 * The contents: every page, in reading order, with the current one marked.
 *
 * A client component only so it can read the path — a layout is not told which child route is
 * showing, and highlighting where you are is the one job a contents list must not get wrong.
 */
export function DocsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav className="doc-nav" aria-label="Documentation contents">
      <Link href={`/w/${slug}/docs`} className={pathname === `/w/${slug}/docs` ? "doc-nav-home active" : "doc-nav-home"}>
        All documentation
      </Link>
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <b>{section.title}</b>
          <ul>
            {section.pages.map((page) => {
              const href = `/w/${slug}/docs/${page.slug}`;
              return (
                <li key={page.slug}>
                  <Link href={href} className={pathname === href ? "active" : ""}>{page.title}</Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
