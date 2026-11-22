import { useCallback, useEffect, useState } from "react";

/**
 * The employee last picked in any Admin tab, so switching from Payout Sheet to
 * Leaves or Milestones keeps the same person selected. Lives for the browser
 * tab's session.
 */
const KEY = "wolfcrux.admin.employee";
let current: string = (() => {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
})();
const listeners = new Set<(id: string) => void>();

export function getSharedEmployee(): string {
  return current;
}

export function setSharedEmployee(id: string) {
  if (!id || id === current) return;
  current = id;
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l(id));
}

/** [selected id, setter] — the setter also updates every other tab's choice. */
export function useSharedEmployee(initial?: string): [string, (id: string) => void] {
  const [value, setValue] = useState(() => initial || current);
  useEffect(() => {
    const l = (id: string) => setValue(id);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const set = useCallback((id: string) => {
    setValue(id);
    setSharedEmployee(id);
  }, []);
  return [value, set];
}
