import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SectorData {
  name: string;
  lastPrice: number;
  changePercent: number;
}

interface SectorPerformanceProps {
  data: SectorData[];
  loading: boolean;
}

const SectorPerformance = ({ data, loading }: SectorPerformanceProps) => {
  const sectors = data.length > 0 ? data : [
    { name: "Technology", lastPrice: 3245.67, changePercent: 1.24 },
    { name: "Healthcare", lastPrice: 1523.89, changePercent: 0.87 },
    { name: "Financials", lastPrice: 892.45, changePercent: 0.52 },
    { name: "Consumer Discretionary", lastPrice: 1687.23, changePercent: -0.34 },
    { name: "Communication Services", lastPrice: 278.56, changePercent: 0.91 },
    { name: "Industrials", lastPrice: 1089.34, changePercent: -0.18 },
    { name: "Consumer Staples", lastPrice: 845.12, changePercent: 0.23 },
    { name: "Energy", lastPrice: 678.90, changePercent: -1.45 },
    { name: "Utilities", lastPrice: 389.67, changePercent: 0.15 },
    { name: "Real Estate", lastPrice: 256.78, changePercent: -0.67 },
    { name: "Materials", lastPrice: 534.21, changePercent: -0.28 }
  ].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">US Equity Sectors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between py-2">
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
        <CardTitle className="text-base font-semibold text-foreground">US Equity Sectors</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {sectors.map((sector) => {
            const isPositive = sector.changePercent >= 0;
            return (
              <div 
                key={sector.name} 
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium text-foreground">{sector.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {sector.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-sm font-semibold min-w-[60px] text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{sector.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SectorPerformance;
