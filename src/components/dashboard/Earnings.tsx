import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

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
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`;
  return `${mc}`;
};

const formatSalesEstimate = (s: number) => {
  if (s >= 1e9) return `$${(s / 1e9).toFixed(1)}B`;
  if (s >= 1e6) return `$${(s / 1e6).toFixed(0)}M`;
  return `$${s}`;
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

  // Fetch calendar overview (dates + counts)
  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const url = `https://www.tipranks.com/calendars/earnings/${today}/payload.json`;
      const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
      const json = await resp.json();
      const days: CalendarDay[] = (json?.data?.calendarData || []).map((d: any) => ({
        date: d.date.split("T")[0],
        count: d.count || 0,
        topFollowedTickers: d.topFollowedTickers || [],
      }));
      setCalendarDays(days);

      // Auto-select today
      const todayEntry = days.find((d) => d.date === today);
      if (todayEntry) {
        setSelectedDate(today);
      } else if (days.length > 0) {
        // Find nearest future date with earnings
        const future = days.filter((d) => d.date >= today && d.count > 0);
        setSelectedDate(future.length > 0 ? future[0].date : days[0].date);
      }

      // Also load tableData from the same response for today
      const tableData = json?.data?.tableData || [];
      setDayData(tableData);
    } catch (e) {
      console.error("Earnings calendar fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific date's detailed data
  const fetchDateData = async (date: string) => {
    try {
      setDayLoading(true);
      const url = `https://www.tipranks.com/calendars/earnings/${date}/payload.json`;
      const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
      const json = await resp.json();
      setDayData(json?.data?.tableData || []);
    } catch (e) {
      console.error("Earnings date fetch failed", e);
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
      return diff <= 14 && d.count > 0;
    });
  }, [calendarDays]);

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

    return (
      <div key={key} className="rounded-lg border bg-card hover:bg-muted/50 transition-colors">
        <div
          className="flex items-center justify-between px-3 py-3 cursor-pointer"
          onClick={() => {
            const next = isExpanded ? null : key;
            setExpandedSymbol(next);
            if (next) fetchPeers(s.ticker);
          }}
        >
          <div className="flex items-center gap-3">
            <div>
              <p className="font-medium flex items-center gap-2">
                {s.ticker}
                <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold">
                  {getSessionLabel(earning?.reportOnTimeOfDay)}
                </span>
                {earning?.isConfirm && (
                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold">
                    Confirmed
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{s.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right text-xs text-muted-foreground">
              <span>Q{earning?.fiscalPeriod} '{String(earning?.fiscalYear).slice(2)}</span>
              <span className="ml-2">• {formatMarketCap(s.marketCap)}</span>
              <br />
              <span className={s.change?.percent >= 0 ? "text-green-600" : "text-red-500"}>
                {s.change?.percent >= 0 ? "+" : ""}
                {(s.change?.percent * 100).toFixed(2)}%
              </span>
              <span className="ml-1">${s.price?.toFixed(2)}</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-3 pt-0 border-t">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
              <div>
                <p className="text-muted-foreground">EPS Estimate</p>
                <p className="font-semibold">${earning?.value?.toFixed(2)}</p>
                <p className="text-muted-foreground">
                  Range: ${earning?.lowEstimateEps?.toFixed(2)} - ${earning?.highEstimateEps?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Year EPS</p>
                <p className="font-semibold">${earning?.lastYearValue?.toFixed(2)}</p>
                {earning?.value && earning?.lastYearValue ? (
                  <p className={earning.value > earning.lastYearValue ? "text-green-600" : "text-red-500"}>
                    {earning.value > earning.lastYearValue ? "↑" : "↓"}{" "}
                    {(((earning.value - earning.lastYearValue) / earning.lastYearValue) * 100).toFixed(1)}% YoY
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-muted-foreground">Revenue Est.</p>
                <p className="font-semibold">{formatSalesEstimate(earning?.salesEstimate || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Smart Score</p>
                <p className="font-semibold">{s.smartScore?.value || "—"}/10</p>
              </div>
            </div>

            {/* Analyst Ratings */}
            {consensus && (
              <div className="flex items-center gap-3 text-xs pt-2 border-t">
                <span
                  className={`px-2 py-1 rounded font-semibold ${getConsensusColor(consensus.id)}`}
                >
                  {getConsensusLabel(consensus.id)}
                </span>
                <span className="text-muted-foreground">
                  {consensus.buy}B / {consensus.hold}H / {consensus.sell}S
                </span>
                <span className="text-muted-foreground">
                  Target: ${consensus.priceTarget?.value?.toFixed(2)}
                </span>
                {s.price && consensus.priceTarget?.value ? (
                  <span
                    className={
                      consensus.priceTarget.value > s.price ? "text-green-600" : "text-red-500"
                    }
                  >
                    ({((consensus.priceTarget.value / s.price - 1) * 100).toFixed(1)}% upside)
                  </span>
                ) : null}
              </div>
            )}

            {/* Peers */}
            <div className="pt-3 mt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Peers of {s.ticker}
              </p>
              {peersCache[s.ticker]?.loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading peers…
                </div>
              ) : peersCache[s.ticker]?.data.length ? (
                <div className="flex flex-wrap gap-2">
                  {peersCache[s.ticker].data.slice(0, 12).map((p: any) => {
                    const pos = (p.changesPercentage ?? 0) >= 0;
                    return (
                      <div
                        key={p.symbol}
                        className="flex items-center gap-2 px-2 py-1 rounded border bg-muted/40 text-[11px]"
                      >
                        <span className="font-mono font-semibold">{p.symbol}</span>
                        <span className="text-muted-foreground">
                          ${p.price?.toFixed(2)}
                        </span>
                        <span className={pos ? "text-green-600" : "text-red-500"}>
                          {pos ? "+" : ""}
                          {p.changesPercentage?.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : peersCache[s.ticker] ? (
                <p className="text-xs text-muted-foreground">No peers found.</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Earnings Calendar
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* DATE SELECTOR */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {visibleDates.map((d) => (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              className={`px-3 py-2 rounded-lg border text-sm whitespace-nowrap ${
                selectedDate === d.date
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {formatDisplayDate(d.date)} ({d.count})
            </button>
          ))}
        </div>

        {/* HEADER */}
        <h3 className="text-md font-semibold text-muted-foreground border-b pb-2">
          {formatHeaderDate(selectedDate)} — {dayData.length} Earnings
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
                    <div className="relative flex items-center py-4">
                      <div className="flex-grow border-t" />
                      <span className="mx-4 text-xs font-semibold text-muted-foreground">
                        {session === "PreMarket" ? "PRE-MARKET" : "AFTER-HOURS"}
                      </span>
                      <div className="flex-grow border-t" />
                    </div>
                    <div className="space-y-2">
                      {grouped[session].map((s, i) => renderStock(s, i, `${session}-`))}
                    </div>
                  </>
                )}
              </div>
            ))}

            {sortedStocks.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No earnings scheduled for this date.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Earnings;
