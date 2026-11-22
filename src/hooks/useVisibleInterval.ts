import { useEffect, useRef } from "react";

/**
 * Like setInterval, but only while the browser tab is visible.
 *
 * Every Terminal refresh goes through the Cloudflare Worker proxy, which has a
 * daily request limit. Tabs left open in the background used to keep polling
 * all day; now they pause, and refresh once immediately when the trader comes
 * back (if at least one interval has passed).
 */
export const useVisibleInterval = (callback: () => void, ms: number, enabled = true) => {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || ms <= 0) return;
    let lastRun = Date.now();
    let id: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      lastRun = Date.now();
      saved.current();
    };
    const start = () => {
      if (id === null) id = setInterval(run, ms);
    };
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        if (Date.now() - lastRun >= ms) run();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
};
