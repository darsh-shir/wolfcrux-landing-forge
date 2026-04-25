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
  ).sort((a, b) => b.changesPercentage - a.changesPercentage);

  // Find the max absolute value for scaling bars
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.changesPercentage)), 0.01);

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
        <div className="space-y-1.5">
          {sectors.map((sector) => {
            const isPositive = sector.changesPercentage >= 0;
            const barWidth = (Math.abs(sector.changesPercentage) / maxAbs) * 100;

            return (
              <div
                key={sector.name}
                className="group relative flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                {/* Icon */}
                <div className="shrink-0">
                  {isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  )}
                </div>

                {/* Name */}
                <span className="text-sm font-medium text-foreground w-[160px] shrink-0 truncate">
                  {sector.name}
                </span>

                {/* Bar */}
                <div className="flex-1 h-5 bg-muted/40 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md transition-all duration-700 ease-out ${
                      isPositive
                        ? "bg-gradient-to-r from-green-500/60 to-green-500/90"
                        : "bg-gradient-to-r from-red-500/60 to-red-500/90"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Percentage */}
                <span
                  className={`text-sm font-bold tabular-nums w-[60px] text-right shrink-0 ${
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
