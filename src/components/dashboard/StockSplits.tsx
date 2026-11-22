import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors } from "lucide-react";
import DataAge from "@/components/dashboard/DataAge";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";

// TipRanks' old split snapshots (tr-cdn …/stock-splits/upcoming|historical/payload.json)
// stopped updating on 2026-11-15. Their calendar page now calls
//   https://www.tipranks.com/api/stocks/splits/?country=us&fromDate=…&toDate=…
const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";
const RECENT_DAYS = 14;
const UPCOMING_DAYS = 120;

interface SplitData {
  companyName: string;
  ticker: string;
  splitType: "forward" | "reverse";
  splitRatio: string; // e.g. "1 for 3.00"
  exDate: string; // YYYY-MM-DD
}

interface StockSplitsProps {
  /** Overview: number of rows to show. */
  limit?: number;
  /** Overview: compact list layout. */
  compact?: boolean;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

const fetchRange = async (from: string, to: string): Promise<SplitData[]> => {
  const target = `https://www.tipranks.com/api/stocks/splits/?country=us&fromDate=${from}&toDate=${to}&pageSize=200`;
  const res = await fetch(`${PROXY}${encodeURIComponent(target)}`);
  if (!res.ok) throw new Error(`Splits request failed (${res.status})`);
  const json = await res.json();
  return (Array.isArray(json?.data) ? json.data : []).map((s: any) => ({
    companyName: s.companyName || "",
    ticker: s.ticker || "",
    splitType: s.type === "Reverse" ? "reverse" : "forward",
    splitRatio: s.splitRatioText || "",
    exDate: String(s.effectiveDate || "").slice(0, 10),
  }));
};

const formatDateShort = (day: string) =>
  day
    ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

const daysUntil = (day: string) => {
  const diff = Math.round(
    (new Date(`${day}T00:00:00Z`).getTime() - new Date(`${ymd(new Date())}T00:00:00Z`).getTime()) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
};

const SplitRow = ({ split, idx, grid }: { split: SplitData; idx: number; grid?: boolean }) => {
  const isForward = split.splitType === "forward";
  const accent = isForward ? "border-emerald-500/30" : "border-red-500/30";
  const stripe = isForward ? "bg-emerald-500/70" : "bg-red-500/70";
  const tone = isForward ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
  return (
    <div
      className={`relative border ${accent} rounded-md p-3 bg-background/40 hover:bg-muted/30 transition-colors animate-fade-in`}
      style={{ animationDelay: `${Math.min(idx, 20) * (grid ? 25 : 45)}ms` }}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe} rounded-l-md`} />
      <div className="flex items-start justify-between pl-2 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {formatDateShort(split.exDate)}
          </div>
          <div className="mt-0.5 font-mono font-bold text-foreground text-sm truncate" data-ticker={split.ticker}>
            {split.ticker}
          </div>
          {split.companyName && (
            <div className="text-[11px] text-muted-foreground truncate">{split.companyName}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <Badge variant="outline" className={`text-[9px] font-mono uppercase tracking-wider ${tone} ${accent}`}>
            {split.splitType}
          </Badge>
          <div className="mt-1 font-mono font-semibold text-foreground text-sm tabular-nums">{split.splitRatio}</div>
          <div className="text-[10px] font-mono text-muted-foreground tabular-nums">{daysUntil(split.exDate)}</div>
        </div>
      </div>
    </div>
  );
};

const StockSplits = ({ limit, compact }: StockSplitsProps) => {
  const [upcoming, setUpcoming] = useState<SplitData[]>([]);
  const [recent, setRecent] = useState<SplitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);

  const fetchSplits = useCallback(async () => {
    try {
      setLoading(true);
      const today = ymd(new Date());
      const [up, past] = await Promise.all([
        fetchRange(today, ymd(addDays(UPCOMING_DAYS))),
        fetchRange(ymd(addDays(-RECENT_DAYS)), ymd(addDays(-1))),
      ]);
      setUpcoming(up.sort((a, b) => a.exDate.localeCompare(b.exDate)));
      setRecent(past.sort((a, b) => b.exDate.localeCompare(a.exDate)));
      setUpdated(new Date());
      setError(false);
    } catch (err) {
      console.error("Error fetching splits:", err);
      setError(true); // keep whatever was shown before; never show made-up data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSplits();
  }, [fetchSplits]);
  useVisibleInterval(fetchSplits, 30 * 60_000);

  const header = (title: string, right: React.ReactNode) => (
    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 gap-2">
      <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <Scissors className="w-3.5 h-3.5" />
        {title}
      </CardTitle>
      {right}
    </CardHeader>
  );

  if (loading && !updated) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        {header("// Stock Splits", null)}
        <CardContent className="space-y-3">
          {[...Array(compact ? 4 : 6)].map((_, i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const status = error ? (
    <span className="text-[10px] font-mono text-amber-600">Couldn't refresh</span>
  ) : (
    <DataAge at={updated} staleAfterMinutes={120} />
  );

  /* ---------- Overview: upcoming first, then most recent ---------- */
  if (compact) {
    const rows = [...upcoming, ...recent].slice(0, limit ?? 6);
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        {header(
          "// Stock Splits",
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {upcoming.length} UPCOMING
          </span>
        )}
        <CardContent className="space-y-2">
          {upcoming.length === 0 && (
            <p className="text-[11px] font-mono text-muted-foreground">
              No upcoming splits announced · showing the last {RECENT_DAYS} days
            </p>
          )}
          {rows.map((split, idx) => (
            <SplitRow key={`${split.ticker}-${split.exDate}`} split={split} idx={idx} />
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent or upcoming stock splits</p>
          )}
          <div className="pt-1 text-right">{status}</div>
        </CardContent>
      </Card>
    );
  }

  /* ---------- Full tab ---------- */
  return (
    <div className="space-y-5">
      <Card className="bg-card border border-border/50 shadow-sm">
        {header(
          "// Upcoming Stock Splits",
          <div className="flex items-center gap-3">
            {status}
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{upcoming.length} TOTAL</span>
          </div>
        )}
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No upcoming stock splits have been announced for the next {UPCOMING_DAYS} days.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcoming.map((split, idx) => (
                <SplitRow key={`${split.ticker}-${split.exDate}`} split={split} idx={idx} grid />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border border-border/50 shadow-sm">
        {header(
          `// Recent Splits · Last ${RECENT_DAYS} Days`,
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{recent.length} TOTAL</span>
        )}
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No splits in the last {RECENT_DAYS} days.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recent.map((split, idx) => (
                <SplitRow key={`${split.ticker}-${split.exDate}`} split={split} idx={idx} grid />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockSplits;
