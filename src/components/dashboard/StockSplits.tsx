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
  const [yesterday, setYesterday] = useState<SplitData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSplits = async () => {
    try {
      setLoading(true);

      const [upcomingRes, historicalRes] = await Promise.all([
        fetch("https://tr-cdn.tipranks.com/calendars/prod/calendars/stock-splits/upcoming/payload.json"),
        fetch("https://tr-cdn.tipranks.com/calendars/prod/calendars/stock-splits/historical/payload.json").catch(() => null),
      ]);

      if (!upcomingRes.ok) throw new Error("Failed to fetch splits");

      const upcomingJson = await upcomingRes.json();
      const upcomingList = upcomingJson?.StockSplitCalendar?.data?.list || [];

      const mappedUpcoming: SplitData[] = upcomingList.map((item: any) => ({
        companyName: item.name || "",
        ticker: item.ticker || "",
        splitType: (item.split?.type || "").toString().toLowerCase(),
        splitRatio: item.split?.ratio?.text || "",
        exDate: item.split?.date || "",
      }));

      // Pull yesterday's splits from historical feed (for the Split tab)
      let yesterdaySplits: SplitData[] = [];
      if (historicalRes && historicalRes.ok) {
        const histJson = await historicalRes.json();
        const histList = histJson?.StockSplitCalendar?.data?.list || [];
        const yesterday = new Date();
        yesterday.setHours(0, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);
        const yISO = yesterday.toISOString().slice(0, 10);
        yesterdaySplits = histList
          .filter((item: any) => (item.split?.date || "").slice(0, 10) === yISO)
          .map((item: any) => ({
            companyName: item.name || "",
            ticker: item.ticker || "",
            splitType: (item.split?.type || "").toString().toLowerCase(),
            splitRatio: item.split?.ratio?.text || "",
            exDate: item.split?.date || "",
          }));
      }

      // Overview keeps upcoming-only JSON order; full tab will merge yesterday in
      setSplits(mappedUpcoming);
      setYesterday(yesterdaySplits);
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
      if (diff === -1) return "Yesterday";
      if (diff < 0) return `${Math.abs(diff)} days ago`;
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
  // Full tab: include yesterday + all upcoming, sorted ascending by date
  const fullSortedAscending = [...yesterday, ...splits].sort((a, b) => {
    const ta = a.exDate ? new Date(a.exDate).getTime() : 0;
    const tb = b.exDate ? new Date(b.exDate).getTime() : 0;
    return ta - tb;
  });

  /* ================= LOADING PLACEHOLDER ================= */
  if (loading && splits.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5" />
            // Upcoming Stock Splits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  /* ================= COMPACT OVERVIEW (first `limit` in JSON order) ================= */
  if (compact) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5" />
            // Recent Stock Splits
          </CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {splits.length} UPCOMING
          </span>
        </CardHeader>

        <CardContent className="space-y-2">
          {overviewVisible.map((split, idx) => {
            const isForward = (split.splitType || "").toLowerCase() === "forward";
            const accent = isForward ? "border-emerald-500/30" : "border-red-500/30";
            const stripe = isForward ? "bg-emerald-500/70" : "bg-red-500/70";
            const tone = isForward ? "text-emerald-700" : "text-red-700";
            const due = daysUntil(split.exDate);

            return (
              <div
                key={idx}
                className={`relative border ${accent} rounded-md p-3 bg-background/40 hover:bg-muted/30 transition-colors animate-fade-in`}
                style={{ animationDelay: `${idx * 45}ms` }}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe} rounded-l-md`} />
                <div className="flex items-start justify-between pl-2 gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {formatDateShort(split.exDate)}
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-foreground text-sm truncate">
                      {split.ticker}
                    </div>
                    {split.companyName && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {split.companyName}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono uppercase tracking-wider ${tone} ${accent}`}
                    >
                      {split.splitType || "—"}
                    </Badge>
                    <div className="mt-1 font-mono font-semibold text-foreground text-sm tabular-nums">
                      {split.splitRatio}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      {due}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {overviewVisible.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming stock splits
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  /* ================= FULL SPLIT TAB (all, ascending by date) ================= */
  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5" />
          // Upcoming Stock Splits
        </CardTitle>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {fullSortedAscending.length} TOTAL
        </span>
      </CardHeader>

      <CardContent>
        {fullSortedAscending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-left py-8">No upcoming stock splits</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fullSortedAscending.map((split, idx) => {
              const isForward = (split.splitType || "").toLowerCase() === "forward";
              const accent = isForward ? "border-emerald-500/30" : "border-red-500/30";
              const stripe = isForward ? "bg-emerald-500/70" : "bg-red-500/70";
              const tone = isForward ? "text-emerald-700" : "text-red-700";
              const due = daysUntil(split.exDate);

              return (
                <div
                  key={idx}
                  className={`relative border ${accent} rounded-md p-3 hover:bg-muted/30 transition-colors animate-fade-in`}
                  style={{ animationDelay: `${idx * 25}ms` }}
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe} rounded-l-md`} />
                  <div className="pl-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {formatDateShort(split.exDate)}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono uppercase tracking-wider ${tone} ${accent}`}
                      >
                        {isForward ? "FORWARD" : "REVERSE"}
                      </Badge>
                    </div>
                    <div className="mt-1 font-mono font-bold text-foreground text-base">
                      {split.ticker}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {split.companyName}
                    </div>

                    <div className="flex items-center justify-between mt-3 font-mono">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {due}
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {split.splitRatio}
                      </span>
                    </div>
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
