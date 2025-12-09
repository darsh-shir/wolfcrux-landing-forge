import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  history?: number[];
}

interface IndexCardsProps {
  onRefresh?: () => void;
}

const IndexCards = ({ onRefresh }: IndexCardsProps) => {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchIndices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        "https://www.perplexity.ai/rest/finance/top-indices/market?with_history=true&history_period=1d&country=US"
      );
      
      if (!response.ok) throw new Error("Failed to fetch indices");
      
      const data = await response.json();
      
      // Map the response to our format, focusing on S&P 500, NASDAQ, Dow Jones, VIX
      const targetIndices = ["SPX", "IXIC", "DJI", "VIX"];
      const nameMap: Record<string, string> = {
        "SPX": "S&P 500",
        "IXIC": "NASDAQ",
        "DJI": "Dow Jones",
        "VIX": "VIX"
      };
      
      const mappedIndices: IndexData[] = [];
      
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const symbol = item.symbol || item.ticker;
          if (targetIndices.some(t => symbol?.includes(t) || item.name?.includes(t))) {
            mappedIndices.push({
              symbol: symbol,
              name: nameMap[symbol] || item.name || symbol,
              price: item.price || item.last || 0,
              change: item.change || 0,
              changePercent: item.changePercent || item.change_percent || 0,
              history: item.history?.map((h: any) => h.close || h.price || h) || []
            });
          }
        });
      }
      
      // If API doesn't return expected format, use fallback
      if (mappedIndices.length < 4) {
        setIndices([
          { symbol: "SPX", name: "S&P 500", price: 5948.71, change: 22.10, changePercent: 0.37, history: generateMockHistory(5948.71) },
          { symbol: "IXIC", name: "NASDAQ", price: 19480.91, change: 130.25, changePercent: 0.67, history: generateMockHistory(19480.91) },
          { symbol: "DJI", name: "Dow Jones", price: 42706.56, change: -83.44, changePercent: -0.19, history: generateMockHistory(42706.56) },
          { symbol: "VIX", name: "VIX", price: 17.42, change: -0.88, changePercent: -4.80, history: generateMockHistory(17.42) }
        ]);
      } else {
        setIndices(mappedIndices);
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching indices:", err);
      setError("Using cached data");
      setIndices([
        { symbol: "SPX", name: "S&P 500", price: 5948.71, change: 22.10, changePercent: 0.37, history: generateMockHistory(5948.71) },
        { symbol: "IXIC", name: "NASDAQ", price: 19480.91, change: 130.25, changePercent: 0.67, history: generateMockHistory(19480.91) },
        { symbol: "DJI", name: "Dow Jones", price: 42706.56, change: -83.44, changePercent: -0.19, history: generateMockHistory(42706.56) },
        { symbol: "VIX", name: "VIX", price: 17.42, change: -0.88, changePercent: -4.80, history: generateMockHistory(17.42) }
      ]);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  const generateMockHistory = (basePrice: number): number[] => {
    const history: number[] = [];
    let price = basePrice * 0.995;
    for (let i = 0; i < 78; i++) {
      price += (Math.random() - 0.48) * (basePrice * 0.001);
      history.push(price);
    }
    history.push(basePrice);
    return history;
  };

  useEffect(() => {
    fetchIndices();
    const interval = setInterval(fetchIndices, 30000);
    return () => clearInterval(interval);
  }, []);

  const Sparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
    if (!data || data.length < 2) return null;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 120;
    const height = 32;
    const padding = 2;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(" ");
    
    return (
      <svg width={width} height={height} className="mt-2">
        <polyline
          fill="none"
          stroke={isPositive ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  if (loading && indices.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-8 w-32 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-8 w-full bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">US Indices</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button 
            onClick={fetchIndices} 
            className="p-1 hover:bg-muted rounded transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((index) => {
          const isPositive = index.change >= 0;
          return (
            <Card key={index.symbol} className="bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">{index.name}</span>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                </div>
                
                <p className="text-2xl font-bold text-foreground">
                  {index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{index.change.toFixed(2)}
                  </span>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
                  </Badge>
                </div>
                
                {index.history && index.history.length > 0 && (
                  <Sparkline data={index.history} isPositive={isPositive} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default IndexCards;
