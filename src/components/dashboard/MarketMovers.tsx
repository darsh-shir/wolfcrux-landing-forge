import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface MoverData {
  symbol: string;
  price: number;
  changesPercentage: number;
  image?: string;
  imageDark?: string;
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
  const columns = [
    {
      title: "Gainers",
      data: gainers.slice(0, 4),
      icon: <TrendingUp className="w-3.5 h-3.5 text-green-600" />,
      accentClass: "text-green-600",
      headerBg: "bg-green-500/10",
    },
    {
      title: "Losers",
      data: losers.slice(0, 4),
      icon: <TrendingDown className="w-3.5 h-3.5 text-red-600" />,
      accentClass: "text-red-600",
      headerBg: "bg-red-500/10",
    },
    {
      title: "Active",
      data: actives.slice(0, 4),
      icon: <Activity className="w-3.5 h-3.5 text-blue-600" />,
      accentClass: "text-blue-600",
      headerBg: "bg-blue-500/10",
    },
  ];

  if (loading) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base font-semibold text-foreground">
            Market Movers
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-px bg-border/40 rounded-lg overflow-hidden">
            {[0, 1, 2].map((col) => (
              <div key={col} className="bg-card space-y-px">
                <div className="h-7 bg-muted/40 animate-pulse" />
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 bg-muted/20 animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base font-semibold text-foreground">
          Market Movers
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Bloomberg-style dense grid */}
        <div className="grid grid-cols-3 gap-px bg-border/50 rounded-lg overflow-hidden">
          {columns.map((col) => (
            <div key={col.title} className="bg-card flex flex-col">
              {/* Column Header */}
              <div
                className={`${col.headerBg} px-3 py-1.5 flex items-center gap-1.5`}
              >
                {col.icon}
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                  {col.title}
                </span>
              </div>

              {/* Rows */}
              {col.data.map((item, idx) => {
                const isPositive = item.changesPercentage >= 0;
                return (
                  <div
                    key={item.symbol}
                    className={`px-3 py-2 flex items-center justify-between ${
                      idx % 2 === 0 ? "bg-muted/15" : "bg-card"
                    } hover:bg-muted/30 transition-colors`}
                  >
                    {/* Ticker */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.symbol}
                          className="w-4 h-4 rounded-sm object-contain shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                      <span className="text-xs font-bold text-foreground font-mono truncate">
                        {item.symbol}
                      </span>
                    </div>

                    {/* Price & Change */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">
                        {item.price.toFixed(2)}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono min-w-[52px] text-right ${col.accentClass}`}
                      >
                        {isPositive ? "+" : ""}
                        {item.changesPercentage.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketMovers;
