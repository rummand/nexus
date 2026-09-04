"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "nexus:localstorage";

function read(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** localStorage-backed string value that is hydration-safe (server sees the fallback). */
export function useLocalStorageValue(key: string, fallback: string): [string, (v: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(EVENT, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(EVENT, cb);
    };
  }, []);
  const value = useSyncExternalStore(subscribe, () => read(key, fallback), () => fallback);
  const set = useCallback(
    (v: string) => {
      try {
        window.localStorage.setItem(key, v);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
