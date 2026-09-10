import { describe, expect, it } from "vitest";
import { headingId, outline, parseInline, parseMarkdown, plain, references, summarise, type Block } from "./markdown";

/**
 * The wiki's markdown (§5.60).
 *
 * Two properties matter more than coverage of the syntax. **Nothing may disappear**: this is where
 * people paste text out of Word and Confluence, and a parser that silently swallows a line it does
 * not recognise loses somebody's work. And **the parser must always terminate** — a hand-written
 * block loop with a line it consumes zero of is an infinite loop in a server component.
 */

describe("inline runs", () => {
  it("reads the marks people actually type", () => {
    expect(parseInline("plain **bold** *soft* `code`")).toEqual([
      { kind: "text", text: "plain " },
      { kind: "strong", text: "bold" },
      { kind: "text", text: " " },
      { kind: "em", text: "soft" },
      { kind: "text", text: " " },
      { kind: "code", text: "code" },
    ]);
  });

  it("reads a link and a wiki link differently", () => {
    expect(parseInline("[docs](https://x.test)")).toEqual([{ kind: "link", text: "docs", href: "https://x.test" }]);
    expect(parseInline("see [[Grid Platform]]")).toEqual([
      { kind: "text", text: "see " },
      { kind: "wikilink", title: "Grid Platform" },
    ]);
  });

  it("leaves an ordinary asterisk alone", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
  });

  it("keeps text that matches nothing, rather than dropping it", () => {
    expect(plain(parseInline("a < b & c > d"))).toBe("a < b & c > d");
  });
});

describe("blocks", () => {
  it("reads a heading, and gives it an anchor", () => {
    const [b] = parseMarkdown("## Grid platform, 2027");
    expect(b).toMatchObject({ kind: "heading", level: 2, id: "grid-platform-2027" });
  });

  it("joins the lines of a paragraph and stops at the next block", () => {
    const blocks = parseMarkdown("one\ntwo\n\n- item");
    expect(blocks[0]).toMatchObject({ kind: "paragraph" });
    expect(plain((blocks[0] as Extract<Block, { kind: "paragraph" }>).text)).toBe("one two");
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: false });
  });

  it("tells an ordered list from a bulleted one", () => {
    expect(parseMarkdown("1. a\n2. b")[0]).toMatchObject({ kind: "list", ordered: true });
    expect(parseMarkdown("- a\n- b")[0]).toMatchObject({ kind: "list", ordered: false });
  });

  it("takes a fenced block whole, including the lines that look like markdown", () => {
    const [b] = parseMarkdown("```sql\n# not a heading\nselect 1\n```");
    expect(b).toEqual({ kind: "code", language: "sql", text: "# not a heading\nselect 1" });
  });

  it("runs an unterminated fence to the end instead of losing the page", () => {
    const [b] = parseMarkdown("```\nstill here");
    expect(b).toEqual({ kind: "code", language: "", text: "still here" });
  });

  it("needs a divider before it believes a table", () => {
    const table = parseMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(table[0]).toMatchObject({ kind: "table" });
    expect((table[0] as Extract<Block, { kind: "table" }>).rows).toHaveLength(1);
    // Pipes in a sentence are a sentence.
    expect(parseMarkdown("cost | benefit")[0]).toMatchObject({ kind: "paragraph" });
  });

  it("reads a quote across its lines", () => {
    expect(plain((parseMarkdown("> one\n> two")[0] as Extract<Block, { kind: "quote" }>).text)).toBe("one two");
  });

  it("always terminates, whatever it is given", () => {
    // The property, not an example: every input must come back, and come back at all.
    // These inputs are chosen to make each block branch consume zero lines. The fence cases are
    // here because an earlier version of the fence loop never advanced the cursor, and the first
    // set of inputs — none of which had a line *after* the fence — did not reach it.
    const inputs = ["", "   ", ":::", "|", "```", ">", "#", "- ", "1.", "***", "#####  deep",
      "```\nbody", "```js\na\nb", ":::board", ":::sparkle x", "| a |\n| b |"];
    for (const source of inputs) {
      const done = { at: 0 };
      expect(() => { parseMarkdown(source); done.at = 1; }, JSON.stringify(source)).not.toThrow();
      expect(done.at, JSON.stringify(source)).toBe(1);
    }
  });

  it("keeps every line of prose it was given", () => {
    const source = "Alpha beta.\n\n## Head\n\nGamma delta.";
    const text = parseMarkdown(source).map((b) => ("text" in b && Array.isArray(b.text) ? plain(b.text) : "")).join(" ");
    for (const word of ["Alpha", "beta", "Head", "Gamma", "delta"]) expect(text).toContain(word);
  });
});

describe("embeds", () => {
  it("reads a directive as a reference to the model, not as text", () => {
    expect(parseMarkdown(":::board brd_landscape")[0])
      .toEqual({ kind: "embed", embed: "board", target: "brd_landscape", caption: "" });
  });

  it("takes an optional caption after a pipe", () => {
    expect(parseMarkdown(":::object ent_8f21 | The system of record")[0])
      .toEqual({ kind: "embed", embed: "object", target: "ent_8f21", caption: "The system of record" });
  });

  it("keeps a query whole, spaces and all", () => {
    expect(parseMarkdown(":::query kind:Application missing:owner")[0])
      .toMatchObject({ embed: "query", target: "kind:Application missing:owner" });
  });

  it("leaves an unknown directive as text rather than swallowing it", () => {
    expect(parseMarkdown(":::sparkle everything")[0]).toMatchObject({ kind: "paragraph" });
  });
});

describe("what a page is made of", () => {
  const blocks = parseMarkdown([
    "# Title", "Intro with [[Other page]].", ":::board brd_a", "## Second",
    "- a [[Third page]]", "| h |", "|---|", "| [[Fourth]] |",
  ].join("\n"));

  it("lists the headings for a contents list", () => {
    expect(outline(blocks)).toEqual([
      { level: 1, text: "Title", id: "title" },
      { level: 2, text: "Second", id: "second" },
    ]);
  });

  it("finds every embed and every wiki link, wherever they are", () => {
    const r = references(blocks);
    expect(r.embeds).toEqual([{ kind: "board", target: "brd_a" }]);
    expect(r.wikilinks.sort()).toEqual(["Fourth", "Other page", "Third page"]);
  });

  it("summarises from the first paragraph, not the title", () => {
    expect(summarise(blocks)).toBe("Intro with Other page.");
  });

  it("has nothing to summarise from a page that is all headings", () => {
    expect(summarise(parseMarkdown("# Only a title"))).toBe("");
  });

  it("cuts a long summary at a length a list can show", () => {
    expect(summarise(parseMarkdown("x".repeat(400)), 40)).toHaveLength(40);
  });
});

describe("heading anchors", () => {
  it("is stable, lower case and free of punctuation", () => {
    expect(headingId("Grid Platform: 2027 review!")).toBe("grid-platform-2027-review");
  });

  it("never returns an empty anchor", () => {
    expect(headingId("!!!")).toBe("section");
  });
});
