import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus",
  description: "AI-native enterprise architecture canvas",
};

/**
 * The typeface is served from this deployment, not from Google (§5.45).
 *
 * It used to be fetched at runtime from `fonts.googleapis.com`, which meant an air-gapped or
 * egress-restricted installation — the sovereign case this product is aimed at — silently fell
 * back to the system stack and did not look like itself in the environment it is most meant for.
 * It also put a third-party request on every page load of a tool that holds an organisation's
 * architecture. The files are committed under `public/fonts`; `scripts/vendor-fonts.mjs` refreshes
 * them.
 *
 * The `@font-face` rules are imported with the rest of the stylesheet rather than linked from the
 * document, so there is no second round trip before text can be painted, and every face carries
 * `font-display: swap` — readable immediately, reflowing once, rather than invisible while the
 * font arrives.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
