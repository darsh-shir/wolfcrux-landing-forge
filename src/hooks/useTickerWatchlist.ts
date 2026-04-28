import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Industry leaders shown by default in the live ticker tape.
 * Curated mega-caps across major sectors (Tech, Finance, Healthcare,
 * Energy, Consumer, Industrials, Comms, Semis).
 */
export const INDUSTRY_LEADERS: string[] = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "BRK.B", "JPM", "V", "MA",
  "UNH", "LLY", "JNJ",
  "XOM", "CVX",
  "WMT", "COST", "HD", "MCD",
  "CAT", "BA", "GE",
  "NFLX", "DIS",
  "AVGO", "AMD", "TSM",
];

const PROXY_URL = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

export interface TickerQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changesPercentage: number;
}

// Single browser-wide key. Watchlist persists across logins, logouts,
// browser restarts and days — until the user clears site data.
// Old per-user keys are migrated on first read.
const STORAGE_KEY = "wolfcrux:ticker-watchlist";
const LEGACY_KEY_PREFIX = "wolfcrux:ticker-watchlist:";

const sanitize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");

const fetchQuote = async (symbol: string): Promise<TickerQuote | null> => {
  try {
    const target = `https://www.perplexity.ai/rest/finance/quote/${encodeURIComponent(
      symbol
    )}?with_history=false&with_ui_hints=false`;
    const res = await fetch(`${PROXY_URL}${encodeURIComponent(target)}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.symbol || typeof d.price !== "number") return null;
    return {
      symbol: d.symbol,
      name: d.name,
      price: Number(d.price) || 0,
      change: Number(d.change) || 0,
      changesPercentage: Number(d.changesPercentage) || 0,
    };
  } catch {
    return null;
  }
};

/**
 * Hook that:
 *  - Loads a per-user watchlist (localStorage, keyed by user id when signed in)
 *  - Merges INDUSTRY_LEADERS at the front, user symbols after
 *  - Fetches live quotes via the existing Cloudflare proxy
 *  - Auto-refreshes every 20s
 */
export const useTickerWatchlist = () => {
  const { user } = useAuth();
  const [userSymbols, setUserSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const inflight = useRef(false);

  // Load watchlist once on mount; merge any legacy per-user lists into the
  // single shared list so nothing the user previously added is lost.
  useEffect(() => {
    try {
      const merged = new Set<string>();

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) parsed.forEach((s) => s && merged.add(s));
      }

      // Migrate any legacy per-user / guest keys into the shared list, then drop them
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(LEGACY_KEY_PREFIX)) continue;
        try {
          const legacy = JSON.parse(localStorage.getItem(key) || "[]") as string[];
          if (Array.isArray(legacy)) legacy.forEach((s) => s && merged.add(s));
        } catch {
          /* ignore */
        }
        localStorage.removeItem(key);
      }

      const next = Array.from(merged);
      setUserSymbols(next);
      if (next.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setUserSymbols([]);
    }
    // Re-run if user identity changes so a freshly-signed-in user picks up
    // anything they added while logged out (and vice versa).
  }, [user?.id]);

  const persist = useCallback((next: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const allSymbols = [...INDUSTRY_LEADERS, ...userSymbols.filter((s) => !INDUSTRY_LEADERS.includes(s))];

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const results = await Promise.all(allSymbols.map(fetchQuote));
      const clean = results.filter((q): q is TickerQuote => !!q);
      if (clean.length > 0) setQuotes(clean);
    } finally {
      inflight.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSymbols.join(",")]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const addSymbol = useCallback(
    async (raw: string): Promise<{ ok: boolean; error?: string }> => {
      const sym = sanitize(raw);
      if (!sym) return { ok: false, error: "Enter a valid ticker" };
      if (INDUSTRY_LEADERS.includes(sym))
        return { ok: false, error: `${sym} is already in the default leaders` };
      if (userSymbols.includes(sym))
        return { ok: false, error: `${sym} is already in your list` };

      // Validate by fetching once
      const q = await fetchQuote(sym);
      if (!q) return { ok: false, error: `Could not find quote for ${sym}` };

      const next = [...userSymbols, sym];
      setUserSymbols(next);
      persist(next);
      setQuotes((prev) => {
        const without = prev.filter((p) => p.symbol !== q.symbol);
        return [...without, q];
      });
      return { ok: true };
    },
    [userSymbols, persist]
  );

  const removeSymbol = useCallback(
    (sym: string) => {
      const upper = sanitize(sym);
      if (INDUSTRY_LEADERS.includes(upper)) return; // can't remove defaults
      const next = userSymbols.filter((s) => s !== upper);
      setUserSymbols(next);
      persist(next);
      setQuotes((prev) => prev.filter((p) => p.symbol !== upper));
    },
    [userSymbols, persist]
  );

  return {
    quotes,
    loading,
    userSymbols,
    addSymbol,
    removeSymbol,
    refresh,
  };
};
