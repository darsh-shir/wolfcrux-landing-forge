import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

interface EarningStock {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  change: { percent: number };
  earning: {
    reportOnTimeOfDay: string;
    value: number;
    lastYearValue: number;
    fiscalPeriod: number;
    fiscalYear: number;
    isConfirm: boolean;
  };
  analystRatings: {
    consensus: {
      id: string;
      priceTarget: { value: number };
    };
  };
}

const formatMC = (mc: number) => {
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
  return `${(mc / 1e6).toFixed(0)}M`;
};

const EarningsOverview = () => {
  const [stocks, setStocks] = useState<EarningStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
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

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const url = `https://www.tipranks.com/calendars/earnings/${today}/payload.json`;
        const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
        const json = await resp.json();
        const tableData: EarningStock[] = json?.data?.tableData || [];
        const sessionRank = (s: string) =>
          s === "PreMarket" ? 1 : s === "AfterHours" ? 2 : 3;
        const sorted = tableData
          .filter((s) =>
            s.earning?.reportOnTimeOfDay === "PreMarket" ||
            s.earning?.reportOnTimeOfDay === "AfterHours"
          )
          .sort((a, b) => {
            const r =
              sessionRank(a.earning?.reportOnTimeOfDay) -
              sessionRank(b.earning?.reportOnTimeOfDay);
            if (r !== 0) return r;
            return (b.marketCap || 0) - (a.marketCap || 0);
          });
        setStocks(sorted);
      } catch (e) {
        console.error("Earnings overview fetch failed", e);
      } finally {
        setLoading(false);
      }
    };
    fetchToday();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Today's Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stocks.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today's Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pre-market earnings today.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today's Pre-Market Earnings
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {stocks.length} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[420px] pr-3">
          <div className="space-y-2">
            {stocks.map((s) => {
              const isExpanded = expandedTicker === s.ticker;
              const peers = peersCache[s.ticker];
              return (
                <div
                  key={s.ticker}
                  className="rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer"
                    onClick={() => {
                      const next = isExpanded ? null : s.ticker;
                      setExpandedTicker(next);
                      if (next) fetchPeers(s.ticker);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{s.ticker}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                          {s.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-muted-foreground">${s.price?.toFixed(2)}</span>
                        <span
                          className={`flex items-center gap-0.5 ${
                            s.change?.percent >= 0 ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {s.change?.percent >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {Math.abs(s.change?.percent * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        EPS Est: ${s.earning?.value?.toFixed(2)} • {formatMC(s.marketCap)}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2 mt-2">
                        Peers of {s.ticker}
                      </p>
                      {peers?.loading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading peers…
                        </div>
                      ) : peers?.data.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {peers.data.slice(0, 12).map((p: any) => {
                            const pos = (p.changesPercentage ?? 0) >= 0;
                            return (
                              <div
                                key={p.symbol}
                                className="flex items-center gap-1.5 px-2 py-1 rounded border bg-background text-[10px]"
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
                      ) : peers ? (
                        <p className="text-xs text-muted-foreground">No peers found.</p>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default EarningsOverview;
