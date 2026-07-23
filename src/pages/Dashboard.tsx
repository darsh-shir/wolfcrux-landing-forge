import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Scissors, Newspaper, Calendar, Users, CalendarClock, LineChart, Activity } from "lucide-react";

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
}

interface SectorData {
  name: string;
  changesPercentage: number;
  ticker?: string;
}

interface MoverData {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
}

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
  const [loadingNews, setLoadingNews] = useState(true);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [newsSymbol, setNewsSymbol] = useState<string>("");


  const [economicEvents, setEconomicEvents] = useState<any[]>([]);
  const [economicLoading, setEconomicLoading] = useState(true);
  const fetchEconomicCalendar = async () => {
    try {
      setEconomicLoading(true);
      const url = encodeURIComponent(
        "https://tr-cdn.tipranks.com/calendars/prod/calendars/economic/payload.json"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      const events = data?.EconomicCalenderViewModel?.data?.economicCalenderData?.events || [];
      setEconomicEvents(events);
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
        if (!q) {
          return { symbol: sym, name: INDEX_MAP[sym], price: 0, change: 0, changesPercentage: 0, history: [] };
        }
        const isClosed = q?.isMarketOpen === false;
        const pp = q?.prePostMarket;
        const price = isClosed && pp?.price ? Number(pp.price) : Number(q.price);
        const change = isClosed && pp ? Number(pp.changeAmount) : Number(q.changeAmount);
        const changePct = isClosed && pp ? Number(pp.changePercent) : Number(q.changePercent);
        return {
          symbol: sym,
          name: INDEX_MAP[sym],
          price: isFinite(price) ? price : 0,
          change: isFinite(change) ? change : 0,
          changesPercentage: isFinite(changePct) ? changePct : 0,
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
        // Prefer pre/post-market change if market is closed and pre/post data exists
        const mapped = quotes.map((q) => {
          const usePrePost =
            !q.isMarketOpen &&
            q.prePostMarket &&
            typeof q.prePostMarket.changePercent === "number";
          const changesPercentage = usePrePost
            ? q.prePostMarket.changePercent
            : q.changePercent;
          return {
            name: SECTOR_MAP[q.ticker] || q.ticker,
            ticker: q.ticker,
            changesPercentage: Number(changesPercentage) || 0,
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
      const a = extract(results[2]).map(mapRow).sort((x, y) => Math.abs(y.changesPercentage) - Math.abs(x.changesPercentage));
      setGainers(g);
      setLosers(l);
      setActives(a);
      try { localStorage.setItem("wolfcrux-movers-cache", JSON.stringify({ date: new Date().toDateString(), g, l, a })); } catch {}
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
  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchSentiment(),
      fetchIndices(),
      fetchSectors(),
      fetchNews(),
      fetchEconomicCalendar(),
    ]);
    setLastUpdated(new Date());
  }, []);

  /* ===================== AUTO REFRESH ===================== */
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ===================== MOVERS — ONCE PER DAY ===================== */
  useEffect(() => {
    try {
      const cached = localStorage.getItem("wolfcrux-movers-cache");
      if (cached) {
        const { date, g, l, a } = JSON.parse(cached);
        if (date === new Date().toDateString()) {
          setGainers(g);
          setLosers(l);
          setActives(a);
          setLoadingMovers(false);
          return;
        }
      }
    } catch {}
    fetchMovers();
  }, []);

  /* ===================== SENTIMENT 10s REFRESH ===================== */
  useEffect(() => {
    const sentimentInterval = setInterval(fetchSentiment, 10000);
    return () => clearInterval(sentimentInterval);
  }, [fetchSentiment]);

  /* ===================== TICKER WATCHLIST ===================== */
  const {
    quotes: tickerItems,
    loading: loadingTicker,
    userSymbols,
    addSymbol,
    removeSymbol,
  } = useTickerWatchlist();

  return (
    <>
      <Helmet>
        <title>Trading Terminal | Wolfcrux</title>
        <meta
          name="description"
          content="Live US market terminal: indices, sectors, movers, news, earnings, and economic calendar."
        />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col relative">
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
            <MarketClock />
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
                <SectorPerformance
                  data={sectors}
                  loading={loadingSectors}
                />

                <MarketMovers
                  gainers={gainers}
                  losers={losers}
                  actives={actives}
                  loading={loadingMovers}
                />
              </div>

              <EconomicOverview data={economicEvents} loading={economicLoading} />

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
              <EconomicCalendar data={economicEvents} loading={economicLoading} />
            </TabsContent>

            {/* ================= COMPARE STOCKS TAB ================= */}
            <TabsContent value="compare" className="mt-6 tab-anim">
              <CompareStocks />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
};

export default Dashboard;
