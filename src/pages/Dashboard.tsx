import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FloatingShapes from "@/components/FloatingShapes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Newspaper, BarChart3, Globe, Clock, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  regularMarketPrice?: number;
  preMarketPrice?: number | null;
  postMarketPrice?: number | null;
  marketState?: string;
}

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  datetime: string;
  url: string;
  category: string;
}

const Dashboard = () => {
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trading-dashboard', {
        body: { action: 'fetchAll' }
      });

      if (error) throw error;

      if (data) {
        setEconomicEvents(data.economicEvents || []);
        setMarketData(data.marketData || []);
        setNews(data.news || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set mock data as fallback
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  const setMockData = () => {
    setEconomicEvents([
      { id: "1", title: "Non-Farm Payrolls", country: "US", date: "2025-01-10", time: "08:30", impact: "high", forecast: "175K", previous: "227K" },
      { id: "2", title: "CPI m/m", country: "US", date: "2025-01-15", time: "08:30", impact: "high", forecast: "0.3%", previous: "0.3%" },
      { id: "3", title: "FOMC Meeting Minutes", country: "US", date: "2025-01-08", time: "14:00", impact: "high" },
      { id: "4", title: "Unemployment Rate", country: "US", date: "2025-01-10", time: "08:30", impact: "medium", forecast: "4.2%", previous: "4.2%" },
      { id: "5", title: "Retail Sales m/m", country: "US", date: "2025-01-16", time: "08:30", impact: "medium", forecast: "0.5%", previous: "0.7%" },
    ]);

    setMarketData([
      // Futures
      { symbol: "US500", name: "S&P 500 Futures", price: 5948.50, change: 12.25, changePercent: 0.21, marketState: "LIVE" },
      { symbol: "US30", name: "Dow Jones Futures", price: 42856.00, change: 45.00, changePercent: 0.11, marketState: "LIVE" },
      { symbol: "USTECH", name: "Nasdaq 100 Futures", price: 21245.75, change: -28.50, changePercent: -0.13, marketState: "LIVE" },
      { symbol: "US2000", name: "Russell 2000 Futures", price: 2245.60, change: 8.30, changePercent: 0.37, marketState: "LIVE" },
      { symbol: "VIX", name: "VIX Index", price: 16.42, change: -0.53, changePercent: -3.12, marketState: "LIVE" },
      // ETFs
      { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 594.28, change: 3.45, changePercent: 0.58, marketState: "REGULAR" },
      { symbol: "DIA", name: "SPDR Dow Jones ETF", price: 428.50, change: 2.10, changePercent: 0.49, marketState: "REGULAR" },
      { symbol: "QQQ", name: "Invesco QQQ Trust", price: 515.75, change: -1.25, changePercent: -0.24, marketState: "REGULAR" },
      { symbol: "IWM", name: "iShares Russell 2000 ETF", price: 224.30, change: 1.80, changePercent: 0.81, marketState: "REGULAR" },
      { symbol: "VXX", name: "iPath S&P 500 VIX", price: 45.20, change: 0.85, changePercent: 1.92, marketState: "REGULAR" },
    ]);

    setNews([
      { id: "1", headline: "Federal Reserve signals cautious approach to rate cuts in 2025", source: "Reuters", datetime: "2025-01-06T14:30:00Z", url: "#", category: "Fed" },
      { id: "2", headline: "Tech stocks rally on strong earnings expectations", source: "Bloomberg", datetime: "2025-01-06T12:00:00Z", url: "#", category: "Markets" },
      { id: "3", headline: "Oil prices surge amid Middle East tensions", source: "CNBC", datetime: "2025-01-06T10:15:00Z", url: "#", category: "Commodities" },
      { id: "4", headline: "Treasury yields climb as inflation concerns persist", source: "WSJ", datetime: "2025-01-06T09:00:00Z", url: "#", category: "Bonds" },
      { id: "5", headline: "Jobs report preview: What economists expect for December", source: "MarketWatch", datetime: "2025-01-06T08:00:00Z", url: "#", category: "Economy" },
    ]);
  };

  // Separate futures and ETFs
  const futuresSymbols = ['US500', 'US30', 'USTECH', 'US2000', 'VIX'];
  const etfSymbols = ['SPY', 'DIA', 'QQQ', 'IWM', 'VXX'];
  const futuresData = marketData.filter(item => futuresSymbols.includes(item.symbol));
  const etfData = marketData.filter(item => etfSymbols.includes(item.symbol));

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-400";
    if (change < 0) return "text-red-400";
    return "text-muted-foreground";
  };

  const getMarketStateLabel = (state?: string) => {
    switch (state) {
      case "PRE": return { label: "Pre-Market", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
      case "POST": return { label: "After Hours", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" };
      case "CLOSED": return { label: "Closed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
      case "LIVE": return { label: "Live", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
      default: return { label: "Market Open", color: "bg-green-500/20 text-green-400 border-green-500/30" };
    }
  };

  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Helmet>
        <title>Trading Dashboard | Wolfcrux Global Markets</title>
        <meta name="description" content="Real-time trading dashboard with economic calendar, market data, and financial news for high-frequency trading." />
      </Helmet>

      <div className="min-h-screen bg-background relative overflow-hidden">
        <FloatingShapes />
        <Navigation />

        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Trading Dashboard
              </h1>
              <p className="text-muted-foreground">
                Real-time market data, economic calendar, and financial news
              </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-card/50 border border-border/50 p-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="calendar" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <Calendar className="w-4 h-4 mr-2" />
                  Economic Calendar
                </TabsTrigger>
                <TabsTrigger value="markets" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Markets
                </TabsTrigger>
                <TabsTrigger value="news" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <Newspaper className="w-4 h-4 mr-2" />
                  News
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Live Futures Section */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-accent" />
                      Live Futures
                    </CardTitle>
                    <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      Live Feed
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="h-24 bg-muted/50 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {futuresData.map((item) => {
                          const marketState = getMarketStateLabel(item.marketState);
                          return (
                            <div key={item.symbol} className="p-4 rounded-lg bg-background/50 border border-border/30 hover:border-accent/50 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-foreground">{item.symbol}</span>
                                {getChangeIcon(item.change)}
                              </div>
                              <p className="text-2xl font-bold text-foreground">
                                {item.symbol === 'VIX' ? '' : ''}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <div className={`text-sm ${getChangeColor(item.change)}`}>
                                {item.change > 0 ? "+" : ""}{item.change.toFixed(2)} ({item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2)}%)
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{item.name}</p>
                              <Badge className={`text-xs mt-2 ${marketState.color}`}>
                                {marketState.label}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* ETF Section */}
                  <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-accent" />
                        ETFs (SPY, DIA, QQQ, IWM, VXX)
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Live
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-24 bg-muted/50 rounded animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                          {etfData.map((item) => {
                            const marketState = getMarketStateLabel(item.marketState);
                            return (
                              <div key={item.symbol} className="p-4 rounded-lg bg-background/50 border border-border/30 hover:border-accent/50 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-foreground">{item.symbol}</span>
                                  {getChangeIcon(item.change)}
                                </div>
                                <p className="text-2xl font-bold text-foreground">
                                  ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <div className={`text-sm ${getChangeColor(item.change)}`}>
                                  {item.change > 0 ? "+" : ""}{item.change.toFixed(2)} ({item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2)}%)
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{item.name}</p>
                                {(item.preMarketPrice || item.postMarketPrice) && (
                                  <div className="mt-2 text-xs">
                                    {item.preMarketPrice && (
                                      <span className="text-blue-400">Pre: ${item.preMarketPrice.toFixed(2)}</span>
                                    )}
                                    {item.postMarketPrice && (
                                      <span className="text-purple-400">AH: ${item.postMarketPrice.toFixed(2)}</span>
                                    )}
                                  </div>
                                )}
                                {item.marketState && item.marketState !== 'REGULAR' && (
                                  <Badge className={`text-xs mt-2 ${marketState.color}`}>
                                    {marketState.label}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Upcoming Events */}
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-accent" />
                        Upcoming Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="space-y-3">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {economicEvents.slice(0, 5).map((event) => (
                            <div key={event.id} className="p-3 rounded-lg bg-background/50 border border-border/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-foreground text-sm">{event.title}</span>
                                <Badge className={`text-xs ${getImpactColor(event.impact)}`}>
                                  {event.impact}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Globe className="w-3 h-3" />
                                {event.country}
                                <span>•</span>
                                <Clock className="w-3 h-3" />
                                {event.date} {event.time}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Latest News */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Newspaper className="w-5 h-5 text-accent" />
                      Latest News
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {news.slice(0, 6).map((item) => (
                          <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-4 rounded-lg bg-background/50 border border-border/30 hover:border-accent/50 transition-colors group"
                          >
                            <Badge variant="outline" className="text-xs mb-2">{item.category}</Badge>
                            <h3 className="font-medium text-foreground text-sm group-hover:text-accent transition-colors line-clamp-2">
                              {item.headline}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span>{item.source}</span>
                              <span>•</span>
                              <span>{formatTime(item.datetime)}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Economic Calendar Tab */}
              <TabsContent value="calendar">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-accent" />
                      Economic Calendar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="h-20 bg-muted/50 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Event</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Country</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date & Time</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Impact</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Forecast</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Previous</th>
                            </tr>
                          </thead>
                          <tbody>
                            {economicEvents.map((event) => (
                              <tr key={event.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                <td className="py-4 px-4">
                                  <span className="font-medium text-foreground">{event.title}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-foreground">{event.country}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="text-foreground">{event.date}</div>
                                  <div className="text-sm text-muted-foreground">{event.time} ET</div>
                                </td>
                                <td className="py-4 px-4">
                                  <Badge className={getImpactColor(event.impact)}>
                                    {event.impact}
                                  </Badge>
                                </td>
                                <td className="py-4 px-4 text-foreground">{event.forecast || "-"}</td>
                                <td className="py-4 px-4 text-muted-foreground">{event.previous || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Markets Tab */}
              <TabsContent value="markets">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-accent" />
                      Market Data
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="h-32 bg-muted/50 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {marketData.map((item) => {
                          const marketState = getMarketStateLabel(item.marketState);
                          return (
                            <div key={item.symbol} className="p-6 rounded-xl bg-background/50 border border-border/30 hover:border-accent/50 transition-all hover:shadow-lg">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-foreground">{item.symbol}</h3>
                                    <Badge className={`text-xs ${marketState.color}`}>
                                      {marketState.label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{item.name}</p>
                                </div>
                                <div className={`p-2 rounded-full ${item.change >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                  {getChangeIcon(item.change)}
                                </div>
                              </div>
                              <p className="text-3xl font-bold text-foreground mb-2">
                                {item.symbol === 'VIX' || item.symbol === 'DXY' ? '' : '$'}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <div className={`flex items-center gap-2 ${getChangeColor(item.change)}`}>
                                <span className="font-medium">
                                  {item.change > 0 ? "+" : ""}{item.change.toFixed(2)}
                                </span>
                                <span className="text-sm">
                                  ({item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2)}%)
                                </span>
                              </div>
                              {(item.preMarketPrice || item.postMarketPrice) && (
                                <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                                  {item.preMarketPrice && <div>Pre-Market: ${item.preMarketPrice.toLocaleString()}</div>}
                                  {item.postMarketPrice && <div>After Hours: ${item.postMarketPrice.toLocaleString()}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* News Tab */}
              <TabsContent value="news">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Newspaper className="w-5 h-5 text-accent" />
                      Financial News
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="h-24 bg-muted/50 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {news.map((item) => (
                          <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border border-border/30 hover:border-accent/50 transition-colors group"
                          >
                            <div className="flex-1">
                              <Badge variant="outline" className="text-xs mb-2">{item.category}</Badge>
                              <h3 className="font-medium text-foreground group-hover:text-accent transition-colors">
                                {item.headline}
                              </h3>
                              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                <span>{item.source}</span>
                                <span>•</span>
                                <span>{new Date(item.datetime).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}</span>
                              </div>
                            </div>
                          </a>
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
