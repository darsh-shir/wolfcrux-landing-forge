import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Scissors, Newspaper, Calendar, Users, CalendarClock, LineChart } from "lucide-react";

// Dashboard components
import IndexCards from "@/components/dashboard/IndexCards";
import SectorPerformance from "@/components/dashboard/SectorPerformance";
import MarketMovers from "@/components/dashboard/MarketMovers";
import MarketNews from "@/components/dashboard/MarketNews";
import StockSplits from "@/components/dashboard/StockSplits";
import MarketSentiment from "@/components/dashboard/MarketSentiment";
import NewsOverview from "@/components/dashboard/NewsOverview";
import Earnings from "@/components/dashboard/Earnings";
import Peers from "@/components/dashboard/Peers";
import EconomicOverview from "@/components/dashboard/EconomicOverview";
import EconomicCalendar from "@/components/dashboard/EconomicCalendar";
import EarningsOverview from "@/components/dashboard/EarningsOverview";

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
  const fetchIndices = async () => {
    try {
      setLoadingIndices(true);
      const url = encodeURIComponent(
        "https://www.perplexity.ai/rest/finance/top-indices/market?with_history=true&history_period=1d&country=US"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      const items = data?.data || data?.indices || data || [];

      if (Array.isArray(items)) {
        setIndices(
          items.map((item: any) => ({
            symbol: item.symbol || item.ticker || "",
            name: item.name || item.display_name || "",
            price: parseFloat(item.price || item.last_price || 0),
            change: parseFloat(item.change || 0),
            changesPercentage: parseFloat(item.changesPercentage || 0),
            history: (item.history || []).map((h: any) => h.close || 0),
          }))
        );
      }
    } catch (e) {
      console.error("Indices fetch failed", e);
    } finally {
      setLoadingIndices(false);
    }
  };

  /* ===================== FETCH SECTORS ===================== */
  const fetchSectors = async () => {
    try {
      setLoadingSectors(true);
      const url = encodeURIComponent(
        "https://www.perplexity.ai/rest/finance/equity-sectors"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();
      const items = data?.data || data || [];

      if (Array.isArray(items)) {
        const mapped = items.map((item: any) => ({
          name: item.name || item.sector || "",
          changesPercentage: parseFloat(item.changesPercentage || 0),
        }));

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

      const url = encodeURIComponent(
        "https://www.perplexity.ai/rest/finance/top-movers/market?country=US"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();

      setGainers((data?.gainers || []).slice(0, 5));
      setLosers((data?.losers || []).slice(0, 5));
      setActives((data?.actives || []).slice(0, 5));
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
        "https://www.perplexity.ai/rest/finance/general-news/market?country=US"
      );
      const response = await fetch(`${PROXY_URL}${url}`);
      const data = await response.json();

      setNewsPosts(data?.posts || []);
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
      fetchMovers(),
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

  /* ===================== SENTIMENT 10s REFRESH ===================== */
  useEffect(() => {
    const sentimentInterval = setInterval(fetchSentiment, 10000);
    return () => clearInterval(sentimentInterval);
  }, [fetchSentiment]);

  /* ===================== UI ===================== */
  return (
    <>
      <Helmet>
        <title>Trading Dashboard | Wolfcrux</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />

        <main className="pt-20 md:pt-24 pb-6 px-2 sm:px-4 max-w-7xl mx-auto flex-1 w-full">
          {/* Market Sentiment Header */}
          <div className="flex justify-between items-center mb-4">
            <MarketSentiment
              sentiment={sentiment?.sentiment || ""}
              marketStatus={sentiment?.market_status || ""}
              created={sentiment?.created || ""}
              loading={loadingSentiment}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-none">
              <TabsList className="w-max md:w-full md:justify-start px-2 sm:px-0">
                <TabsTrigger value="overview" className="whitespace-nowrap text-xs sm:text-sm">
                  <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
                  Overview
                </TabsTrigger>

                <TabsTrigger value="news" className="whitespace-nowrap text-xs sm:text-sm">
                  <Newspaper className="w-4 h-4 mr-1 sm:mr-2" />
                  News
                </TabsTrigger>

                <TabsTrigger value="splits" className="whitespace-nowrap text-xs sm:text-sm">
                  <Scissors className="w-4 h-4 mr-1 sm:mr-2" />
                  Stock Splits
                </TabsTrigger>

                <TabsTrigger value="earnings" className="whitespace-nowrap text-xs sm:text-sm">
                  <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                  Earnings
                </TabsTrigger>

                <TabsTrigger value="peers" className="whitespace-nowrap text-xs sm:text-sm">
                  <Users className="w-4 h-4 mr-1 sm:mr-2" />
                  Peers
                </TabsTrigger>

                <TabsTrigger value="economic" className="whitespace-nowrap text-xs sm:text-sm">
                  <CalendarClock className="w-4 h-4 mr-1 sm:mr-2" />
                  Economic Calendar
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ================= OVERVIEW TAB ================= */}
            <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <IndexCards
                data={indices}
                loading={loadingIndices}
                lastUpdated={lastUpdated}
                onRefresh={fetchAll}
              />

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
            <TabsContent value="news" className="mt-6">
              <MarketNews data={{ posts: newsPosts }} loading={loadingNews} />
            </TabsContent>

            {/* ================= FULL STOCK SPLITS TAB ================= */}
            <TabsContent value="splits" className="mt-6">
              <StockSplits />
            </TabsContent>

            {/* ================= EARNINGS TAB ================= */}
            <TabsContent value="earnings" className="mt-6">
              <Earnings />
            </TabsContent>

            {/* ================= PEERS TAB ================= */}
            <TabsContent value="peers" className="mt-6">
              <Peers />
            </TabsContent>

            {/* ================= ECONOMIC CALENDAR TAB ================= */}
            <TabsContent value="economic" className="mt-6">
              <EconomicCalendar data={economicEvents} loading={economicLoading} />
            </TabsContent>
          </Tabs>
        </main>

        
      </div>
    </>
  );
};

export default Dashboard;
