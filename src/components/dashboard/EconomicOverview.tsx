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
  if (impact >= 3) return { text: "High", className: "bg-destructive/15 text-destructive border-destructive/30" };
  if (impact === 2) return { text: "Medium", className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" };
  return { text: "Low", className: "bg-muted text-muted-foreground border-border" };
};

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
};

const EconomicOverview = ({ data, loading }: EconomicOverviewProps) => {
  // Filter to today's events only
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = data.filter((e) => e.time?.slice(0, 10) === today);

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Economic Events Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
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
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4" />
          Economic Events Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {todayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No economic events scheduled for today
            </p>
          ) : (
            todayEvents.slice(0, 6).map((item) => {
              const impact = impactLabel(item.impact);
              return (
                <div key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-foreground leading-snug truncate">
                      {item.event}
                    </h3>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${impact.className}`}>
                      {impact.text}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatTime(item.time)}</span>
                    <span className="uppercase">{item.country}</span>
                    <span>{item.category}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs">
                    {item.forecast !== null && (
                      <span className="text-muted-foreground">
                        Forecast: <span className="text-foreground font-medium">{item.forecast}{item.unit?.trim()}</span>
                      </span>
                    )}
                    {item.prev && (
                      <span className="text-muted-foreground">
                        Prev: <span className="text-foreground font-medium">{item.prev}</span>
                      </span>
                    )}
                    {item.actual !== null && (
                      <span className="text-muted-foreground">
                        Actual: <span className="text-foreground font-semibold">{item.actual}</span>
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
