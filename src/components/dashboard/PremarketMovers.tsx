import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sunrise } from "lucide-react";
import { normalizeTipranksQuotes, type NormalizedQuote } from "@/lib/tipranksQuote";
import { fetchEarningsTickers } from "@/lib/earnings";
import { nextWeekdayKey, nyDateKey } from "@/lib/marketDate";
import { INDUSTRY_LEADERS } from "@/hooks/useTickerWatchlist";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { useTerminal } from "@/components/dashboard/TerminalContext";
import DataAge from "@/components/dashboard/DataAge";
import { fmtAmt } from "@/lib/utils";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";
const REFRESH_MS = 2 * 60_000;
const MIN_PRICE = 2; // skip penny stocks, whose % moves are mostly noise
const MIN_MARKET_CAP = 300e6; // and micro-caps
const MAX_EXTRA = 60; // top names from the movers lists
const MAX_UNIVERSE = 200; // at most 4 quote requests per refresh

interface Props {
  /** Extra tickers to scan, e.g. today's market movers. */
  extraSymbols?: string[];
}

const fetchQuotes = async (symbols: string[]): Promise<NormalizedQuote[]> => {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 50) chunks.push(symbols.slice(i, i + 50));
  const results = await Promise.allSettled(
    chunks.map(async (c) => {
      const target = `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${c
        .map(encodeURIComponent)
        .join("%2C")}`;
      const res = await fetch(`${PROXY}${encodeURIComponent(target)}`);
      if (!res.ok) throw new Error(String(res.status));
      return normalizeTipranksQuotes(await res.json());
    })
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
};

/**
 * Biggest pre-market (or, outside pre-market, after-hours) moves among the
 * names traders care about: market leaders, their watchlist, today's movers
 * and the companies reporting earnings on the next trading day. TipRanks has
 * no pre-market screener feed, so this is computed from extended-hours quotes.
 */
const PremarketMovers = ({ extraSymbols = [] }: Props) => {
  const { watchlist } = useTerminal();
  const [earningsTickers, setEarningsTickers] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<NormalizedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchEarningsTickers(nextWeekdayKey(nyDateKey())).then(setEarningsTickers);
  }, []);

  const universe = useMemo(
    () =>
      [
        ...new Set([...watchlist, ...earningsTickers, ...INDUSTRY_LEADERS, ...extraSymbols.slice(0, MAX_EXTRA)]),
      ]
        .filter(Boolean)
        .slice(0, MAX_UNIVERSE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watchlist.join(","), extraSymbols.join(","), earningsTickers.join(",")]
  );

  const load = useCallback(async () => {
    if (universe.length === 0) return;
    try {
      setQuotes(await fetchQuotes(universe));
      setUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [universe]);

  useEffect(() => {
    void load();
  }, [load]);
  useVisibleInterval(() => void load(), REFRESH_MS);

  const extended = quotes.filter(
    (q) => q.extended && q.price >= MIN_PRICE && (q.marketCap ?? 0) >= MIN_MARKET_CAP
  );
  const session = extended.some((q) => q.extended?.session === "pre") ? "pre" : extended.length ? "post" : null;
  const inSession = extended.filter((q) => q.extended?.session === session);
  const byMove = [...inSession].sort(
    (a, b) => (b.extended?.changesPercentage ?? 0) - (a.extended?.changesPercentage ?? 0)
  );
  const gainers = byMove.filter((q) => (q.extended?.changesPercentage ?? 0) > 0).slice(0, 6);
  const losers = byMove
    .filter((q) => (q.extended?.changesPercentage ?? 0) < 0)
    .reverse()
    .slice(0, 6);
  const marketOpen = !loading && quotes.length > 0 && quotes.every((q) => q.session === "regular");
  const earningsSet = new Set(earningsTickers);

  const title =
    session === "post" ? "// After-Hours Movers" : "// Pre-Market Movers";

  const Column = ({ label, rows, up }: { label: string; rows: NormalizedQuote[]; up: boolean }) => (
    <div className="min-w-0">
      <p className={`mb-1.5 text-[10px] font-mono uppercase tracking-widest ${up ? "text-emerald-600" : "text-red-500"}`}>
        {label}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((q) => (
            <li key={q.symbol} className="flex items-center gap-2 text-xs font-mono">
              <button type="button" data-ticker={q.symbol} className="font-semibold hover:underline">
                {q.symbol}
              </button>
              {earningsSet.has(q.symbol) && (
                <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground" title="Reports earnings">
                  ER
                </span>
              )}
              <span className="flex-1" />
              <span className="tabular-nums text-muted-foreground">${fmtAmt(q.extended!.price, 2)}</span>
              <span className={`w-14 text-right tabular-nums ${up ? "text-emerald-600" : "text-red-500"}`}>
                {up ? "+" : ""}
                {q.extended!.changesPercentage.toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Sunrise className="w-3.5 h-3.5" />
          {title}
        </CardTitle>
        <DataAge at={updated} staleAfterMinutes={10} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-5 rounded" />
            ))}
          </div>
        ) : marketOpen ? (
          <p className="text-sm text-muted-foreground py-2">
            The regular session is open — see Market Movers. This panel fills in before the open and after the close.
          </p>
        ) : !session ? (
          <p className="text-sm text-muted-foreground py-2">No extended-hours trading data right now.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Column label="Gainers" rows={gainers} up />
              <Column label="Losers" rows={losers} up={false} />
            </div>
            <p className="mt-3 text-[10px] font-mono text-muted-foreground">
              {session === "post" ? "Last after-hours session" : "Vs. previous close"} · {inSession.length} of{" "}
              {universe.length} tracked names trading · ER = reports earnings next session
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PremarketMovers;
