import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Calendar, Clock, Globe, TrendingUp, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Dashboard components
import IndexCards from "@/components/dashboard/IndexCards";
import SectorPerformance from "@/components/dashboard/SectorPerformance";
import MarketMovers from "@/components/dashboard/MarketMovers";
import MarketNews from "@/components/dashboard/MarketNews";
import StockSplits from "@/components/dashboard/StockSplits";

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
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchEconomicEvents();
  }, []);

  const fetchEconomicEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trading-dashboard', {
        body: { action: 'fetchAll' }
      });

      if (error) throw error;

      if (data?.economicEvents) {
        setEconomicEvents(data.economicEvents);
      }
    } catch (error) {
      console.error('Error fetching economic events:', error);
      setEconomicEvents([
        { id: "1", title: "Non-Farm Payrolls", country: "US", date: "2025-01-10", time: "08:30", impact: "high", forecast: "175K", previous: "227K" },
        { id: "2", title: "CPI m/m", country: "US", date: "2025-01-15", time: "08:30", impact: "high", forecast: "0.3%", previous: "0.3%" },
        { id: "3", title: "FOMC Meeting Minutes", country: "US", date: "2025-01-08", time: "14:00", impact: "high" },
        { id: "4", title: "Unemployment Rate", country: "US", date: "2025-01-10", time: "08:30", impact: "medium", forecast: "4.2%", previous: "4.2%" },
        { id: "5", title: "Retail Sales m/m", country: "US", date: "2025-01-16", time: "08:30", impact: "medium", forecast: "0.5%", previous: "0.7%" },
      ]);
    } finally {
      setLoading(false);
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
                <IndexCards />

                {/* Row 2: Sector Performance & Market Movers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SectorPerformance />
                  <MarketMovers />
                </div>

                {/* Row 3: News & Stock Splits */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MarketNews />
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
                    {loading ? (
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
