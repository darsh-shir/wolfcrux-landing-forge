import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Upload,
  Activity,
  ArrowUpDown,
  Database,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Pair {
  peer: string;
  correlation: number;
}

const BATCH = 2000;
const EARNINGS_TICKER_LIMIT = 24;

const corrColor = (v: number) =>
  v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

const CorrRow = ({ p }: { p: Pair }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 font-mono text-xs">
    <span className="font-semibold tracking-wider">{p.peer}</span>
    <span className={`flex items-center gap-1 ${corrColor(p.correlation)}`}>
      {p.correlation >= 0 ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {p.correlation.toFixed(2)}%
    </span>
  </div>
);

const Followers = () => {
  const { isAdmin } = useAuth();

  const [rowCount, setRowCount] = useState<number | null>(null);

  /* ---------- earnings ---------- */
  const [earningsTickers, setEarningsTickers] = useState<
    { ticker: string; name: string; session: string }[]
  >([]);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [topN, setTopN] = useState(10);
  const [topMap, setTopMap] = useState<Record<string, Pair[]>>({});
  const [topLoading, setTopLoading] = useState(false);

  /* ---------- search ---------- */
  const [query, setQuery] = useState("");
  const [searchTicker, setSearchTicker] = useState("");
  const [searchRows, setSearchRows] = useState<Pair[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sortDir, setSortDir] = useState<"abs" | "desc" | "asc">("abs");
  const [visible, setVisible] = useState(300);

  /* ---------- upload ---------- */
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadNote, setUploadNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshCount = useCallback(async () => {
    const { count } = await supabase
      .from("stock_correlations")
      .select("id", { count: "exact", head: true });
    setRowCount(count ?? 0);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  /* ---------- today's earnings ---------- */
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { fetchPerplexityEarnings } = await import("@/lib/earnings");
        const rows = await fetchPerplexityEarnings(today);
        const mapped = rows
          .filter((r) => r.ticker)
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
          .slice(0, EARNINGS_TICKER_LIMIT)
          .map((r) => ({
            ticker: r.ticker.toUpperCase(),
            name: r.name,
            session: r.earning?.reportOnTimeOfDay || "Other",
          }));
        setEarningsTickers(mapped);
      } catch (e) {
        console.error("Earnings fetch failed", e);
      } finally {
        setEarningsLoading(false);
      }
    })();
  }, []);

  /* ---------- top correlations for earnings tickers ---------- */
  useEffect(() => {
    if (!earningsTickers.length) return;
    let cancelled = false;
    (async () => {
      setTopLoading(true);
      const next: Record<string, Pair[]> = {};
      for (let i = 0; i < earningsTickers.length; i += 6) {
        const chunk = earningsTickers.slice(i, i + 6);
        const results = await Promise.all(
          chunk.map(async (t): Promise<Pair[]> => {
            try {
              const { data } = await supabase.rpc("top_correlations", {
                _ticker: t.ticker,
                _limit: topN,
              });
              return (data ?? []).map((d: any) => ({
                peer: d.peer as string,
                correlation: Number(d.correlation),
              }));
            } catch {
              return [];
            }
          }),
        );

        chunk.forEach((t, idx) => {
          next[t.ticker] = results[idx];
        });
        if (cancelled) return;
        setTopMap({ ...next });
      }
      if (!cancelled) setTopLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [earningsTickers, topN]);

  /* ---------- search ---------- */
  const runSearch = async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t) return;
    setSearchLoading(true);
    setSearchTicker(t);
    setVisible(300);
    const { data, error } = await supabase.rpc("all_correlations", { _ticker: t });
    if (error) {
      toast.error("Search failed");
      setSearchRows([]);
    } else {
      setSearchRows(
        (data ?? []).map((d: any) => ({
          peer: d.peer as string,
          correlation: Number(d.correlation),
        })),
      );
    }
    setSearchLoading(false);
  };

  const sortedSearch = useMemo(() => {
    const rows = [...searchRows];
    if (sortDir === "abs") rows.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    if (sortDir === "desc") rows.sort((a, b) => b.correlation - a.correlation);
    if (sortDir === "asc") rows.sort((a, b) => a.correlation - b.correlation);
    return rows;
  }, [searchRows, sortDir]);

  /* ---------- upload ---------- */
  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setUploadNote("Reading file…");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", dense: true });

      // Collect rows from every sheet in the workbook
      const rows: { stock1: string; stock2: string; correlation: number }[] = [];
      for (const sheetName of wb.SheetNames) {
        setUploadNote(`Parsing sheet "${sheetName}"…`);
        const ws = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
        for (const r of raw) {
          const a = r?.[0];
          const b = r?.[1];
          const c = r?.[2];
          if (typeof a !== "string" || typeof b !== "string") continue;
          const s1 = a.trim().toUpperCase();
          const s2 = b.trim().toUpperCase();
          if (!s1 || !s2 || s1 === "STOCK 1") continue;
          const corr = Number(c);
          if (!Number.isFinite(corr)) continue;
          rows.push({ stock1: s1, stock2: s2, correlation: Math.round(corr * 100) / 100 });
        }
      }

      if (!rows.length) {
        toast.error("No valid rows found in the file");
        setUploading(false);
        return;
      }

      setUploadNote("Clearing old data…");
      const { error: clearErr } = await supabase.rpc("clear_stock_correlations");
      if (clearErr) throw clearErr;

      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const { error } = await supabase.from("stock_correlations").insert(slice);
        if (error) throw error;
        setProgress(Math.round(((i + slice.length) / rows.length) * 100));
        setUploadNote(
          `Uploading ${(i + slice.length).toLocaleString()} / ${rows.length.toLocaleString()} pairs…`,
        );
      }
      toast.success(`Uploaded ${rows.length.toLocaleString()} correlation pairs`);
      setUploadNote("Done");
      refreshCount();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Helmet>
        <title>Followers | Correlation Matrix</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          name="description"
          content="Internal correlation matrix tool for pairing earnings movers with their most correlated stocks."
        />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />

        <main className="pt-20 md:pt-24 pb-12 px-3 sm:px-4 max-w-7xl mx-auto w-full animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="font-mono text-lg uppercase tracking-[0.25em] flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                Followers
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Pair correlation matrix · {rowCount === null ? "…" : rowCount.toLocaleString()} pairs
                loaded
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase text-muted-foreground">Top</span>
              {[5, 10].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={topN === n ? "default" : "outline"}
                  className="font-mono h-7 px-3 text-xs"
                  onClick={() => setTopN(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          {/* ---------- SEARCH ---------- */}
          <Card className="mb-6 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search a ticker
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch(query);
                }}
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value.toUpperCase())}
                  placeholder="e.g. COHR"
                  className="font-mono uppercase max-w-xs"
                />
                <Button type="submit" disabled={searchLoading} className="font-mono">
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find pairs"}
                </Button>
              </form>

              {searchTicker && !searchLoading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">{searchTicker}</span> ·{" "}
                      {sortedSearch.length.toLocaleString()} pairs (exact match)
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] font-mono"
                      onClick={() =>
                        setSortDir(sortDir === "abs" ? "desc" : sortDir === "desc" ? "asc" : "abs")
                      }
                    >
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      {sortDir === "abs"
                        ? "Strongest"
                        : sortDir === "desc"
                          ? "Highest +"
                          : "Lowest −"}
                    </Button>
                  </div>

                  {sortedSearch.length === 0 ? (
                    <p className="text-xs font-mono text-muted-foreground py-4">
                      No pairs found for {searchTicker}.
                    </p>
                  ) : (
                    <>
                      <ScrollArea className="h-[360px] pr-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                          {sortedSearch.slice(0, visible).map((p) => (
                            <CorrRow key={p.peer} p={p} />
                          ))}
                        </div>
                      </ScrollArea>
                      {visible < sortedSearch.length && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 font-mono text-xs"
                          onClick={() => setVisible((v) => v + 300)}
                        >
                          Show more ({(sortedSearch.length - visible).toLocaleString()} left)
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---------- TODAY'S EARNINGS ---------- */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-sm uppercase tracking-wider">
              Today&apos;s earnings · top {topN} correlated
            </h2>
            {topLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {earningsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : earningsTickers.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">
              No earnings found for today.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {earningsTickers.map((t) => {
                const pairs = topMap[t.ticker];
                return (
                  <Card key={t.ticker} className="border-border/60">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="font-mono text-base tracking-wider">
                            {t.ticker}
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{t.name}</p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          {t.session}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!pairs ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 w-full" />
                          ))}
                        </div>
                      ) : pairs.length === 0 ? (
                        <p className="text-[11px] font-mono text-muted-foreground py-2">
                          No correlation data
                        </p>
                      ) : (
                        <>
                          {pairs.map((p) => (
                            <CorrRow key={p.peer} p={p} />
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 font-mono text-[11px]"
                            onClick={() => {
                              setQuery(t.ticker);
                              runSearch(t.ticker);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            All pairs →
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ---------- ADMIN UPLOAD ---------- */}
          {isAdmin && (
            <Card className="mt-8 border-dashed border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Admin · upload correlation workbook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select the .xlsx file (all sheets are read; columns must be Stock 1, Stock 2,
                  Correlation %). Existing data is replaced. Keep this tab open until it finishes —
                  1.27M rows take a few minutes.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                    className="max-w-sm"
                  />
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {!uploading && <Upload className="w-4 h-4 text-muted-foreground" />}
                </div>
                {uploading && (
                  <div className="space-y-1">
                    <Progress value={progress} />
                    <p className="text-[11px] font-mono text-muted-foreground">{uploadNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
};

export default Followers;
