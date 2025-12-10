import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SectorData {
  name: string;
  changesPercentage: number;
}

interface SectorPerformanceProps {
  data: SectorData[];
  loading: boolean;
}

const SectorPerformance = ({ data, loading }: SectorPerformanceProps) => {
  const sectors = (
    data.length > 0
      ? data
      : [
          { name: "Technology", changesPercentage: 1.24 },
          { name: "Healthcare", changesPercentage: 0.87 },
          { name: "Financials", changesPercentage: 0.52 },
          { name: "Consumer Discretionary", changesPercentage: -0.34 },
          { name: "Communication Services", changesPercentage: 0.91 },
          { name: "Industrials", changesPercentage: -0.18 },
          { name: "Consumer Staples", changesPercentage: 0.23 },
          { name: "Energy", changesPercentage: -1.45 },
          { name: "Utilities", changesPercentage: 0.15 },
          { name: "Real Estate", changesPercentage: -0.67 },
          { name: "Materials", changesPercentage: -0.28 },
        ]
  ).sort((a, b) => b.changesPercentage - a.changesPercentage); // ✅ Most positive on top

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            US Equity Sectors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse flex items-center justify-between py-2"
              >
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          US Equity Sectors
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-1">
          {sectors.map((sector) => {
            const isPositive = sector.changesPercentage >= 0;

            return (
              <div
                key={sector.name}
                className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors
                  ${isPositive ? "bg-green-500/10" : "bg-red-500/10"}
                  hover:bg-muted/50`}
              >
                <div className="flex items-center gap-2">
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}

                  <span className="text-sm font-medium text-foreground">
                    {sector.name}
                  </span>
                </div>

                <span
                  className={`text-sm font-semibold ${
                    isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {sector.changesPercentage.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SectorPerformance;
