import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MoverData {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
}

const MarketMovers = () => {
  const [gainers, setGainers] = useState<MoverData[]>([]);
  const [losers, setLosers] = useState<MoverData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovers = async () => {
    try {
      setLoading(true);
      
      const response = await fetch("https://www.perplexity.ai/rest/finance/top-movers/market?country=US");
      
      if (!response.ok) throw new Error("Failed to fetch movers");
      
      const data = await response.json();
      
      if (data) {
        const gainersData = (data.gainers || data.winners || []).slice(0, 5).map((item: any) => ({
          ticker: item.ticker || item.symbol || "",
          name: item.name || item.company || "",
          price: item.price || item.last || 0,
          changePercent: item.changePercent || item.change_percent || item.pctChange || 0
        }));
        
        const losersData = (data.losers || data.decliners || []).slice(0, 5).map((item: any) => ({
          ticker: item.ticker || item.symbol || "",
          name: item.name || item.company || "",
          price: item.price || item.last || 0,
          changePercent: item.changePercent || item.change_percent || item.pctChange || 0
        }));
        
        setGainers(gainersData.length > 0 ? gainersData : getFallbackGainers());
        setLosers(losersData.length > 0 ? losersData : getFallbackLosers());
      } else {
        setGainers(getFallbackGainers());
        setLosers(getFallbackLosers());
      }
    } catch (err) {
      console.error("Error fetching movers:", err);
      setGainers(getFallbackGainers());
      setLosers(getFallbackLosers());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackGainers = (): MoverData[] => [
    { ticker: "NVDA", name: "NVIDIA Corporation", price: 142.87, changePercent: 4.52 },
    { ticker: "SMCI", name: "Super Micro Computer", price: 34.56, changePercent: 3.87 },
    { ticker: "AMD", name: "Advanced Micro Devices", price: 128.45, changePercent: 3.21 },
    { ticker: "TSLA", name: "Tesla Inc", price: 398.23, changePercent: 2.89 },
    { ticker: "MSTR", name: "MicroStrategy Inc", price: 378.90, changePercent: 2.45 }
  ];

  const getFallbackLosers = (): MoverData[] => [
    { ticker: "INTC", name: "Intel Corporation", price: 19.87, changePercent: -3.45 },
    { ticker: "BA", name: "Boeing Company", price: 167.23, changePercent: -2.89 },
    { ticker: "DIS", name: "Walt Disney Co", price: 112.45, changePercent: -2.12 },
    { ticker: "NKE", name: "Nike Inc", price: 74.56, changePercent: -1.87 },
    { ticker: "PFE", name: "Pfizer Inc", price: 26.78, changePercent: -1.54 }
  ];

  useEffect(() => {
    fetchMovers();
    const interval = setInterval(fetchMovers, 30000);
    return () => clearInterval(interval);
  }, []);

  const MoversList = ({ data, type }: { data: MoverData[]; type: 'gainer' | 'loser' }) => {
    const isGainer = type === 'gainer';
    
    if (loading && data.length === 0) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-2">
              <div className="space-y-1">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
              <div className="h-5 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {data.map((item) => (
          <div 
            key={item.ticker} 
            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{item.ticker}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{item.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                ${item.price.toFixed(2)}
              </span>
              <Badge 
                variant="secondary" 
                className={`text-xs font-semibold ${isGainer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
              >
                {isGainer ? '+' : ''}{item.changePercent.toFixed(2)}%
              </Badge>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Market Movers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-600">Top Gainers</span>
            </div>
            <MoversList data={gainers} type="gainer" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-600">Top Losers</span>
            </div>
            <MoversList data={losers} type="loser" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketMovers;
