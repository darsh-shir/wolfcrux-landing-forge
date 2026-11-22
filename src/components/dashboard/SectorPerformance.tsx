import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import ExtendedHoursBadge from "@/components/dashboard/ExtendedHoursBadge";
import type { ExtendedHoursQuote } from "@/lib/tipranksQuote";

interface SectorData {
  name: string;
  changesPercentage: number;
  ticker?: string;
  extended?: ExtendedHoursQuote | null;
}

interface SectorPerformanceProps {
  data: SectorData[];
  loading: boolean;
  onSelect?: (sector: SectorData) => void;
}

const SectorPerformance = ({ data, loading, onSelect }: SectorPerformanceProps) => {
  // Never show placeholder numbers: an empty feed renders an explicit message.
  const sectors = [...data].sort((a, b) => b.changesPercentage - a.changesPercentage);

  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.changesPercentage)), 0.01);

  // Bar fill-in: start at 0, then animate to actual width on mount/data change
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    setFilled(false);
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [data.length, data.map((d) => d.changesPercentage).join(",")]);

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            // US Equity Sectors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="skeleton-shimmer h-4 w-32" />
                <div className="skeleton-shimmer h-4 w-16" />
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
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Layers className="w-3.5 h-3.5" />
          // US Equity Sectors
        </CardTitle>
      </CardHeader>

      <CardContent>
        {sectors.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sector data is unavailable right now.
          </p>
        )}
        <div className="space-y-1">
          {sectors.map((sector, i) => {
            const isPositive = sector.changesPercentage >= 0;
            const barWidth = (Math.abs(sector.changesPercentage) / maxAbs) * 100;

            return (
              <button
                type="button"
                key={sector.name}
                onClick={() => onSelect?.(sector)}
                className="w-full text-left group relative flex items-center gap-2 sm:gap-3 py-1.5 px-2 sm:px-3 rounded-md hover:bg-muted/40 transition-colors animate-fade-in cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="shrink-0">
                  {isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  )}
                </div>

                <span className="text-xs sm:text-sm font-medium text-foreground w-[110px] sm:w-[160px] shrink-0 truncate">
                  {sector.name}
                </span>

                <div className="flex-1 min-w-0 h-4 sm:h-5 bg-muted/40 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md transition-[width] duration-1000 ease-out ${
                      isPositive
                        ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/90"
                        : "bg-gradient-to-r from-red-500/60 to-red-500/90"
                    }`}
                    style={{
                      width: filled ? `${barWidth}%` : "0%",
                      transitionDelay: `${i * 50}ms`,
                    }}
                  />
                  {/* sweep highlight */}
                  <div
                    className="pointer-events-none absolute inset-y-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                </div>

                <span
                  className={`text-xs sm:text-sm font-mono font-bold tabular-nums w-[60px] sm:w-[68px] text-right shrink-0 ${
                    isPositive ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  <AnimatedNumber
                    value={sector.changesPercentage}
                    format={(n) => `${n.toFixed(2)}%`}
                    resetKey={sector.changesPercentage}
                    duration={900}
                  />
                </span>
                {sector.extended && (
                  <ExtendedHoursBadge extended={sector.extended} className="hidden sm:inline-flex shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SectorPerformance;
