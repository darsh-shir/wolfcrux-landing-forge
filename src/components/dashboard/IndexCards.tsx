import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  history?: number[];
}

interface IndexCardsProps {
  data: IndexData[];
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

const IndexCards = ({ data, loading, lastUpdated, onRefresh }: IndexCardsProps) => {
  // Map symbols to display names
  const nameMap: Record<string, string> = {
    "ESUSD": "S&P Futures",
    "NQUSD": "NASDAQ Futures",
    "YMUSD": "Dow Futures",
    "^VIX": "VIX",
    "VIX": "VIX",
    "SPX": "S&P 500",
    "IXIC": "NASDAQ",
    "DJI": "Dow Jones",
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones",
    "^IXIC": "NASDAQ"
  };

  const indices = data.length > 0 ? data.slice(0, 4).map(item => ({
    ...item,
    name: nameMap[item.symbol] || item.name
  })) : [
    { symbol: "ESUSD", name: "S&P Futures", price: 6846.25, change: -2.25, changesPercentage: -0.03, history: [] },
    { symbol: "NQUSD", name: "NASDAQ Futures", price: 25670.25, change: -29.5, changesPercentage: -0.11, history: [] },
    { symbol: "YMUSD", name: "Dow Futures", price: 47604, change: -9, changesPercentage: -0.02, history: [] },
    { symbol: "^VIX", name: "VIX", price: 16.93, change: 0.27, changesPercentage: 1.62, history: [] }
  ];

  const Sparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
    if (!data || data.length < 2) return null;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 160;
    const height = 40;
    const padding = 2;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(" ");
    
    return (
      <svg width={width} height={height} className="mt-3">
        <polyline
          fill="none"
          stroke={isPositive ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          opacity={0.8}
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
                <div className="h-5 w-28 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-10 w-full bg-muted rounded" />
                <div className="h-8 w-32 bg-muted rounded" />
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
        {indices.map((index) => {
          const isPositive = index.changesPercentage >= 0;
          const percentValue = Math.abs(index.changesPercentage);
          
          return (
            <Card key={index.symbol} className="bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* Header: Name + Percentage Badge */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg font-semibold text-foreground">{index.name}</span>
                  <Badge 
                    className={`text-xs font-semibold px-2 py-0.5 ${
                      isPositive 
                        ? 'bg-green-500/20 text-green-600 border-green-500/30' 
                        : 'bg-red-500/20 text-red-600 border-red-500/30'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {percentValue.toFixed(2)}%
                  </Badge>
                </div>
                
                {/* Symbol + Absolute Change */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{index.symbol}</span>
                  <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{index.change.toFixed(index.change < 10 ? 2 : 0)}
                  </span>
                </div>
                
                {/* Sparkline Chart */}
                {index.history && index.history.length > 0 && (
                  <Sparkline data={index.history} isPositive={isPositive} />
                )}
                
                {/* Price */}
                <p className="text-2xl font-bold text-foreground mt-2">
                  {index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default IndexCards;