import { useState, useCallback, useEffect, useMemo } from "react";
import { formatIndian } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2, Search, Sparkles, RotateCcw, ArrowUpDown, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const PROXY_URL =
  "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 45%)",
  "hsl(38, 92%, 55%)",
  "hsl(280, 80%, 65%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 90%, 50%)",
];

const RANGES = [
  { label: "3m", days: 90 },
  { label: "6m", days: 180 },
  { label: "1y", days: 365 },
  { label: "3y", days: 1095 },
  { label: "5y", days: 1825 },
];

const MAX_SYMBOLS = 6;

// Curated rolling pairs — a fresh pair is picked on every visit/refresh.
const ROLLING_PAIRS: [string, string][] = [
  ["AEE", "CMS"], ["RSG", "WM"], ["WEC", "CMS"], ["WEC", "AEE"],
  ["SO", "DUK"], ["ED", "WEC"], ["DTE", "AEE"], ["EQR", "AVB"],
  ["DTE", "CMS"], ["AJG", "MMC"], ["MAA", "CPT"], ["ED", "AEE"],
  ["UDR", "AVB"], ["DUK", "CMS"], ["ED", "CMS"], ["DUK", "WEC"],
  ["SO", "WEC"], ["DUK", "AEE"], ["SO", "CMS"], ["MAA", "UDR"],
  ["SO", "AEE"], ["DUK", "ED"], ["EQR", "UDR"], ["RY", "BNS"],
  ["AON", "MMC"], ["TD", "BNS"], ["CPT", "UDR"], ["MAA", "AVB"],
  ["DUK", "FE"], ["DTE", "PPL"], ["CPT", "AVB"], ["WEC", "DTE"],
  ["RY", "TD"], ["AJG", "BRO"], ["ETR", "PPL"], ["MET", "PRU"],
  ["BRO", "MMC"], ["BMO", "BNS"], ["PEG", "DTE"], ["DUK", "DTE"],
  ["SO", "DTE"], ["DUK", "PNW"], ["ED", "DTE"], ["DUK", "ETR"],
  ["DUK", "PPL"], ["D", "CMS"], ["SO", "ED"], ["NI", "ATO"],
  ["AEE", "FE"], ["ES", "CMS"], ["AJG", "AON"], ["D", "WEC"],
  ["DTE", "PNW"], ["AEE", "PNW"], ["CL", "KMB"], ["SO", "FE"],
  ["CPB", "GIS"], ["ETR", "CMS"], ["DTE", "FE"], ["PPL", "CMS"],
  ["FE", "CMS"], ["PPL", "PNW"], ["RY", "BMO"], ["K", "CPB"],
  ["AEE", "PPL"], ["EQR", "CPT"], ["ETR", "PNW"], ["DTE", "CNP"],
  ["SO", "ETR"], ["AEE", "EVRG"], ["TD", "CM"],
];


interface PricePoint {
  date: string;
  close: number;
}

interface StockEntry {
  symbol: string;
  name: string;
  visible: boolean;
  data: PricePoint[];
  latestPrice: number;
  change: number;
  changePct: number;
  loading: boolean;
  error?: string;
}

interface PeerSuggestion {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  marketCap: number;
  image?: string;
  exchange?: string;
}

interface ProfileInfo {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  image?: string;
}

const formatMarketCap = (cap: number): string => {
  if (!cap) return "—";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  if (cap >= 1e3) return `$${(cap / 1e3).toFixed(2)}K`;
  return `$${cap.toFixed(0)}`;
};

