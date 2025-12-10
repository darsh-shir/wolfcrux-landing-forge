import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface MoverData {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
}

interface MarketMoversProps {
  gainers: MoverData[];
  losers: MoverData[];
  actives: MoverData[];
  loading: boolean;
}

const MarketMovers = ({ gainers, losers, actives, loading }: MarketMoversProps) => {
  const defaultGainers: MoverData[] = [];
  const defaultLosers: MoverData[] = [];
  const defaultActives: MoverData[] = [];

  const displayGainers = gainers.length > 0 ? gainers : defaultGainers;
  const displayLosers = losers.length > 0 ? losers : defaultLosers;
  const displayActives = actives.length > 0 ? actives : defaultActives;

  const MoversList = ({
    data,
    type,
  }: {
    data: MoverData[];
    type: "gainer" | "loser" | "active";
  }) => {
    if (loading && data.length === 0) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-2">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {data.map((item) => {
          const isPositive = item.changesPercentage >= 0;

          return (
            <div
              key={item.symbol}
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors
                ${type === "gainer" ? "bg-green-500/10 hover:bg-green-500/20" : ""}
                ${type === "loser" ? "bg-red-500/10 hover:bg-red-500/20" : ""}
                ${type === "active" ? "bg-blue-500/10 hover:bg-blue-500/20" : ""}
              `}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">{item.symbol}</span>
                <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {item.name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)}
                </span>

                <Badge
                  variant="secondary"
                  className={`text-xs font-semibold
                    ${isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                  `}
                >
                  {isPositive ? "+" : ""}
                  {item.changesPercentage.toFixed(2)}%
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Market Movers
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* GAINERS */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-600">
                Top Gainers
              </span>
            </div>
            <MoversList data={displayGainers} type="gainer" />
          </div>

          {/* LOSERS */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-600">
                Top Losers
              </span>
            </div>
            <MoversList data={displayLosers} type="loser" />
          </div>

          {/* ACTIVES */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">
                Most Active
              </span>
            </div>
            <MoversList data={displayActives} type="active" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketMovers;
