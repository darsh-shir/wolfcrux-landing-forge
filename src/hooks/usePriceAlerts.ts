import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeTipranksQuotes } from "@/lib/tipranksQuote";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { toast } from "@/hooks/use-toast";
import { fmtAmt } from "@/lib/utils";

/**
 * Per-browser price alerts ("tell me when AMD goes above 180").
 *
 * Stored in localStorage (no database). Checked every 20 s while the Terminal
 * is open and visible, against the last traded price — including pre-market /
 * after-hours prints. Fires an in-page toast and, if allowed, a browser
 * notification, then marks the alert as triggered.
 */
export interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  price: number;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}

const STORAGE_KEY = "wolfcrux:price-alerts";
const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";
const CHECK_EVERY_MS = 20_000;

const load = (): PriceAlert[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const save = (list: PriceAlert[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: alerts last for this page view only */
  }
};

const notify = (title: string, body: string) => {
  toast({ title, description: body });
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: title });
    }
  } catch {
    /* notifications unsupported */
  }
};

export const usePriceAlerts = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>(load);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const update = useCallback((fn: (prev: PriceAlert[]) => PriceAlert[]) => {
    setAlerts((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAlerts(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addAlert = useCallback(
    (symbol: string, direction: PriceAlert["direction"], price: number) => {
      const sym = symbol.trim().toUpperCase();
      if (!sym || !Number.isFinite(price) || price <= 0) return;
      update((prev) => [
        ...prev,
        { id: `${sym}-${Date.now()}`, symbol: sym, direction, price, createdAt: Date.now() },
      ]);
      // Ask once; the in-page toast works either way.
      try {
        if ("Notification" in window && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch {
        /* ignore */
      }
    },
    [update]
  );

  const removeAlert = useCallback((id: string) => update((prev) => prev.filter((a) => a.id !== id)), [update]);

  const check = useCallback(async () => {
    const active = alertsRef.current.filter((a) => !a.triggeredAt);
    const symbols = [...new Set(active.map((a) => a.symbol))];
    if (symbols.length === 0) return;
    try {
      const target = `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${symbols
        .map(encodeURIComponent)
        .join("%2C")}`;
      const res = await fetch(`${PROXY}${encodeURIComponent(target)}`);
      if (!res.ok) return;
      const quotes = new Map(normalizeTipranksQuotes(await res.json()).map((q) => [q.symbol, q]));

      const hits: PriceAlert[] = [];
      for (const a of active) {
        const q = quotes.get(a.symbol);
        if (!q) continue;
        const last = q.extended?.price ?? q.price; // latest print, incl. pre/after-hours
        if ((a.direction === "above" && last >= a.price) || (a.direction === "below" && last <= a.price)) {
          hits.push({ ...a, triggeredAt: Date.now(), triggeredPrice: last });
        }
      }
      if (hits.length === 0) return;
      const byId = new Map(hits.map((h) => [h.id, h]));
      update((prev) => prev.map((a) => byId.get(a.id) ?? a));
      hits.forEach((h) =>
        notify(
          `${h.symbol} ${h.direction === "above" ? "above" : "below"} $${fmtAmt(h.price, 2)}`,
          `Last price $${fmtAmt(h.triggeredPrice!, 2)}`
        )
      );
    } catch {
      /* network hiccup: try again next interval */
    }
  }, [update]);

  useEffect(() => {
    void check();
  }, [check]);
  useVisibleInterval(() => void check(), CHECK_EVERY_MS);

  return { alerts, addAlert, removeAlert };
};
