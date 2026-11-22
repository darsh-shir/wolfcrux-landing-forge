import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { supabase } from "@/integrations/supabase/client";
import { DB_UPDATE_APPLIED } from "@/lib/features";
import { normalizeTipranksQuotes, type ExtendedHoursQuote } from "@/lib/tipranksQuote";


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
  extended?: ExtendedHoursQuote | null;
}

// Single browser-wide key. Watchlist persists across logins, logouts,
// browser restarts and days — until the user clears site data.
// Old per-user keys are migrated on first read.
const STORAGE_KEY = "wolfcrux:ticker-watchlist";
const LEGACY_KEY_PREFIX = "wolfcrux:ticker-watchlist:";

const sanitize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");

const fetchQuotes = async (symbols: string[]): Promise<TickerQuote[]> => {
  if (symbols.length === 0) return [];
  try {
    const joined = symbols.map((s) => encodeURIComponent(s)).join("%2C");
    const target = `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${joined}`;
    const res = await fetch(`${PROXY_URL}${encodeURIComponent(target)}`);
    if (!res.ok) return [];
    const d = await res.json();
    return normalizeTipranksQuotes(d).map((q) => ({
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      change: q.change,
      changesPercentage: q.changesPercentage,
      extended: q.extended,
    }));
  } catch {
    return [];
  }
};


const fetchQuote = async (symbol: string): Promise<TickerQuote | null> => {
  const list = await fetchQuotes([symbol]);
  return list[0] ?? null;
};

/**
 * Hook that:
 *  - Loads the trader's watchlist from their account (Supabase), cached in localStorage
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

  // Signed in: the watchlist lives in the trader's account (user_watchlists),
  // so it follows them across computers. The browser copy above is only a
  // fast first paint and a fallback if the database can't be reached.
  useEffect(() => {
    if (!user?.id || !DB_UPDATE_APPLIED) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_watchlists")
        .select("symbols")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("Watchlist sync unavailable, using this browser's list:", error.message);
        return;
      }
      if (data) {
        const fromAccount = (data.symbols || []).map(sanitize).filter(Boolean);
        setUserSymbols(fromAccount);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromAccount));
        } catch {
          /* ignore */
        }
      } else {
        // First sign-in since sync was added: copy this browser's list to the account.
        let local: string[] = [];
        try {
          const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          if (Array.isArray(parsed)) local = parsed.map(sanitize).filter(Boolean);
        } catch {
          /* ignore */
        }
        if (local.length > 0) {
          await supabase.from("user_watchlists").upsert({ user_id: user.id, symbols: local });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback(
    (next: string[]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      if (user?.id && DB_UPDATE_APPLIED) {
        void supabase
          .from("user_watchlists")
          .upsert({ user_id: user.id, symbols: next })
          .then(({ error }) => {
            if (error) console.warn("Couldn't save watchlist to your account:", error.message);
          });
      }
    },
    [user?.id]
  );

  const allSymbols = [...INDUSTRY_LEADERS, ...userSymbols.filter((s) => !INDUSTRY_LEADERS.includes(s))];

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const clean = await fetchQuotes(allSymbols);
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
  }, [refresh]);
  // Pauses while the tab is hidden (saves Worker requests).
  useVisibleInterval(refresh, 20_000);

  const addSymbol = useCallback(
    async (raw: string): Promise<{ ok: boolean; error?: string }> => {
      const sym = sanitize(raw);
      if (!sym) return { ok: false, error: "Enter a valid ticker" };
      // Default leaders can be added too: the personal list drives the
      // Terminal's "My watchlist" filters, not just the ticker tape.
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
      if (!userSymbols.includes(upper)) return;
      const next = userSymbols.filter((s) => s !== upper);
      setUserSymbols(next);
      persist(next);
      // Default leaders stay on the ticker tape.
      if (!INDUSTRY_LEADERS.includes(upper)) setQuotes((prev) => prev.filter((p) => p.symbol !== upper));
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