const CompareStocks = () => {
  const [symbols, setSymbols] = useState<StockEntry[]>([]);
  const [input, setInput] = useState("");
  const [days, setDays] = useState(365);
  const [adding, setAdding] = useState(false);

  // Peer suggestion state
  const [peerInput, setPeerInput] = useState("");
  const [peerLoading, setPeerLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [peers, setPeers] = useState<PeerSuggestion[]>([]);
  const [peerError, setPeerError] = useState<string | null>(null);

  const fetchStock = useCallback(
    async (sym: string, daysBack: number): Promise<StockEntry | null> => {
      try {
        const url = encodeURIComponent(
          `https://www.tipranks.com/api/stocks/getHistoricalPriceExtended?daysBack=${daysBack}&name=${sym}`
        );
        const res = await fetch(`${PROXY_URL}${url}`);
        if (!res.ok) {
          console.error(`[CompareStocks] HTTP ${res.status} for ${sym}`);
          return {
            symbol: sym, name: sym, visible: true, data: [],
            latestPrice: 0, change: 0, changePct: 0, loading: false,
            error: `HTTP ${res.status}`,
          };
        }
        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          console.error(`[CompareStocks] Non-JSON response for ${sym}:`, text.slice(0, 200));
          return {
            symbol: sym, name: sym, visible: true, data: [],
            latestPrice: 0, change: 0, changePct: 0, loading: false,
            error: "Bad response",
          };
        }
        if (!Array.isArray(data) || data.length === 0) {
          return {
            symbol: sym,
            name: sym,
            visible: true,
            data: [],
            latestPrice: 0,
            change: 0,
            changePct: 0,
            loading: false,
            error: "No data",
          };
        }
        const points: PricePoint[] = data.map((d: any) => ({
          date: d.date,
          close: Number(d.close),
        }));
        const first = points[0].close;
        const last = points[points.length - 1].close;
        return {
          symbol: sym,
          name: sym,
          visible: true,
          data: points,
          latestPrice: last,
          change: last - first,
          changePct: ((last - first) / first) * 100,
          loading: false,
        };
      } catch (e) {
        console.error(`[CompareStocks] Fetch failed for ${sym}:`, e);
        return {
          symbol: sym,
          name: sym,
          visible: true,
          data: [],
          latestPrice: 0,
          change: 0,
          changePct: 0,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to fetch",
        };
      }
    },
    []
  );

  const addSymbol = async (rawSym?: string) => {
    const sym = (rawSym ?? input).trim().toUpperCase();
    if (!sym) return;
    if (symbols.find((s) => s.symbol === sym)) {
      setInput("");
      return;
    }
    if (symbols.length >= MAX_SYMBOLS) return;
    setAdding(true);
    const entry = await fetchStock(sym, days);
    if (entry) setSymbols((prev) => [...prev, entry]);
    if (!rawSym) setInput("");
    setAdding(false);
  };

  const addMultipleSymbols = async (syms: string[]) => {
    const remaining = MAX_SYMBOLS - symbols.length;
    const existing = new Set(symbols.map((s) => s.symbol));
    const toAdd = syms
      .map((s) => s.toUpperCase())
      .filter((s) => !existing.has(s))
      .slice(0, remaining);
    if (toAdd.length === 0) return;
    setAdding(true);
    const results = await Promise.all(toAdd.map((s) => fetchStock(s, days)));
    setSymbols((prev) => [
      ...prev,
      ...(results.filter(Boolean) as StockEntry[]),
    ]);
    setAdding(false);
  };

  const removeSymbol = (sym: string) => {
    setSymbols((prev) => prev.filter((s) => s.symbol !== sym));
  };

  const resetAll = () => {
    setSymbols([]);
    setInput("");
    setPeerInput("");
    setProfile(null);
    setPeers([]);
    setPeerError(null);
  };

  const toggleVisible = (sym: string) => {
    setSymbols((prev) =>
      prev.map((s) => (s.symbol === sym ? { ...s, visible: !s.visible } : s))
    );
  };

  const fetchPeers = async (rawSym?: string) => {
    const sym = (rawSym ?? peerInput).trim().toUpperCase();
    if (!sym) return;
    setPeerLoading(true);
    setPeerError(null);
    setProfile(null);
    setPeers([]);
    try {
      const [profileRes, peersRes] = await Promise.all([
        fetch(
          `${PROXY_URL}${encodeURIComponent(
            `https://www.perplexity.ai/rest/finance/profile/${sym}`
          )}`
        ),
        fetch(
          `${PROXY_URL}${encodeURIComponent(
            `https://www.perplexity.ai/rest/finance/peers/${sym}?version=2.18&source=default`
          )}`
        ),
      ]);
      const profileData = await profileRes.json();
      const peersData = await peersRes.json();
      if (profileData && profileData.symbol) {
        setProfile({
          symbol: profileData.symbol,
          companyName: profileData.companyName,
          sector: profileData.sector,
          industry: profileData.industry,
          image: profileData.image,
        });
        // Auto-add the searched stock to the comparison
        if (!symbols.find((s) => s.symbol === profileData.symbol)) {
          addSymbol(profileData.symbol);
        }
      } else {
        setPeerError("Symbol not found");
      }
      if (Array.isArray(peersData)) {
        const sorted = [...peersData].sort(
          (a, b) => (b.marketCap || 0) - (a.marketCap || 0)
        );
        setPeers(sorted);
      }
    } catch (e) {
      setPeerError("Failed to load peers");
    } finally {
      setPeerLoading(false);
    }
  };

  // Refetch all when range changes
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    (async () => {
      setSymbols((prev) => prev.map((s) => ({ ...s, loading: true })));
      const updated = await Promise.all(
        symbols.map((s) => fetchStock(s.symbol, days))
      );
      if (cancelled) return;
      setSymbols((prev) =>
        prev.map((s, i) =>
          updated[i] ? { ...updated[i]!, visible: s.visible } : s
        )
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Auto-add a fresh rolling pair on each mount/refresh
  useEffect(() => {
    (async () => {
      const pair = ROLLING_PAIRS[Math.floor(Math.random() * ROLLING_PAIRS.length)];
      const results = await Promise.all(
        pair.map((d) => fetchStock(d, 365))
      );
      setSymbols(results.filter(Boolean) as StockEntry[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build merged chart data using % change vs first close per series
  const chartData = (() => {
    const visible = symbols.filter((s) => s.visible && s.data.length);
    if (visible.length === 0) return [];
    const dateMap = new Map<string, any>();
    visible.forEach((s) => {
      const base = s.data[0].close;
      s.data.forEach((p) => {
        const key = p.date.split("T")[0];
        if (!dateMap.has(key)) dateMap.set(key, { date: key });
        const pct = ((p.close - base) / base) * 100;
        dateMap.get(key)![s.symbol] = Number(pct.toFixed(2));
      });
    });
    return Array.from(dateMap.values()).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
  })();

  // Pairwise Pearson correlation of daily returns across visible series.
  // Used to show "how often these stocks move together" as a small badge.
  const correlations = useMemo(() => {
    const visible = symbols.filter((s) => s.visible && s.data.length > 2);
    if (visible.length < 2) return [] as { a: string; b: string; corr: number }[];
    const returns = visible.map((s) => {
      const r: Record<string, number> = {};
      for (let i = 1; i < s.data.length; i++) {
        const prev = s.data[i - 1].close;
        if (!prev) continue;
        const key = s.data[i].date.split("T")[0];
        r[key] = (s.data[i].close - prev) / prev;
      }
      return { symbol: s.symbol, r };
    });
    const out: { a: string; b: string; corr: number }[] = [];
    for (let i = 0; i < returns.length; i++) {
      for (let j = i + 1; j < returns.length; j++) {
        const A = returns[i], B = returns[j];
        const keys = Object.keys(A.r).filter((k) => k in B.r);
        if (keys.length < 5) continue;
        const xs = keys.map((k) => A.r[k]);
        const ys = keys.map((k) => B.r[k]);
        const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
        const my = ys.reduce((s, v) => s + v, 0) / ys.length;
        let num = 0, dx = 0, dy = 0;
        for (let k = 0; k < xs.length; k++) {
          const a1 = xs[k] - mx, b1 = ys[k] - my;
          num += a1 * b1; dx += a1 * a1; dy += b1 * b1;
        }
        const denom = Math.sqrt(dx * dy);
        if (!denom) continue;
        out.push({ a: A.symbol, b: B.symbol, corr: num / denom });
      }
    }
    return out;
  }, [symbols]);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  };

  const selectedSymbols = new Set(symbols.map((s) => s.symbol));
  const remainingSlots = MAX_SYMBOLS - symbols.length;

  return (
    <div className="space-y-4">
      {/* Sector Peer Finder */}
      <Card className="p-4 sm:p-5 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <h2 className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            // Sector Peer Finder
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3">
          Enter a stock to discover peers in the same sector and add them to your comparison.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={peerInput}
              onChange={(e) => setPeerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchPeers()}
              placeholder="Query symbol (e.g. V, AAPL, JPM)"
              className="pl-10 h-9 font-mono text-sm uppercase"
            />
          </div>
          <Button
            size="sm"
            onClick={() => fetchPeers()}
            disabled={peerLoading || !peerInput.trim()}
            className="font-mono text-xs uppercase tracking-wider"
          >
            {peerLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Find"
            )}
          </Button>
        </div>

        {peerError && (
          <p className="mt-3 text-sm text-destructive">{peerError}</p>
        )}

        {profile && (
          <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center gap-3 flex-wrap">
              {profile.image && (
                <img
                  src={profile.image}
                  alt={profile.symbol}
                  className="h-9 w-9 rounded-md object-contain bg-background p-1"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm sm:text-base truncate">
                  {profile.companyName}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({profile.symbol})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {profile.sector && (
                    <Badge variant="secondary" className="text-[10px]">
                      {profile.sector}
                    </Badge>
                  )}
                  {profile.industry && (
                    <Badge variant="outline" className="text-[10px]">
                      {profile.industry}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {peers.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">
                Peers ({peers.length})
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={
                    adding ||
                    remainingSlots <= 0 ||
                    peers.every((p) => selectedSymbols.has(p.symbol))
                  }
                  onClick={() =>
                    addMultipleSymbols(
                      peers
                        .filter((p) => !selectedSymbols.has(p.symbol))
                        .slice(0, remainingSlots)
                        .map((p) => p.symbol)
                    )
                  }
                >
                  Add top {Math.min(remainingSlots, peers.length)}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              {remainingSlots > 0
                ? `${remainingSlots} of ${MAX_SYMBOLS} slots available`
                : `Comparison full (${MAX_SYMBOLS} max). Remove a stock to add more.`}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
              {peers.map((peer) => {
                const checked = selectedSymbols.has(peer.symbol);
                const disabled = !checked && remainingSlots <= 0;
                return (
                  <label
                    key={peer.symbol}
                    className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                      checked
                        ? "bg-primary/10 border-primary/40"
                        : "bg-background border-border hover:bg-muted/50"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => {
                        if (checked) removeSymbol(peer.symbol);
                        else addSymbol(peer.symbol);
                      }}
                    />
                    {peer.image ? (
                      <img
                        src={peer.image}
                        alt={peer.symbol}
                        className="h-7 w-7 rounded object-contain bg-muted p-0.5 shrink-0"
                        onError={(e) =>
                          ((e.target as HTMLImageElement).style.display = "none")
                        }
                      />
                    ) : (
                      <div className="h-7 w-7 rounded bg-muted shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs sm:text-sm">
                          {peer.symbol}
                        </span>
                        <span
                          className={`text-[10px] sm:text-xs font-semibold ${
                            peer.changesPercentage >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {peer.changesPercentage >= 0 ? "+" : ""}
                          {peer.changesPercentage?.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {peer.name} · {formatMarketCap(peer.marketCap)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Comparison Card */}
      <Card className="p-4 sm:p-5 border border-border/50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
              // Compare Stocks
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Compare % price change across multiple tickers
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addSymbol()}
              placeholder="Add symbol"
              className="h-9 w-full sm:w-48 font-mono text-sm uppercase"
              disabled={adding || symbols.length >= MAX_SYMBOLS}
            />
            <Button
              size="sm"
              onClick={() => addSymbol()}
              disabled={adding || !input.trim() || symbols.length >= MAX_SYMBOLS}
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={resetAll}
              disabled={
                symbols.length === 0 &&
                !input &&
                !peerInput &&
                !profile &&
                peers.length === 0
              }
              title="Reset all"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Symbol legend list */}
        <div className="mt-4 space-y-1">
          {symbols.length === 0 && (
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              // Add a symbol to start comparing
            </p>
          )}
          {symbols.map((s, idx) => {
            const color = COLORS[idx % COLORS.length];
            return (
              <div
                key={s.symbol}
                className="relative flex items-center justify-between gap-2 py-1.5 px-2 rounded-md border border-border/50 bg-card hover:bg-muted/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md"
                  style={{ background: color, opacity: s.visible ? 1 : 0.3 }}
                />
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pl-2">
                  <Checkbox
                    checked={s.visible}
                    onCheckedChange={() => toggleVisible(s.symbol)}
                    style={{
                      backgroundColor: s.visible ? color : undefined,
                      borderColor: color,
                    }}
                  />
                  <span
                    className="font-mono font-bold text-sm sm:text-base"
                    style={{ color }}
                  >
                    {s.symbol}
                  </span>
                  {s.loading && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                  {s.error && (
                    <span className="text-xs font-mono text-destructive">{s.error}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm shrink-0 font-mono">
                  <span className="tabular-nums hidden sm:inline text-muted-foreground">
                    ${s.latestPrice.toFixed(2)}
                  </span>
                  <span
                    className={`tabular-nums font-semibold ${
                      s.changePct >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {s.changePct >= 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}%
                  </span>
                  <button
                    onClick={() => removeSymbol(s.symbol)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${s.symbol}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-3 sm:p-5 border border-border/50 shadow-sm">
        {/* Range selector + correlations */}
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            // Performance %
          </span>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {correlations.length > 0 && (
              correlations.length === 1 ? (
                (() => {
                  const c = correlations[0];
                  const pct = Math.round(Math.abs(c.corr) * 100);
                  const positive = c.corr >= 0;
                  const strong = pct >= 70;
                  return (
                    <span
                      title={`${positive ? "Move together" : "Move opposite"} ${pct}% of the time (Pearson correlation of daily returns)`}
                      className={`inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-md font-mono tabular-nums border ${
                        positive
                          ? strong
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600"
                            : "border-border bg-muted/40 text-foreground"
                          : "border-red-500/50 bg-red-500/15 text-red-500"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {c.a}{positive ? "↔" : "↮"}{c.b}
                      </span>
                      <span className="text-lg sm:text-xl font-bold leading-none">{pct}%</span>
                    </span>
                  );
                })()
              ) : (
                <CorrelationList correlations={correlations} />
              )
            )}
            <div className="inline-flex rounded-md border border-border/50 bg-muted/40 p-0.5 gap-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setDays(r.days)}
                  className={`px-2.5 sm:px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded transition-all ${
                    days === r.days
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[320px] sm:h-[440px] w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {symbols.some((s) => s.loading)
                ? "// Loading chart…"
                : "// No data"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  formatter={(value: any, name: any) => [
                    `${Number(value).toFixed(2)}%`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="line"
                />
                {symbols
                  .filter((s) => s.visible && s.data.length)
                  .map((s) => {
                    const colorIdx = symbols.findIndex(
                      (x) => x.symbol === s.symbol
                    );
                    return (
                      <Line
                        key={s.symbol}
                        type="monotone"
                        dataKey={s.symbol}
                        stroke={COLORS[colorIdx % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    );
                  })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Pearson correlation explainer */}
      <Card className="p-4 sm:p-5 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <h3 className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            // About Pearson Correlation
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          The percentage above the chart is the <span className="text-foreground font-medium">Pearson correlation of daily returns</span> between
          two stocks. It measures how often two stocks move in the same direction on a day-to-day basis.
          A value near <span className="text-emerald-600 font-medium">+100%</span> means they tend to rise and fall together,
          <span className="text-foreground"> 0%</span> means no linear relationship, and a value near
          <span className="text-red-500 font-medium"> −100%</span> means they tend to move in opposite directions.
          We display the absolute strength (e.g. <span className="font-mono">75%</span>) with the direction shown by the arrow:
          <span className="font-mono"> ↔ </span> for positive (move together) and <span className="font-mono"> ↮ </span> for inverse (move opposite).
          Correlation is based on the selected time range and does not imply causation.
        </p>
      </Card>
    </div>
  );
};

interface CorrelationItem { a: string; b: string; corr: number }

const CorrelationList = ({ correlations }: { correlations: CorrelationItem[] }) => {
  const [sortDesc, setSortDesc] = useState(true);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    return [...correlations].sort((x, y) =>
      sortDesc ? y.corr - x.corr : x.corr - y.corr
    );
  }, [correlations, sortDesc]);

  const avgPct = Math.round(
    (correlations.reduce((s, c) => s + Math.abs(c.corr), 0) / correlations.length) * 100
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
          title="Show pairwise correlations"
        >
          <span className="text-muted-foreground">// Follow</span>
          <span className="tabular-nums">{correlations.length} pairs</span>
          <span className="text-emerald-600 tabular-nums">avg {avgPct}%</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Pairwise correlation
          </span>
          <button
            onClick={() => setSortDesc((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            title="Toggle sort"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortDesc ? "High → Low" : "Low → High"}
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {sorted.map((c) => {
            const pct = Math.round(Math.abs(c.corr) * 100);
            const positive = c.corr >= 0;
            const strong = pct >= 70;
            return (
              <div
                key={`${c.a}-${c.b}`}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-border/50 bg-card"
              >
                <span className="font-mono text-xs">
                  {c.a} <span className="text-muted-foreground">{positive ? "↔" : "↮"}</span> {c.b}
                </span>
                <span
                  className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded border ${
                    positive
                      ? strong
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                        : "border-border bg-muted/40 text-muted-foreground"
                      : "border-red-500/40 bg-red-500/10 text-red-500"
                  }`}
                >
                  {positive ? "+" : "−"}{pct}%
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CompareStocks;
