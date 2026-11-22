import { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Scissors, Newspaper, Calendar, Users, CalendarClock, LineChart, Activity, Search } from "lucide-react";
import { normalizeTipranksQuote, type ExtendedHoursQuote } from "@/lib/tipranksQuote";
import { fetchEconomicEvents, type EconomicEvent } from "@/lib/economic";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import DataAge from "@/components/dashboard/DataAge";
import { TerminalContext, type TerminalContextValue } from "@/components/dashboard/TerminalContext";
import TickerPanel from "@/components/dashboard/TickerPanel";
import TickerSearch, { useTickerSearchHotkeys } from "@/components/dashboard/TickerSearch";
import WatchlistPanel from "@/components/dashboard/WatchlistPanel";
import PremarketMovers from "@/components/dashboard/PremarketMovers";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";


// Dashboard components
import IndexCards from "@/components/dashboard/IndexCards";
import SectorPerformance from "@/components/dashboard/SectorPerformance";
import MarketMovers from "@/components/dashboard/MarketMovers";
import MarketNews from "@/components/dashboard/MarketNews";
import FinvizNews from "@/components/dashboard/FinvizNews";
import StockSplits from "@/components/dashboard/StockSplits";
import MarketSentiment from "@/components/dashboard/MarketSentiment";
import NewsOverview from "@/components/dashboard/NewsOverview";
import Earnings from "@/components/dashboard/Earnings";
import Peers from "@/components/dashboard/Peers";
import EconomicOverview from "@/components/dashboard/EconomicOverview";
import EconomicCalendar from "@/components/dashboard/EconomicCalendar";
import EarningsOverview from "@/components/dashboard/EarningsOverview";
import CompareStocks from "@/components/dashboard/CompareStocks";
import TickerTape from "@/components/dashboard/TickerTape";
import MarketClock from "@/components/dashboard/MarketClock";
import MarketPulse from "@/components/dashboard/MarketPulse";
import { useTickerWatchlist } from "@/hooks/useTickerWatchlist";
import SectorDetailDialog from "@/components/dashboard/SectorDetailDialog";

const PROXY_URL =
  "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

/* ===================== INTERFACES ===================== */

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  history?: number[];
  extended?: ExtendedHoursQuote | null;
  session?: "regular" | "closed";
}

interface SectorData {
  name: string;
  changesPercentage: number;
  ticker?: string;
  extended?: ExtendedHoursQuote | null;
}

interface MoverData {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  volume?: number;
}

/** How long Market Movers stay cached before refetching. */
const MOVERS_TTL_MS = 5 * 60_000;

interface SentimentData {
  sentiment: string;
  market_status: string;
  created: string;
}


/* ===================== COMPONENT ===================== */

