"use client";

import { useEffect } from "react";

/**
 * Loads the IBM Plex web fonts without blocking first paint. A render-blocking stylesheet in
 * <head> stalls the whole app for as long as the font host takes to answer — in offline or
 * sovereign deployments that can be many seconds — while the system stack looks fine meanwhile.
 */
export function FontLoader() {
  useEffect(() => {
    if (document.querySelector('link[data-nexus-fonts="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;700&display=swap";
    link.dataset.nexusFonts = "1";
    document.head.appendChild(link);
  }, []);
  return null;
}
