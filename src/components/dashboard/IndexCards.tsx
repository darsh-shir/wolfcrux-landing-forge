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
  const nameMap: Record<string, string> = {
    ESUSD: "S&P Futures",
    NQUSD: "NASDAQ Fut.",
    YMUSD: "Dow Futures",
    "^VIX": "VIX",
    VIX: "VIX",
  };

  const indices =
    data.length > 0
      ? data.slice(0, 4).map((item) => ({
          ...item,
          name: nameMap[item.symbol] || item.name,
        }))
      : [
          { symbol: "ESUSD", name: "S&P Futures", price: 6841.75, change: -6.5, changesPercentage: -0.09, history: [] },
          { symbol: "NQUSD", name: "NASDAQ Fut.", price: 25652.25, change: -47.5, changesPercentage: -0.18, history: [] },
          { symbol: "YMUSD", name: "Dow Futures", price: 47561, change: -52, changesPercentage: -0.11, history: [] },
          { symbol: "^VIX", name: "VIX", price: 17.41, change: 0.48, changesPercentage: 2.84, history: [] },
        ];

  // ✅ Sparkline with SHADOW + AREA FILL
  const Sparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const width = 150;
    const height = 40;
    const padding = 2;

    const points = data
      .map((value, index) => {
        const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((value - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
      })
      .join(" ");

    const areaPoints = `${points} ${width},${height} 0,${height}`;

    const strokeColor = isPositive ? "#0ea5a4" : "#ef4444";

    return (
      <svg width={width} height={height} className="mt-2">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={strokeColor} floodOpacity="0.25" />
          </filter>

          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area Fill */}
        <polygon fill="url(#areaFill)" points={areaPoints} />

        {/* Line with shadow */}
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          filter="url(#shadow)"
        />
      </svg>
    );
  };

  if (loading && data.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-3 animate-pulse">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="h-8 w-full bg-muted rounded" />
              <div className="h-6 w-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">US Indices</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-muted rounded transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((index) => {
          const isPositive = index.changesPercentage >= 0;

          return (
            <Card
              key={index.symbol}
              className="bg-card border border-border shadow-sm hover:shadow-md transition-all rounded-xl"
            >
              <CardContent className="p-4">
                {/* Top Row */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{index.name}</p>

                  {/* ✅ TRUE NEGATIVE SIGN SHOWN */}
                  <Badge
                    className={`text-xs px-2 py-0.5 ${
                      isPositive
                        ? "bg-green-500/15 text-green-600 border-green-500/30"
                        : "bg-red-500/15 text-red-600 border-red-500/30"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {index.changesPercentage.toFixed(2)}%
                  </Badge>
                </div>

                {/* Sparkline */}
                {index.history && index.history.length > 0 && (
                  <Sparkline data={index.history} isPositive={isPositive} />
                )}

                {/* Bottom Row */}
                <div className="flex items-end justify-between mt-2">
                  <p className="text-xl font-bold text-foreground">
                    {index.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>

                  {/* ✅ TRUE NEGATIVE SIGN SHOWN */}
                  <p
                    className={`text-sm font-medium ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {index.change.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default IndexCards;
