import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Flame } from "lucide-react";

interface MoverData {
  symbol: string;
  name?: string;
  price: number;
  changesPercentage: number;
}

interface MarketMoversProps {
  gainers: MoverData[];
  losers: MoverData[];
  actives: MoverData[];
  loading: boolean;
}

const MoverRow = ({
  item,
  type,
}: {
  item: MoverData;
  type: "gainer" | "loser" | "active";
}) => {
  const isPositive = item.changesPercentage >= 0;

  const tint =
    type === "active"
      ? "border-blue-500/20 bg-blue-500/5"
      : isPositive
      ? "border-emerald-500/20 bg-emerald-500/5"
      : "border-red-500/20 bg-red-500/5";

  const textColor =
    type === "active"
      ? "text-blue-600"
      : isPositive
      ? "text-emerald-600"
      : "text-red-600";

  return (
    <div className={`relative px-2.5 py-2 rounded-md border ${tint} flex items-center gap-2`}>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-mono font-bold text-foreground truncate">
          {item.symbol}
        </span>
        {item.name && (
          <span className="text-[10px] text-muted-foreground truncate">
            {item.name}
          </span>
        )}
      </div>

      <div className="text-right">
        <p className="text-xs font-mono font-semibold text-foreground tabular-nums">
          ${item.price.toFixed(2)}
        </p>
        <p className={`text-[11px] font-mono font-bold tabular-nums ${textColor}`}>
          {isPositive ? "+" : ""}
          {item.changesPercentage.toFixed(2)}%
        </p>
      </div>
    </div>
  );
};

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
    accent,
  }: {
    title: string;
    icon: JSX.Element;
    data: MoverData[];
    type: "gainer" | "loser" | "active";
    accent: string;
  }) => (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2 pb-1.5 border-b ${accent}`}
      >
        {icon}
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold">
          {title}
        </span>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-shimmer h-12 rounded" />
          ))
        ) : data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No data.</p>
        ) : (
          data.map((item, i) => (
            <MoverRow key={item.symbol} item={item} rank={i} type={type} />
          ))
        )}
      </div>
    </div>
  );

  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Flame className="w-3.5 h-3.5" />
          // Market Movers
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Column
            title="Top Gainers"
            data={gainers}
            type="gainer"
            accent="border-emerald-500/30 text-emerald-700"
            icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          />

          <Column
            title="Top Losers"
            data={losers}
            type="loser"
            accent="border-red-500/30 text-red-700"
            icon={<TrendingDown className="w-4 h-4 text-red-600" />}
          />

          <Column
            title="Most Active"
            data={actives}
            type="active"
            accent="border-blue-500/30 text-blue-700"
            icon={<Activity className="w-4 h-4 text-blue-600" />}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketMovers;
