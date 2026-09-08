import { describe, expect, it } from "vitest";
import { accessToken, isPublicPath, safeEqual } from "./access";

/**
 * What gets past the gates without a cookie.
 *
 * This function decides what an unauthenticated request may fetch, so widening it is the kind of
 * change that wants a test standing next to it. Two lessons are encoded here. Rev 76 put `public/`
 * behind the gate and every documentation screenshot broke, because Next's image optimiser fetches
 * its source over HTTP and was redirected to the sign-in page. Rev 80 self-hosted the typeface, and
 * its `.woff2` files are fetched by the browser the same way.
 *
 * The rule is "files with extensions", and the risk is that it lets a page through. Pages and API
 * routes in this product have no extension, which is what makes the rule safe — so that is what
 * the last test pins down.
 */

describe("what is reachable without signing in", () => {
  it("lets the doors themselves through", () => {
    for (const p of ["/login", "/signin", "/signout", "/api/health", "/api/mcp"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("lets the framework and static files through", () => {
    for (const p of ["/_next/static/chunk.js", "/favicon.ico", "/docs/board.png", "/fonts/ibmplexsans-v23-abc.woff2", "/robots.txt"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("keeps everything that is a page or an API route behind the gate", () => {
    for (const p of ["/", "/w/acme-energy", "/w/acme-energy/graph", "/b/brd_landscape", "/e/ent_1", "/api/boards/brd_1", "/api/graph/compose", "/api/agents/tick"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("is not fooled by an extension somewhere other than the end", () => {
    // A route that merely contains ".css" or ".png" is still a route.
    expect(isPublicPath("/w/acme/boards/report.png/edit")).toBe(false);
    expect(isPublicPath("/api/x.woff2/steal")).toBe(false);
  });
});

describe("the shared-password token", () => {
  it("is stable for one password and different for another", async () => {
    expect(await accessToken("hunter2")).toBe(await accessToken("hunter2"));
    expect(await accessToken("hunter2")).not.toBe(await accessToken("hunter3"));
  });

  it("compares without leaking where the difference is", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
