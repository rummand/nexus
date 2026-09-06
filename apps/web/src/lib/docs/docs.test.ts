import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAGES, SECTIONS, docPage, neighbours, searchDocs } from "./index";
import { pageText, resolveHref } from "./types";
import shotSizes from "./shots.json";

/** The manifest is typed from its literal keys; a lookup by an arbitrary slug needs the wider shape. */
const SHOTS = shotSizes as Record<string, { width: number; height: number } | undefined>;

/**
 * The documentation is data, so it can be checked like data.
 *
 * The failure mode of illustrated docs is rot: a screenshot is renamed, a route moves, and the
 * page quietly shows a broken image to the one person who needed it. These tests make that a
 * failing build instead — which is the only reason it is safe to promise screenshots at all.
 */

const shots = PAGES.flatMap((page) => page.blocks.filter((b) => b.kind === "shot").map((b) => ({ page: page.slug, src: b.src, alt: b.alt })));
const tries = PAGES.flatMap((page) => page.blocks.filter((b) => b.kind === "try").map((b) => ({ page: page.slug, href: b.href })));

describe("the documentation", () => {
  it("has a screenshot on disk for every one it references", () => {
    for (const shot of shots) {
      const file = path.resolve(__dirname, "../../../public/docs", `${shot.src}.png`);
      expect(existsSync(file), `${shot.page} references ${shot.src}.png, which is not in public/docs — run scripts/capture-docs.mjs`).toBe(true);
    }
  });

  it("knows the size of every screenshot, so the page does not jump as it loads", () => {
    for (const shot of shots) {
      expect(SHOTS[shot.src], `${shot.src} is missing from shots.json — re-run scripts/capture-docs.mjs`).toBeTruthy();
    }
  });

  it("describes every screenshot for somebody who cannot see it", () => {
    for (const shot of shots) {
      expect(shot.alt.length, `${shot.page}: ${shot.src} has no useful alt text`).toBeGreaterThan(20);
    }
  });

  it("only links to routes that exist", () => {
    // Every "try it" link is a workspace route; the slug is filled in at render time.
    const known = [
      "", "/graph", "/explore", "/meta", "/intake", "/intake?view=catalog", "/knowledge", "/roadmap",
      "/roadmap/plateaus", "/agents", "/apm", "/docs",
    ];
    for (const t of tries) {
      const resolved = resolveHref(t.href, "acme-energy");
      expect(resolved.startsWith("/w/acme-energy"), `${t.page}: ${t.href} is not a workspace link`).toBe(true);
      const tail = resolved.replace("/w/acme-energy", "");
      expect(known, `${t.page}: ${t.href} points somewhere this test does not know about`).toContain(tail);
    }
  });

  it("has unique slugs and no empty pages", () => {
    const slugs = PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const page of PAGES) {
      expect(page.blocks.length, `${page.slug} is empty`).toBeGreaterThan(2);
      expect(page.summary.length, `${page.slug} has no summary`).toBeGreaterThan(20);
    }
  });

  it("gives every heading an id, so the on-page contents can link to it", () => {
    for (const page of PAGES) {
      const ids = page.blocks.filter((b) => b.kind === "heading").map((b) => b.id);
      expect(new Set(ids).size, `${page.slug} has two headings with the same id`).toBe(ids.length);
      for (const id of ids) expect(id, `${page.slug} has a heading with no id`).toBeTruthy();
    }
  });

  it("puts every page in exactly one section", () => {
    const inSections = SECTIONS.flatMap((s) => s.pages.map((p) => p.slug));
    expect(inSections.sort()).toEqual(PAGES.map((p) => p.slug).sort());
    expect(new Set(inSections).size).toBe(inSections.length);
  });

  it("chains pages front to back", () => {
    expect(neighbours(PAGES[0]!.slug).previous).toBeNull();
    expect(neighbours(PAGES.at(-1)!.slug).next).toBeNull();
    expect(neighbours(PAGES[1]!.slug).previous?.slug).toBe(PAGES[0]!.slug);
  });

  it("finds the page a person would be looking for", () => {
    expect(searchDocs("shortcuts")[0]?.page.slug).toBe("shortcuts");
    expect(searchDocs("what breaks if we retire a system")[0]?.page.slug).toBe("roadmap");
    expect(searchDocs("duplicate systems")[0]?.page.slug).toMatch(/graph|boards-and-graph|health/);
    expect(searchDocs("zzzzq")).toEqual([]);
  });

  it("indexes the whole page, not just its title", () => {
    const page = docPage("canvas")!;
    expect(pageText(page)).toMatch(/Alt/); // from a list item deep in the page
  });
});
