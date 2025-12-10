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

const Sparkline = ({
  data,
  isPositive,
  id,
}: {
  data: number[];
  isPositive: boolean;
  id: string;
}) => {
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
  const strokeColor = isPositive ? "#22c55e" : "#ef4444";

  const gradientId = `areaFill-${id}`;
  const shadowId = `shadow-${id}`;

  return (
    <svg width={width} height={height} className="mt-2">
      <defs>
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor={strokeColor}
            floodOpacity="0.28"
          />
        </filter>

        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area Fill */}
      <polygon fill={`url(#${gradientId})`} points={areaPoints} />

      {/* Line */}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        filter={`url(#${shadowId})`}
      />
    </svg>
  );
};

const IndexCards = ({ data, loading, lastUpdated, onRefresh }: IndexCardsProps) => {
  const nameMap: Record<string, string> = {
    ESUSD: "S&P Futures",
    NQUSD: "NASDAQ Fut.",
    YMUSD: "Dow Futures",
    "^VIX": "VIX",
    VIX: "VIX",
  };

  const indices = data.length > 0
    ? data.slice(0, 4).map(item => ({
        ...item,
        name: nameMap[item.symbol] || item.name,
      }))
    : [
        { symbol: "ESUSD", name: "S&P Futures", price: 6846.25, change: -2.25, changesPercentage: -0.03, history: [] },
        { symbol: "NQUSD", name: "NASDAQ Fut.", price: 25670.25, change: -29.5, changesPercentage: -0.11, history: [] },
        { symbol: "YMUSD", name: "Dow Futures", price: 47604, change: -9, changesPercentage: -0.02, history: [] },
        { symbol: "^VIX", name: "VIX", price: 16.93, change: 0.27, changesPercentage: 1.62, history: [] },
      ];

  if (loading && data.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-5 w-28 bg-muted rounded" />
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((index) => {
          const isPositive = index.changesPercentage >= 0;
          const percentValue = Math.abs(index.changesPercentage);

          return (
            <Card
              key={index.symbol}
              className="bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg font-semibold text-foreground">
                    {index.name}
                  </span>

                  <Badge
                    className={`text-xs font-semibold px-2 py-0.5 ${
                      isPositive
                        ? "bg-green-500/20 text-green-600 border-green-500/30"
                        : "bg-red-500/20 text-red-600 border-red-500/30"
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

                {/* Change */}
                <div className="flex justify-end mb-1">
                  <span
                    className={`text-sm font-medium ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {index.change.toFixed(2)}
                  </span>
                </div>

                {/* Sparkline */}
                {index.history && index.history.length > 0 && (
                  <Sparkline
                    data={index.history}
                    isPositive={isPositive}
                    id={index.symbol}
                  />
                )}

                {/* Price */}
                <p className="text-2xl font-bold text-foreground mt-2">
                  {index.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
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
