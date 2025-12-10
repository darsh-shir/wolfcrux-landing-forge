import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors } from "lucide-react";

interface SplitData {
  companyName: string;
  ticker: string;
  splitType: string;   // "forward" | "reverse"
  splitRatio: string;  // e.g. "1 for 3.00" or "0.98 for 1"
  exDate: string;      // ISO date string from API
}

/**
 * StockSplits component
 *
 * Props:
 * - limit?: number -> when provided (e.g. 6) component shows the first `limit` items in the JSON order (overview)
 * - compact?: boolean -> when true, shows compact card list (overview)
 *
 * Behaviour:
 * - Keeps the original JSON order for the overview (no sorting)
 * - Split tab (full view) displays ALL items sorted ASCENDING by date (oldest -> newest)
 * - Shows split type (forward/reverse) using item.split.type from JSON
 */
interface StockSplitsProps {
  limit?: number;
  compact?: boolean;
}

const StockSplits = ({ limit, compact }: StockSplitsProps) => {
  const [splits, setSplits] = useState<SplitData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSplits = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "https://tr-cdn.tipranks.com/calendars/prod/calendars/stock-splits/upcoming/payload.json"
      );

      if (!response.ok) throw new Error("Failed to fetch splits");

      const json = await response.json();

      // RAW LIST exactly as provided in JSON
      const rawList = json?.StockSplitCalendar?.data?.list || [];

      // Map keeping the original rawList order (do NOT sort here)
      const mappedSplits: SplitData[] = rawList.map((item: any) => ({
        companyName: item.name || "",
        ticker: item.ticker || "",
        splitType: (item.split?.type || "").toString().toLowerCase(), // forward / reverse
        splitRatio: item.split?.ratio?.text || "",
        exDate: item.split?.date || "",
      }));

      // do not reorder mappedSplits here — keep JSON order for overview
      setSplits(mappedSplits);
    } catch (err) {
      console.error("Error fetching splits:", err);
      setSplits(getFallbackSplits());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackSplits = (): SplitData[] => [
    { companyName: "Broadcom Inc", ticker: "AVGO", splitType: "forward", splitRatio: "10:1", exDate: "2025-12-20" },
    { companyName: "Chipotle", ticker: "CMG", splitType: "forward", splitRatio: "50:1", exDate: "2025-12-22" },
    { companyName: "Walmart", ticker: "WMT", splitType: "forward", splitRatio: "3:1", exDate: "2025-12-28" },
  ];

  const formatDateShort = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  const daysUntil = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Tomorrow";
      return `${diff} days`;
    } catch {
      return "";
    }
  };

  useEffect(() => {
    fetchSplits();
    const interval = setInterval(fetchSplits, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Overview: keep JSON order and show first `limit` entries
  const overviewVisible = limit ? splits.slice(0, limit) : splits;

  // Full tab: show ALL entries sorted ascending by date (oldest first)
  const fullSortedAscending = [...splits].sort((a, b) => {
    const ta = a.exDate ? new Date(a.exDate).getTime() : 0;
    const tb = b.exDate ? new Date(b.exDate).getTime() : 0;
    return ta - tb;
  });

  /* ================= LOADING PLACEHOLDER ================= */
  if (loading && splits.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Upcoming Stock Splits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  /* ================= COMPACT OVERVIEW (first `limit` in JSON order) ================= */
  if (compact) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Recent Stock Splits
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {overviewVisible.map((split, idx) => {
            // display: date top, then row with ticker left and ratio + type right (compact)
            const isForward = (split.splitType || "").toLowerCase() === "forward";
            const badgeClass = isForward ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";

            return (
              <div key={idx} className="border rounded-lg p-3 bg-background/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{formatDateShort(split.exDate)}</div>
                    <div className="mt-1 font-bold text-foreground text-sm">{split.ticker}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{split.splitType}</div>
                    <div className="mt-1 font-semibold text-foreground">{split.splitRatio}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  /* ================= FULL SPLIT TAB (all, ascending by date) ================= */
  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Scissors className="w-4 h-4" />
          Upcoming Stock Splits
        </CardTitle>
      </CardHeader>

      <CardContent>
        {fullSortedAscending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No upcoming stock splits</p>
        ) : (
          <div className="space-y-3">
            {fullSortedAscending.map((split, idx) => {
              const isForward = (split.splitType || "").toLowerCase() === "forward";
              const badge = isForward ? "FORWARD" : "REVERSE";

              return (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">{formatDateShort(split.exDate)}</div>
                  <div className="mt-1 font-bold text-foreground text-base">{split.ticker}</div>
                  <div className="text-sm text-muted-foreground mt-1">{split.companyName}</div>

                  <div className="flex items-center justify-between mt-3">
                    <div className={`text-xs font-semibold uppercase ${isForward ? "text-green-600" : "text-red-600"}`}>
                      {badge}
                    </div>
                    <div className="font-semibold text-foreground">{split.splitRatio}</div>
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

export default StockSplits;
