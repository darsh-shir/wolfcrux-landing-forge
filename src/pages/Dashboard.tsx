import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Scissors } from "lucide-react";

// Dashboard components
import IndexCards from "@/components/dashboard/IndexCards";
import SectorPerformance from "@/components/dashboard/SectorPerformance";
import MarketMovers from "@/components/dashboard/MarketMovers";
import MarketNews from "@/components/dashboard/MarketNews";
import StockSplits from "@/components/dashboard/StockSplits";

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

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  datetime: string;
  url: string;
  category?: string;
}

/* ===================== COMPONENT ===================== */

const Dashboard = () => {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [gainers, setGainers] = useState<MoverData[]>([]);
  const [losers, setLosers] = useState<MoverData[]>([]);
  const [actives, setActives] = useState<MoverData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  const [loadingIndices, setLoadingIndices] = useState(true);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

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
        const mapped: IndexData[] = items.map((item: any) => ({
          symbol: item.symbol || item.ticker || "",
          name: item.name || item.display_name || "",
          price: parseFloat(item.price || item.last_price || 0),
          change: parseFloat(item.change || 0),
          changesPercentage: parseFloat(item.changesPercentage || 0),
          history: (item.history || []).map((h: any) => h.close || 0),
        }));
        setIndices(mapped);
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
      const items = data?.data || data || [];

      if (Array.isArray(items)) {
        setNews(
          items.slice(0, 10).map((item: any, i: number) => ({
            id: String(i),
            headline: item.headline || item.title,
            source: item.source || item.publisher,
            datetime: item.datetime || new Date().toISOString(),
            url: item.url || "#",
            category: item.category,
          }))
        );
      }
    } catch (e) {
      console.error("News fetch failed", e);
    } finally {
      setLoadingNews(false);
    }
  };

  /* ===================== FETCH ALL ===================== */
  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchIndices(),
      fetchSectors(),
      fetchMovers(),
      fetchNews(),
    ]);
    setLastUpdated(new Date());
  }, []);

  /* ===================== AUTO REFRESH ===================== */
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000); // ✅ 10 seconds
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ===================== UI ===================== */
  return (
    <>
      <Helmet>
        <title>Trading Dashboard | Wolfcrux</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="pt-24 pb-16 px-4 max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>

              <TabsTrigger value="splits">
                <Scissors className="w-4 h-4 mr-2" />
                Stock Splits
              </TabsTrigger>
            </TabsList>

            {/* ================= OVERVIEW TAB ================= */}
            <TabsContent value="overview" className="space-y-6">
              <IndexCards
                data={indices}
                loading={loadingIndices}
                lastUpdated={lastUpdated}
                onRefresh={fetchAll}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MarketNews data={news} loading={loadingNews} />

                {/* ✅ OVERVIEW: ONLY 6 (COMPACT) */}
                <StockSplits limit={6} compact />
              </div>
            </TabsContent>

            {/* ================= FULL STOCK SPLITS TAB ================= */}
            <TabsContent value="splits" className="mt-6">
              {/* ✅ FULL DATA (NO LIMIT, FULL VIEW) */}
              <StockSplits />
            </TabsContent>
          </Tabs>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Dashboard;
