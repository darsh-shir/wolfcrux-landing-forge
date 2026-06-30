import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { formatIndian } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { fetchPerplexityEarnings } from "@/lib/earnings";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

interface TipRanksStock {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  change: { percent: number; amount: number };
  earning: {
    isConfirm: boolean;
    reportOnTimeOfDay: string; // "PreMarket" | "AfterHours"
    value: number; // EPS estimate
    lastYearValue: number;
    fiscalPeriod: number;
    fiscalYear: number;
    salesEstimate: number;
    lowEstimateEps: number;
    highEstimateEps: number;
    reportedEPS: number | null;
  };
  analystRatings: {
    consensus: {
      id: string;
      buy: number;
      sell: number;
      hold: number;
      total: number;
      priceTarget: { value: number };
    };
  };
  smartScore: { value: number };
}

interface CalendarDay {
  date: string;
  count: number;
  topFollowedTickers: string[];
}

interface EarningsDayData {
  date: string;
  count: number;
  stocks: TipRanksStock[];
}

const formatDisplayDate = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatHeaderDate = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const formatMarketCap = (mc: number) => {
  if (!mc) return "—";
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(2)}M`;
  if (mc >= 1e3) return `${(mc / 1e3).toFixed(2)}K`;
  return mc.toFixed(0);
};

const formatSalesEstimate = (s: number) => {
  if (!s) return "—";
  if (s >= 1e12) return `$${(s / 1e12).toFixed(2)}T`;
  if (s >= 1e9) return `$${(s / 1e9).toFixed(2)}B`;
  if (s >= 1e6) return `$${(s / 1e6).toFixed(2)}M`;
  if (s >= 1e3) return `$${(s / 1e3).toFixed(2)}K`;
  return `$${s.toFixed(0)}`;
};

const getSessionLabel = (timeOfDay: string) => {
  if (timeOfDay === "PreMarket") return "PRE";
  if (timeOfDay === "AfterHours") return "POST";
  return "N/A";
};

const getConsensusColor = (id: string) => {
  if (id === "strongBuy") return "text-green-600 bg-green-50";
  if (id === "moderateBuy") return "text-green-500 bg-green-50/50";
  if (id === "hold") return "text-yellow-600 bg-yellow-50";
  if (id === "moderateSell" || id === "strongSell") return "text-red-500 bg-red-50";
  return "text-muted-foreground bg-muted";
};

const getConsensusLabel = (id: string) => {
  const map: Record<string, string> = {
    strongBuy: "Strong Buy",
    moderateBuy: "Moderate Buy",
    hold: "Hold",
    moderateSell: "Moderate Sell",
    strongSell: "Strong Sell",
  };
  return map[id] || id;
};

const Earnings = () => {
  const [loading, setLoading] = useState(true);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dayData, setDayData] = useState<TipRanksStock[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [peersCache, setPeersCache] = useState<Record<string, { loading: boolean; data: any[] }>>({});


  const fetchPeers = useCallback(async (ticker: string) => {
    if (peersCache[ticker]) return;
    setPeersCache((p) => ({ ...p, [ticker]: { loading: true, data: [] } }));
    try {
      const url = `https://www.perplexity.ai/rest/finance/peers/${ticker}?version=2.18&source=default`;
      const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
      const json = await resp.json();
      const items = Array.isArray(json) ? json : [];
      items.sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
      setPeersCache((p) => ({ ...p, [ticker]: { loading: false, data: items } }));
    } catch (e) {
      console.error("Peers fetch failed", e);
      setPeersCache((p) => ({ ...p, [ticker]: { loading: false, data: [] } }));
    }
  }, [peersCache]);

  // Build a local 3-week window of dates (no overview API needed).
  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const days: CalendarDay[] = [];
      for (let i = -3; i <= 17; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        days.push({ date: d.toISOString().split("T")[0], count: 0, topFollowedTickers: [] });
      }
      setCalendarDays(days);
      setSelectedDate(todayStr);
    } catch (e) {
      console.error("Earnings calendar init failed", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific date's detailed data via Perplexity
  const fetchDateData = async (date: string) => {
    try {
      setDayLoading(true);
      const rows = await fetchPerplexityEarnings(date);
      setDayData(rows as unknown as TipRanksStock[]);
      // Update count for that day on the strip
      setCalendarDays((prev) =>
        prev.map((d) => (d.date === date ? { ...d, count: rows.length } : d))
      );
    } catch (e) {
      console.error("Earnings date fetch failed", e);
      setDayData([]);
    } finally {
      setDayLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  // When selected date changes, fetch that date's data
  useEffect(() => {
    if (selectedDate) {
      fetchDateData(selectedDate);
    }
  }, [selectedDate]);

  // Get nearby dates (2 weeks around today) for the date selector
  const visibleDates = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return calendarDays.filter((d) => {
      const diff = Math.abs(
        (new Date(d.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      );
      return diff <= 14;
    });
  }, [calendarDays]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const todayBtnRef = useRef<HTMLButtonElement>(null);

  // Center today's button in the horizontal scroller once the dates render
  useEffect(() => {
    if (!visibleDates.length) return;
    const container = dateScrollRef.current;
    const btn = todayBtnRef.current;
    if (!container || !btn) return;
    const target = btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, [visibleDates]);

  // Sort stocks by session: PRE first, then POST, secondary by market cap
  const sortedStocks = useMemo(() => {
    const arr = [...dayData];
    return arr.sort((a, b) => {
      const sessionRank = (s: string) =>
        s === "PreMarket" ? 1 : s === "AfterHours" ? 2 : 3;
      const rankDiff =
        sessionRank(a.earning?.reportOnTimeOfDay) -
        sessionRank(b.earning?.reportOnTimeOfDay);
      if (rankDiff !== 0) return rankDiff;
      return (b.marketCap || 0) - (a.marketCap || 0);
    });
  }, [dayData]);

  // Group by session
  const grouped = useMemo(() => {
    const base: Record<string, TipRanksStock[]> = {
      PreMarket: [],
      AfterHours: [],
      Other: [],
    };
    sortedStocks.forEach((s) => {
      const session = s.earning?.reportOnTimeOfDay || "Other";
      if (base[session]) base[session].push(s);
      else base.Other.push(s);
    });
    return base;
  }, [sortedStocks]);

  const renderStock = (s: TipRanksStock, idx: number, keyPrefix = "") => {
    const key = `${keyPrefix}${s.ticker}-${idx}`;
    const isExpanded = expandedSymbol === key;
    const consensus = s.analystRatings?.consensus;
    const earning = s.earning;
    const isPositive = (s.change?.percent ?? 0) >= 0;
    const stripe = isPositive ? "bg-emerald-500/70" : "bg-red-500/70";
    const seq = String(idx + 1).padStart(2, "0");

    return (
      <div
        key={key}
        className="relative rounded-md border border-border/60 bg-card hover:bg-muted/30 transition-colors animate-fade-in"
        style={{ animationDelay: `${idx * 35}ms` }}
      >
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe} rounded-l-md`} />
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          onClick={() => {
            const next = isExpanded ? null : key;
            setExpandedSymbol(next);
            if (next) fetchPeers(s.ticker);
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60 hidden sm:inline">
              {seq}
            </span>
            <div className="min-w-0">
              <p className="font-mono font-semibold text-sm flex items-center gap-2">
                {s.ticker}
                <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono uppercase tracking-wider">
                  {getSessionLabel(earning?.reportOnTimeOfDay)}
                </span>
                {earning?.isConfirm && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[9px] font-mono uppercase tracking-wider">
                    Conf
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{s.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs font-mono">
              <div className="text-muted-foreground tracking-wider">
                Q{earning?.fiscalPeriod}'{String(earning?.fiscalYear).slice(2)} · {formatMarketCap(s.marketCap)}
              </div>
              {s.price > 0 && (
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className="tabular-nums">${s.price?.toFixed(2)}</span>
                  <span className={`tabular-nums font-semibold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}
                    {(s.change?.percent * 100).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-3 pt-0 border-t border-border/50 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">// EPS Est</p>
                <p className="font-mono font-semibold tabular-nums">${earning?.value?.toFixed(2)}</p>
                <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  ${earning?.lowEstimateEps?.toFixed(2)} – ${earning?.highEstimateEps?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">// LY EPS</p>
                <p className="font-mono font-semibold tabular-nums">${earning?.lastYearValue?.toFixed(2)}</p>
                {earning?.value && earning?.lastYearValue ? (
                  <p className={`font-mono text-[10px] tabular-nums ${earning.value > earning.lastYearValue ? "text-emerald-600" : "text-red-500"}`}>
                    {earning.value > earning.lastYearValue ? "↑" : "↓"}{" "}
                    {(((earning.value - earning.lastYearValue) / earning.lastYearValue) * 100).toFixed(1)}% YoY
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">// Revenue</p>
                <p className="font-mono font-semibold tabular-nums">{formatSalesEstimate(earning?.salesEstimate || 0)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">// Smart</p>
                <p className="font-mono font-semibold tabular-nums">{s.smartScore?.value || "—"}/10</p>
              </div>
            </div>

            {/* Peers */}
            <div className="pt-3 mt-1 border-t border-border/50">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                // Peers · {s.ticker}
              </p>
              {peersCache[s.ticker]?.loading ? (
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : peersCache[s.ticker]?.data.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {peersCache[s.ticker].data.slice(0, 12).map((p: any) => {
                    const pos = (p.changesPercentage ?? 0) >= 0;
                    return (
                      <div
                        key={p.symbol}
                        className="flex items-center gap-2 px-2 py-1 rounded border border-border/60 bg-muted/30 text-[11px] font-mono hover:bg-muted/60 transition-colors"
                      >
                        <span className="font-semibold">{p.symbol}</span>
                        <span className="text-muted-foreground tabular-nums">
                          ${p.price?.toFixed(2)}
                        </span>
                        <span className={`tabular-nums ${pos ? "text-emerald-600" : "text-red-500"}`}>
                          {pos ? "+" : ""}
                          {p.changesPercentage?.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : peersCache[s.ticker] ? (
                <p className="text-xs font-mono text-muted-foreground">// No peers</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> // Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-shimmer h-24 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" /> // Earnings Calendar
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* DATE SELECTOR */}
        <div ref={dateScrollRef} className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
          {visibleDates.map((d) => {
            const isToday = d.date === todayStr;
            return (
              <button
                key={d.date}
                ref={isToday ? todayBtnRef : undefined}
                onClick={() => setSelectedDate(d.date)}
                className={`px-3 py-2 rounded-md border text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-all ${
                  selectedDate === d.date
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : isToday
                    ? "bg-card text-foreground border-foreground/40 hover:border-foreground"
                    : "bg-card text-muted-foreground border-border/60 hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {isToday ? "TODAY · " : ""}{formatDisplayDate(d.date)}{d.count > 0 && <span className="opacity-60"> [{d.count}]</span>}
              </button>
            );
          })}
        </div>

        {/* COUNT */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            // {formatHeaderDate(selectedDate)} · {sortedStocks.length} Earnings
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {sortedStocks.length} / {dayData.length}
          </span>
        </div>

        {/* HEADER */}
        <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground border-b border-border/50 pb-2">
          // {formatHeaderDate(selectedDate)} · {sortedStocks.length} Earnings
        </h3>

        {dayLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {(["PreMarket", "AfterHours"] as const).map((session) => (
              <div key={session}>
                {grouped[session].length > 0 && (
                  <>
                    <div className="relative flex items-center py-3">
                      <div className="flex-grow border-t border-border/50" />
                      <span className="mx-3 text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
                        // {session === "PreMarket" ? "Pre-Market" : "After-Hours"}
                      </span>
                      <div className="flex-grow border-t border-border/50" />
                    </div>
                    <div className="space-y-2">
                      {grouped[session].map((s, i) => renderStock(s, i, `${session}-`))}
                    </div>
                  </>
                )}
              </div>
            ))}

            {sortedStocks.length === 0 && (
              <p className="text-center font-mono text-xs uppercase tracking-wider text-muted-foreground py-8">
                // No earnings scheduled
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Earnings;
