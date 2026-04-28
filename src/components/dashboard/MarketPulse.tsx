import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus, Activity, Gauge } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";

interface SectorData {
  name: string;
  changesPercentage: number;
}

interface MarketPulseProps {
  sectors: SectorData[];
  loading: boolean;
}

/**
 * Compact terminal "vitals" strip — derives advancers / decliners / breadth
 * directly from the sector feed so it always animates in sync with the rest
 * of the overview without any new fetches.
 */
const MarketPulse = ({ sectors, loading }: MarketPulseProps) => {
  const advancers = sectors.filter((s) => s.changesPercentage > 0).length;
  const decliners = sectors.filter((s) => s.changesPercentage < 0).length;
  const unchanged = sectors.filter((s) => s.changesPercentage === 0).length;
  const total = sectors.length || 1;
  const avg =
    sectors.reduce((acc, s) => acc + s.changesPercentage, 0) / total;
  const breadth = ((advancers - decliners) / total) * 100;

  const cells: {
    label: string;
    value: number;
    fmt: (n: number) => string;
    icon: JSX.Element;
    tone: string;
  }[] = [
    {
      label: "Advancers",
      value: advancers,
      fmt: (n) => Math.round(n).toString(),
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      tone: "text-emerald-600",
    },
    {
      label: "Decliners",
      value: decliners,
      fmt: (n) => Math.round(n).toString(),
      icon: <ArrowDownRight className="w-3.5 h-3.5" />,
      tone: "text-red-600",
    },
    {
      label: "Unchanged",
      value: unchanged,
      fmt: (n) => Math.round(n).toString(),
      icon: <Minus className="w-3.5 h-3.5" />,
      tone: "text-muted-foreground",
    },
    {
      label: "Avg Δ %",
      value: avg,
      fmt: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
      icon: <Activity className="w-3.5 h-3.5" />,
      tone: avg >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Breadth",
      value: breadth,
      fmt: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(0)}`,
      icon: <Gauge className="w-3.5 h-3.5" />,
      tone: breadth >= 0 ? "text-emerald-600" : "text-red-600",
    },
  ];

  return (
    <Card className="bg-card border border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
          {cells.map((c, i) => (
            <div
              key={c.label}
              className="px-3 py-2.5 flex items-center justify-between gap-3 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`${c.tone}`}>{c.icon}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground truncate">
                  {c.label}
                </span>
              </div>
              <span className={`font-mono font-bold tabular-nums text-sm ${c.tone}`}>
                {loading ? (
                  <span className="inline-block w-10 h-3 bg-muted rounded skeleton-shimmer" />
                ) : (
                  <AnimatedNumber value={c.value} format={c.fmt} resetKey={c.value} duration={900} />
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketPulse;
