import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Calendar, Clock, Globe } from "lucide-react";

// Dashboard components
import IndexCards from "@/components/dashboard/IndexCards";
import SectorPerformance from "@/components/dashboard/SectorPerformance";
import MarketMovers from "@/components/dashboard/MarketMovers";
import MarketNews from "@/components/dashboard/MarketNews";
import StockSplits from "@/components/dashboard/StockSplits";

const PROXY_URL = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

// Interfaces for API data
interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  history?: number[];
}

interface SectorData {
  name: string;
  lastPrice: number;
  changePercent: number;
}

interface MoverData {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
}

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  datetime: string;
  url: string;
  category?: string;
}

interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "high" | "medium" | "low";
  actual?: string;
  forecast?: string;
  previous?: string;
}

const Dashboard = () => {
  // Market data states
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [gainers, setGainers] = useState<MoverData[]>([]);
  const [losers, setLosers] = useState<MoverData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  
  // Loading states
  const [loadingIndices, setLoadingIndices] = useState(true);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  
  // Other states
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch indices data
  const fetchIndices = async () => {
    try {
      setLoadingIndices(true);
      const url = encodeURIComponent("https://www.perplexity.ai/rest/finance/top-indices/market?with_history=true&history_period=1d&country=US");
      const response = await fetch(`${PROXY_URL}${url}`);
      
      if (!response.ok) throw new Error("Failed to fetch indices");
      
      const data = await response.json();
      const items = data?.data || data?.indices || data || [];
      
      if (Array.isArray(items) && items.length > 0) {
        const mapped: IndexData[] = items.map((item: any) => ({
          symbol: item.symbol || item.ticker || "",
          name: item.name || item.display_name || "",
          price: parseFloat(item.price || item.last_price || item.current_price || 0),
          change: parseFloat(item.change || item.price_change || 0),
          changePercent: parseFloat(item.changePercent || item.percent_change || item.change_percent || 0),
          history: item.history || item.chart_data || []
        }));
        setIndices(mapped);
      }
    } catch (error) {
      console.error("Error fetching indices:", error);
    } finally {
      setLoadingIndices(false);
    }
  };

  // Fetch sectors data
  const fetchSectors = async () => {
    try {
      setLoadingSectors(true);
      const url = encodeURIComponent("https://www.perplexity.ai/rest/finance/equity-sectors");
      const response = await fetch(`${PROXY_URL}${url}`);
      
      if (!response.ok) throw new Error("Failed to fetch sectors");
      
      const data = await response.json();
      const items = data?.data || data?.sectors || data || [];
      
      if (Array.isArray(items) && items.length > 0) {
        const mapped: SectorData[] = items.map((item: any) => ({
          name: item.name || item.sector || "",
          lastPrice: parseFloat(item.lastPrice || item.last_price || item.price || 0),
          changePercent: parseFloat(item.changePercent || item.percent_change || item.change_percent || 0)
        }));
        // Sort by absolute change
        mapped.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
        setSectors(mapped);
      }
    } catch (error) {
      console.error("Error fetching sectors:", error);
    } finally {
      setLoadingSectors(false);
    }
  };

  // Fetch market movers data
  const fetchMovers = async () => {
    try {
      setLoadingMovers(true);
      const url = encodeURIComponent("https://www.perplexity.ai/rest/finance/top-movers/market?country=US");
      const response = await fetch(`${PROXY_URL}${url}`);
      
      if (!response.ok) throw new Error("Failed to fetch movers");
      
      const data = await response.json();
      
      const gainersData = data?.gainers || data?.data?.gainers || [];
      const losersData = data?.losers || data?.data?.losers || [];
      
      if (Array.isArray(gainersData) && gainersData.length > 0) {
        const mappedGainers: MoverData[] = gainersData.slice(0, 5).map((item: any) => ({
          ticker: item.ticker || item.symbol || "",
          name: item.name || item.company_name || "",
          price: parseFloat(item.price || item.last_price || 0),
          changePercent: parseFloat(item.changePercent || item.percent_change || item.change_percent || 0)
        }));
        setGainers(mappedGainers);
      }
      
      if (Array.isArray(losersData) && losersData.length > 0) {
        const mappedLosers: MoverData[] = losersData.slice(0, 5).map((item: any) => ({
          ticker: item.ticker || item.symbol || "",
          name: item.name || item.company_name || "",
          price: parseFloat(item.price || item.last_price || 0),
          changePercent: parseFloat(item.changePercent || item.percent_change || item.change_percent || 0)
        }));
        setLosers(mappedLosers);
      }
    } catch (error) {
      console.error("Error fetching movers:", error);
    } finally {
      setLoadingMovers(false);
    }
  };

  // Fetch news data
  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const url = encodeURIComponent("https://www.perplexity.ai/rest/finance/general-news/market?country=US");
      const response = await fetch(`${PROXY_URL}${url}`);
      
      if (!response.ok) throw new Error("Failed to fetch news");
      
      const data = await response.json();
      const items = data?.data || data?.news || data || [];
      
      if (Array.isArray(items) && items.length > 0) {
        const mapped: NewsItem[] = items.slice(0, 10).map((item: any, index: number) => ({
          id: item.id || String(index),
          headline: item.headline || item.title || "",
          source: item.source || item.publisher || "",
          datetime: item.datetime || item.published_at || item.date || new Date().toISOString(),
          url: item.url || item.link || "#",
          category: item.category || ""
        }));
        setNews(mapped);
      }
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoadingNews(false);
    }
  };

  // Fetch all market data
  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchIndices(),
      fetchSectors(),
      fetchMovers(),
      fetchNews()
    ]);
    setLastUpdated(new Date());
  }, []);

  // Fetch economic events
  const fetchEconomicEvents = async () => {
    setLoadingEvents(true);
    try {
      // Using fallback data for economic events
      setEconomicEvents([
        { id: "1", title: "Non-Farm Payrolls", country: "US", date: "2025-01-10", time: "08:30", impact: "high", forecast: "175K", previous: "227K" },
        { id: "2", title: "CPI m/m", country: "US", date: "2025-01-15", time: "08:30", impact: "high", forecast: "0.3%", previous: "0.3%" },
        { id: "3", title: "FOMC Meeting Minutes", country: "US", date: "2025-01-08", time: "14:00", impact: "high" },
        { id: "4", title: "Unemployment Rate", country: "US", date: "2025-01-10", time: "08:30", impact: "medium", forecast: "4.2%", previous: "4.2%" },
        { id: "5", title: "Retail Sales m/m", country: "US", date: "2025-01-16", time: "08:30", impact: "medium", forecast: "0.5%", previous: "0.7%" },
      ]);
    } catch (error) {
      console.error('Error fetching economic events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchAll();
    fetchEconomicEvents();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <>
      <Helmet>
        <title>Trading Dashboard | Wolfcrux Global Markets</title>
        <meta name="description" content="Real-time trading dashboard with live US market data, indices, sector performance, market movers, and financial news." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Trading Dashboard
              </h1>
              <p className="text-muted-foreground">
                Real-time US market data and financial insights
              </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-card border border-border/50 p-1 shadow-sm">
                <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Market Overview
                </TabsTrigger>
                <TabsTrigger value="calendar" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Economic Calendar
                </TabsTrigger>
              </TabsList>

              {/* Market Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Row 1: Index Cards */}
                <IndexCards 
                  data={indices} 
                  loading={loadingIndices} 
                  lastUpdated={lastUpdated} 
                  onRefresh={fetchAll} 
                />

                {/* Row 2: Sector Performance & Market Movers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SectorPerformance data={sectors} loading={loadingSectors} />
                  <MarketMovers gainers={gainers} losers={losers} loading={loadingMovers} />
                </div>

                {/* Row 3: News & Stock Splits */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MarketNews data={news} loading={loadingNews} />
                  <StockSplits />
                </div>
              </TabsContent>

              {/* Economic Calendar Tab */}
              <TabsContent value="calendar" className="space-y-6">
                <Card className="bg-card border border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Calendar className="w-5 h-5 text-accent" />
                      Upcoming Economic Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingEvents ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="h-20 bg-muted/50 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {economicEvents.map((event) => (
                          <div 
                            key={event.id} 
                            className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-foreground">{event.title}</span>
                                  <Badge className={`text-xs ${getImpactColor(event.impact)}`}>
                                    {event.impact}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Globe className="w-4 h-4" />
                                    {event.country}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {event.date} {event.time}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-4 text-sm">
                                {event.forecast && (
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Forecast</p>
                                    <p className="font-semibold text-foreground">{event.forecast}</p>
                                  </div>
                                )}
                                {event.previous && (
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Previous</p>
                                    <p className="font-semibold text-foreground">{event.previous}</p>
                                  </div>
                                )}
                                {event.actual && (
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Actual</p>
                                    <p className="font-semibold text-accent">{event.actual}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Dashboard;
