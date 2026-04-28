import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EconomicEvent {
  id: number;
  event: string;
  country: string;
  category: string;
  impact: number;
  time: string;
  actual: string | null;
  prev: string;
  forecast: number | null;
  unit: string;
  currency: string;
}

interface EconomicOverviewProps {
  data: EconomicEvent[];
  loading: boolean;
}

const impactLabel = (impact: number) => {
  if (impact >= 3)
    return {
      text: "High",
      className: "bg-red-500/15 text-red-700 border-red-500/30",
      dot: "bg-red-500",
    };
  if (impact === 2)
    return {
      text: "Medium",
      className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      dot: "bg-amber-500",
    };
  return {
    text: "Low",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/50",
  };
};

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
};

const EconomicOverview = ({ data, loading }: EconomicOverviewProps) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = data.filter(
    (e) =>
      e.time?.slice(0, 10) === today &&
      e.country?.toLowerCase() === "us"
  );

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5" />
            // Economic Events Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton-shimmer h-4 w-full" />
                <div className="skeleton-shimmer h-3 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5" />
          // Economic Events Today
        </CardTitle>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {todayEvents.length} EVT
        </span>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {todayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No economic events scheduled for today
            </p>
          ) : (
            todayEvents.slice(0, 6).map((item, i) => {
              const impact = impactLabel(item.impact);
              return (
                <div
                  key={item.id}
                  className="border-l-2 border-border pl-3 py-2 hover:border-foreground transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground leading-snug truncate flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${impact.dot} ${
                          item.impact >= 3 ? "animate-pulse" : ""
                        }`}
                      />
                      {item.event}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 font-mono ${impact.className}`}
                    >
                      {impact.text}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="tabular-nums">{formatTime(item.time)}</span>
                    <span className="uppercase">{item.country}</span>
                    <span>{item.category}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs font-mono">
                    {item.forecast !== null && (
                      <span className="text-muted-foreground">
                        Fcst:{" "}
                        <span className="text-foreground font-medium">
                          {item.forecast}
                          {item.unit?.trim()}
                        </span>
                      </span>
                    )}
                    {item.prev && (
                      <span className="text-muted-foreground">
                        Prev:{" "}
                        <span className="text-foreground font-medium">
                          {item.prev}
                        </span>
                      </span>
                    )}
                    {item.actual !== null && (
                      <span className="text-muted-foreground">
                        Actl:{" "}
                        <span className="text-foreground font-bold">
                          {item.actual}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EconomicOverview;
