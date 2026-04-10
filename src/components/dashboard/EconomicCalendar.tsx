import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  description: string;
}

interface EconomicCalendarProps {
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
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const EconomicCalendar = ({ data, loading }: EconomicCalendarProps) => {
  const [impactFilter, setImpactFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return data
      .filter((e) => e.country?.toLowerCase() === "us")
      .filter((e) => {
        if (impactFilter !== "all" && e.impact !== Number(impactFilter)) return false;
        return true;
      });
  }, [data, impactFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const e of filtered) {
      const dateKey = e.time?.slice(0, 10) || "unknown";
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(e);
    }
    // sort each group by time
    for (const [, events] of map) {
      events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Economic Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-5 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Economic Calendar
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={impactFilter} onValueChange={setImpactFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impact</SelectItem>
                <SelectItem value="3">High</SelectItem>
                <SelectItem value="2">Medium</SelectItem>
                <SelectItem value="1">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No events match the selected filters
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([dateKey, events]) => {
              const today = new Date().toISOString().slice(0, 10);
              const isToday = dateKey === today;
              return (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold text-foreground">
                      {formatDate(dateKey + "T00:00:00")}
                    </h3>
                    {isToday && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                        Today
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">({events.length} events)</span>
                  </div>
                  <div className="space-y-2">
                    {events.map((item) => {
                      const impact = impactLabel(item.impact);
                      const isExpanded = expandedId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="border border-border/60 rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs text-muted-foreground font-mono shrink-0">
                                {formatTime(item.time)}
                              </span>
                              <span className="text-xs uppercase text-muted-foreground font-semibold shrink-0">
                                {item.country}
                              </span>
                              <h4 className="text-sm font-semibold text-foreground truncate">
                                {item.event}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${impact.className}`}>
                                {impact.text}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-muted-foreground">{item.category}</span>
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
                                Actual: <span className="text-foreground font-bold">{item.actual}</span>
                              </span>
                            )}
                          </div>
                          {isExpanded && item.description && (
                            <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                              {item.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EconomicCalendar;
