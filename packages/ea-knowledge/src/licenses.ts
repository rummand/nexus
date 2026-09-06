import type { License, LicenseId } from "./types";

/**
 * The licences the corpus may contain.
 *
 * The corpus is committed to this repository and served from a product, which is redistribution.
 * So the test is not "can I read it" but "may I ship it": everything here permits that, with
 * attribution, and the share-alike ones oblige us to say so next to the passage. Anything else —
 * TOGAF, ArchiMate, most vendor material, most books — is referenced by link and never ingested.
 */
export const LICENSES: Record<LicenseId, License> = {
  "CC-BY-SA-4.0": {
    id: "CC-BY-SA-4.0",
    name: "Creative Commons Attribution-ShareAlike 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    shareAlike: true,
    attribution: "author-and-link",
  },
  "CC-BY-SA-3.0": {
    id: "CC-BY-SA-3.0",
    name: "Creative Commons Attribution-ShareAlike 3.0",
    url: "https://creativecommons.org/licenses/by-sa/3.0/",
    shareAlike: true,
    attribution: "author-and-link",
  },
  "CC-BY-4.0": {
    id: "CC-BY-4.0",
    name: "Creative Commons Attribution 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    shareAlike: false,
    attribution: "author-and-link",
  },
  "CC0-1.0": {
    id: "CC0-1.0",
    name: "Creative Commons Zero 1.0 (public domain dedication)",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    shareAlike: false,
    attribution: "link",
  },
  "public-domain-usgov": {
    id: "public-domain-usgov",
    name: "Public domain (work of the U.S. federal government)",
    url: "https://www.usa.gov/government-copyright",
    shareAlike: false,
    attribution: "link",
  },
  MIT: {
    id: "MIT",
    name: "MIT License",
    url: "https://opensource.org/license/mit",
    shareAlike: false,
    attribution: "author-and-link",
  },
  "GFDL-1.3-or-later": {
    id: "GFDL-1.3-or-later",
    name: "GNU Free Documentation License 1.3 or later",
    url: "https://www.gnu.org/licenses/fdl-1.3.html",
    shareAlike: true,
    attribution: "author-and-link",
  },
};

export function license(id: LicenseId): License {
  const found = LICENSES[id];
  if (!found) throw new Error(`unknown licence: ${id}`);
  return found;
}

/** The line shown under a quoted passage. */
export function attributionLine(title: string, attribution: string, url: string, id: LicenseId): string {
  const l = license(id);
  return l.attribution === "link"
    ? `${title} — ${url} (${l.name})`
    : `${title}, ${attribution} — ${url} (${l.name})`;
}
