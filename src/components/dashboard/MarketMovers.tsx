import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const MarketMovers = ({
  gainers,
  losers,
  actives,
  loading,
}: MarketMoversProps) => {
  const Column = ({
    title,
    icon,
    data,
    type,
  }: {
    title: string;
    icon: JSX.Element;
    data: MoverData[];
    type: "gainer" | "loser" | "active";
  }) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>

        {loading ? (
          [...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-muted/40 animate-pulse"
            />
          ))
        ) : (
          data.map((item) => {
            const isPositive = item.changesPercentage >= 0;

            const tint =
              type === "active"
                ? "bg-blue-500/10 border-blue-500/20"
                : isPositive
                ? "bg-green-500/10 border-green-500/20"
                : "bg-red-500/10 border-red-500/20";

            const textColor =
              type === "active"
                ? "text-blue-600"
                : isPositive
                ? "text-green-600"
                : "text-red-600";

            return (
              <div
                key={item.symbol}
                className={`p-3 rounded-xl border ${tint} hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {item.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {item.name}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      ${item.price.toFixed(2)}
                    </p>
                    <p className={`text-xs font-semibold ${textColor}`}>
                      {isPositive ? "+" : ""}
                      {item.changesPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-foreground">
          Market Movers
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Column
            title="Top Gainers"
            data={gainers}
            type="gainer"
            icon={<TrendingUp className="w-4 h-4 text-green-600" />}
          />

          <Column
            title="Top Losers"
            data={losers}
            type="loser"
            icon={<TrendingDown className="w-4 h-4 text-red-600" />}
          />

          <Column
            title="Most Active"
            data={actives}
            type="active"
            icon={<Activity className="w-4 h-4 text-blue-600" />}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketMovers;
