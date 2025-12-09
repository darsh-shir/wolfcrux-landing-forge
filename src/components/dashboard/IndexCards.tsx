import { Card, CardContent } from "@/components/ui/card";
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
  data: IndexData[];
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

const IndexCards = ({ data, loading, lastUpdated, onRefresh }: IndexCardsProps) => {
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

  // Map indices to display format
  const nameMap: Record<string, string> = {
    "SPX": "S&P 500",
    "IXIC": "NASDAQ",
    "DJI": "Dow Jones",
    "VIX": "VIX",
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones",
    "^IXIC": "NASDAQ",
    "^VIX": "VIX"
  };

  const indices = data.length > 0 ? data.map(item => ({
    ...item,
    name: nameMap[item.symbol] || item.name,
    history: item.history?.length ? item.history : generateMockHistory(item.price)
  })) : [
    { symbol: "SPX", name: "S&P 500", price: 5948.71, change: 22.10, changePercent: 0.37, history: generateMockHistory(5948.71) },
    { symbol: "IXIC", name: "NASDAQ", price: 19480.91, change: 130.25, changePercent: 0.67, history: generateMockHistory(19480.91) },
    { symbol: "DJI", name: "Dow Jones", price: 42706.56, change: -83.44, changePercent: -0.19, history: generateMockHistory(42706.56) },
    { symbol: "VIX", name: "VIX", price: 17.42, change: -0.88, changePercent: -4.80, history: generateMockHistory(17.42) }
  ];

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

  if (loading && data.length === 0) {
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
            onClick={onRefresh} 
            className="p-1 hover:bg-muted rounded transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.slice(0, 4).map((index) => {
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