const Dashboard = () => {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [selectedSector, setSelectedSector] = useState<SectorData | null>(null);
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [gainers, setGainers] = useState<MoverData[]>([]);
  const [losers, setLosers] = useState<MoverData[]>([]);
  const [actives, setActives] = useState<MoverData[]>([]);

  const [newsPosts, setNewsPosts] = useState<any[]>([]);

  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(true);

  const [loadingIndices, setLoadingIndices] = useState(true);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [moversUpdated, setMoversUpdated] = useState<Date | null>(null);
  const [loadingNews, setLoadingNews] = useState(true);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [newsSymbol, setNewsSymbol] = useState<string>("");


  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [economicLoading, setEconomicLoading] = useState(true);
  const [economicUpdated, setEconomicUpdated] = useState<Date | null>(null);
  const fetchEconomicCalendar = async () => {
    try {
      setEconomicLoading(true);
      setEconomicEvents(await fetchEconomicEvents());
      setEconomicUpdated(new Date());
    } catch (e) {
      console.error("Economic calendar fetch failed", e);
    } finally {
      setEconomicLoading(false);
    }
  };

  /* ===================== FETCH SENTIMENT ===================== */
  const fetchSentiment = useCallback(async () => {
    try {
      setLoadingSentiment(true);
      const url = encodeURIComponent(
        "https://www.perplexity.ai/rest/finance/market-sentiment/market?country=US"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      setSentiment({
        sentiment: data?.sentiment || "",
        market_status: data?.market_status || "",
        created: data?.created || "",
      });
    } catch (e) {
      console.error("Sentiment fetch failed", e);
    } finally {
      setLoadingSentiment(false);
    }
  }, []);

  /* ===================== FETCH INDICES ===================== */
  const INDEX_MAP: Record<string, string> = {
    SPY: "S&P 500",
    QQQ: "NASDAQ",
    DIA: "Dow Jones",
    VXX: "VIX",
  };

  const fetchIndices = async () => {
    try {
      setLoadingIndices(true);
      const tickers = Object.keys(INDEX_MAP).join("%2C");
      const url = encodeURIComponent(
        `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${tickers}`
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      const quotes: any[] = data?.quotes || [];

      const mapped = Object.keys(INDEX_MAP).map((sym) => {
        const q = quotes.find((x) => x?.ticker === sym);
        const n = q ? normalizeTipranksQuote(q) : null;
        if (!n) {
          return { symbol: sym, name: INDEX_MAP[sym], price: 0, change: 0, changesPercentage: 0, history: [] };
        }
        return {
          symbol: sym,
          name: INDEX_MAP[sym],
          price: n.price,
          change: n.change,
          changesPercentage: n.changesPercentage,
          extended: n.extended,
          session: n.session,
          history: [],
        };
      });


      setIndices(mapped);
    } catch (e) {
      console.error("Indices fetch failed", e);
    } finally {
      setLoadingIndices(false);
    }
  };


  /* ===================== FETCH SECTORS ===================== */
  const SECTOR_MAP: Record<string, string> = {
    XLK: "Technology",
    XLE: "Energy",
    XLY: "Consumer Discretionary",
    XLP: "Consumer Staples",
    XLC: "Communication Services",
    XLI: "Industrials",
    XLF: "Financials",
    XLU: "Utilities",
    XLB: "Materials",
    XLRE: "Real Estate",
    XLV: "Healthcare",
  };

  const fetchSectors = async () => {
    try {
      setLoadingSectors(true);
      const tickers = Object.keys(SECTOR_MAP).join("%2C");
      const url = encodeURIComponent(
        `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${tickers}`
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      const quotes: any[] = data?.quotes || [];

      if (Array.isArray(quotes) && quotes.length > 0) {
        // Regular-session move; any pre/after-hours move is kept separately in `extended`
        const mapped = quotes.map((q) => {
          const n = normalizeTipranksQuote(q);
          return {
            name: SECTOR_MAP[q.ticker] || q.ticker,
            ticker: q.ticker,
            changesPercentage: n?.changesPercentage ?? 0,
            extended: n?.extended ?? null,
          };
        });


        mapped.sort(
          (a, b) => Math.abs(b.changesPercentage) - Math.abs(a.changesPercentage)
        );

        setSectors(mapped);
      }
    } catch (e) {
      console.error("Sector fetch failed", e);
    } finally {
      setLoadingSectors(false);
    }
  };

  /* ===================== FETCH MOVERS ===================== */
  const fetchMovers = async () => {
    try {
      setLoadingMovers(true);

      const endpoints = [
        "https://tr-cdn.tipranks.com/research/prod/markets/top-gainers/payload.json",
        "https://tr-cdn.tipranks.com/research/prod/markets/top-losers/payload.json",
        "https://tr-cdn.tipranks.com/research/prod/markets/most-active-stocks/payload.json",
      ];

      const mapRow = (r: any): MoverData => ({
        symbol: r.ticker || r.symbol || "",
        name: r.name || r.fullName || "",
        price: parseFloat(r.price ?? 0),
        changesPercentage:
          (parseFloat(r?.change?.percent ?? r?.lastChange?.percent ?? 0)) * 100,
        volume: Number(r?.volume) || 0,
      });

      const extract = (data: any): any[] => {
        const container = data?.StocksOnTheMoveScreener?.data || data?.data || {};
        const firstArrayKey = Object.keys(container).find((k) =>
          Array.isArray(container[k])
        );
        return firstArrayKey ? container[firstArrayKey] : [];
      };

      const results = await Promise.all(
        endpoints.map((u) =>
          fetch(`${PROXY_URL}${encodeURIComponent(u)}`)
            .then((r) => r.json())
            .catch(() => ({}))
        )
      );

      const g = extract(results[0]).map(mapRow).sort((a, b) => b.changesPercentage - a.changesPercentage);
      const l = extract(results[1]).map(mapRow).sort((a, b) => a.changesPercentage - b.changesPercentage);
      // "Most active" = highest trading volume, not the biggest % move.
      const a = extract(results[2]).map(mapRow).sort((x, y) => (y.volume ?? 0) - (x.volume ?? 0));
      if (g.length + l.length + a.length === 0) throw new Error("Movers feed returned no rows");
      setGainers(g);
      setLosers(l);
      setActives(a);
      const at = Date.now();
      setMoversUpdated(new Date(at));
      try { localStorage.setItem("wolfcrux-movers-cache", JSON.stringify({ at, g, l, a })); } catch { /* storage unavailable */ }
    } catch (e) {
      console.error("Mover fetch failed", e);
    } finally {
      setLoadingMovers(false);
    }
  };

  /* ===================== FETCH NEWS ===================== */
  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const url = encodeURIComponent(
        "https://tr-cdn.tipranks.com/blog/prod/news/data/sideBarV2/payload.json"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      const items = data?.posts?.more || [];
      setNewsPosts(
        items.map((p: any) => ({
          title: p.title,
          description: p.description,
          timeAgo: p.timeAgo,
          date: p.date,
          link: p.link ? `https://www.tipranks.com${p.link}` : null,
          tickers: (p.stocks || []).map((s: any) => s.ticker).filter(Boolean),
          author: p.author?.name,
        }))
      );
    } catch (e) {
      console.error("News fetch failed", e);
    } finally {
      setLoadingNews(false);
    }
  };

  /* ===================== FETCH ALL ===================== */
  // Fast-moving data: quotes and headlines.
  const fetchAll = useCallback(async () => {
    await Promise.all([fetchIndices(), fetchSectors(), fetchNews()]);
    setLastUpdated(new Date());
  }, []);

  /* ===================== AUTO REFRESH =====================
   * Every refresh goes through the Cloudflare Worker (daily request limit), so
   * timers pause while the tab is hidden and slow data refreshes less often. */
  useEffect(() => {
    fetchAll();
    fetchSentiment();
    fetchEconomicCalendar();
  }, [fetchAll, fetchSentiment]);
  useVisibleInterval(fetchAll, 30_000);
  useVisibleInterval(fetchSentiment, 60_000);
  useVisibleInterval(() => fetchEconomicCalendar(), 30 * 60_000);

  /* ===================== MOVERS — EVERY 5 MINUTES =====================
   * Previously fetched once per day, which froze the first snapshot of the day
   * (often pre-market) for the whole session. A short cache avoids refetching
   * when switching pages. */
  useEffect(() => {
    try {
      const cached = localStorage.getItem("wolfcrux-movers-cache");
      if (cached) {
        const { at, g, l, a } = JSON.parse(cached);
        if (typeof at === "number" && Date.now() - at < MOVERS_TTL_MS) {
          setGainers(g);
          setLosers(l);
          setActives(a);
          setMoversUpdated(new Date(at));
          setLoadingMovers(false);
          return;
        }
      }
    } catch {
      /* storage unavailable or old cache format */
    }
    fetchMovers();
  }, []);
  useVisibleInterval(() => fetchMovers(), MOVERS_TTL_MS);

  /* ===================== TICKER WATCHLIST ===================== */
  const {
    quotes: tickerItems,
    loading: loadingTicker,
    userSymbols,
    addSymbol,
    removeSymbol,
  } = useTickerWatchlist();

  /* ===================== TICKER PANEL, SEARCH, ALERTS ===================== */
  const [panelSymbol, setPanelSymbol] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { alerts, addAlert, removeAlert } = usePriceAlerts();
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useTickerSearchHotkeys(openSearch);

  const terminal = useMemo<TerminalContextValue>(
    () => ({
      openTicker: (s: string) => setPanelSymbol(s.trim().toUpperCase()),
      openSearch,
      watchlist: userSymbols,
      addToWatchlist: addSymbol,
      removeFromWatchlist: removeSymbol,
      alerts,
      addAlert,
      removeAlert,
    }),
    [openSearch, userSymbols, addSymbol, removeSymbol, alerts, addAlert, removeAlert]
  );

  // Any element marked data-ticker="XYZ" opens the ticker panel. Captured here
  // so a ticker inside a clickable row opens the panel instead of the row.
  const onTickerClickCapture = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-ticker]");
    const sym = el?.dataset.ticker;
    if (!sym) return;
    e.preventDefault();
    e.stopPropagation();
    setPanelSymbol(sym.toUpperCase());
  };

  return (
    <TerminalContext.Provider value={terminal}>
      <Helmet>
        <title>Trading Terminal | Wolfcrux</title>
        <meta
          name="description"
          content="Live US market terminal: indices, sectors, movers, news, earnings, and economic calendar."
        />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col relative" onClickCapture={onTickerClickCapture}>
        {/* Subtle terminal grid backdrop */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at top, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, black 30%, transparent 75%)",
          }}
        />

        <Navigation />

        {/* Ticker tape — sits flush under the nav */}
        <div className="pt-16 md:pt-20 relative z-20">
          <TickerTape
            items={tickerItems}
            loading={loadingTicker}
            onAdd={addSymbol}
            onRemove={removeSymbol}
            userSymbols={userSymbols}
          />
        </div>

        <main className="relative z-10 pb-10 px-2 sm:px-4 max-w-7xl mx-auto flex-1 w-full animate-fade-in">
          {/* Terminal status bar */}
          <div className="mt-3 sm:mt-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              Wolfcrux Terminal
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={openSearch}
                className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                aria-label="Search tickers"
              >
                <Search className="h-3.5 w-3.5" />
                Ticker lookup
                <kbd className="hidden sm:inline rounded border border-border px-1 text-[10px]">/</kbd>
              </button>
              <MarketClock />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-none">
              <TabsList className="w-max md:w-full md:justify-start px-2 sm:px-0 bg-muted/40 border border-border/50">
                <TabsTrigger value="overview" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
                  Overview
                </TabsTrigger>

                <TabsTrigger value="news" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <Newspaper className="w-4 h-4 mr-1 sm:mr-2" />
                  News
                </TabsTrigger>

                <TabsTrigger value="splits" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <Scissors className="w-4 h-4 mr-1 sm:mr-2" />
                  Splits
                </TabsTrigger>

                <TabsTrigger value="earnings" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                  Earnings
                </TabsTrigger>

                <TabsTrigger value="peers" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <Users className="w-4 h-4 mr-1 sm:mr-2" />
                  Peers
                </TabsTrigger>

                <TabsTrigger value="economic" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <CalendarClock className="w-4 h-4 mr-1 sm:mr-2" />
                  Economic
                </TabsTrigger>

                <TabsTrigger value="compare" className="whitespace-nowrap text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 hover:text-foreground data-[state=active]:shadow-sm">
                  <LineChart className="w-4 h-4 mr-1 sm:mr-2" />
                  Compare
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ================= OVERVIEW TAB ================= */}
            <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6 tab-anim">
              <IndexCards
                data={indices}
                loading={loadingIndices}
                lastUpdated={lastUpdated}
                onRefresh={fetchAll}
              />

              <MarketPulse sectors={sectors} loading={loadingSectors} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
                <WatchlistPanel quotes={tickerItems} loading={loadingTicker} />
                <PremarketMovers
                  extraSymbols={[...gainers.slice(0, 20), ...losers.slice(0, 20), ...actives.slice(0, 20)].map((m) => m.symbol)}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
                <SectorPerformance
                  data={sectors}
                  loading={loadingSectors}
                  onSelect={(s) => {
                    setSelectedSector(s);
                    setSectorDialogOpen(true);
                  }}
                />

                <MarketMovers
                  gainers={gainers}
                  losers={losers}
                  actives={actives}
                  loading={loadingMovers}
                  updatedAt={moversUpdated}
                />
              </div>

              <EconomicOverview data={economicEvents} loading={economicLoading} updatedAt={economicUpdated} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <NewsOverview data={newsPosts} loading={loadingNews} />
                <EarningsOverview />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <StockSplits limit={6} compact />
              </div>
            </TabsContent>

            {/* ================= MARKET NEWS TAB ================= */}
            <TabsContent value="news" className="mt-6 tab-anim space-y-6">
              <FinvizNews onSymbolSubmit={setNewsSymbol} />
              <MarketNews data={{ posts: newsPosts }} loading={loadingNews} externalSymbol={newsSymbol} />

            </TabsContent>

            {/* ================= FULL STOCK SPLITS TAB ================= */}
            <TabsContent value="splits" className="mt-6 tab-anim">
              <StockSplits />
            </TabsContent>

            {/* ================= EARNINGS TAB ================= */}
            <TabsContent value="earnings" className="mt-6 tab-anim">
              <Earnings />
            </TabsContent>

            {/* ================= PEERS TAB ================= */}
            <TabsContent value="peers" className="mt-6 tab-anim">
              <Peers />
            </TabsContent>

            {/* ================= ECONOMIC CALENDAR TAB ================= */}
            <TabsContent value="economic" className="mt-6 tab-anim">
              <EconomicCalendar data={economicEvents} loading={economicLoading} updatedAt={economicUpdated} />
            </TabsContent>

            {/* ================= COMPARE STOCKS TAB ================= */}
            <TabsContent value="compare" className="mt-6 tab-anim">
              <CompareStocks />
            </TabsContent>
          </Tabs>
        </main>
      </div>
      <SectorDetailDialog
        open={sectorDialogOpen}
        onOpenChange={setSectorDialogOpen}
        ticker={selectedSector?.ticker ?? null}
        sectorName={selectedSector?.name ?? null}
        changePct={selectedSector?.changesPercentage}
      />
      <TickerPanel symbol={panelSymbol} onClose={() => setPanelSymbol(null)} />
      <TickerSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPick={(sym) => setPanelSymbol(sym)}
        watchlist={userSymbols}
      />
    </TerminalContext.Provider>
  );
};

export default Dashboard;
