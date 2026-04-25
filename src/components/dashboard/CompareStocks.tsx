import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Loader2 } from "lucide-react";
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

const CompareStocks = () => {
  const [symbols, setSymbols] = useState<StockEntry[]>([]);
  const [input, setInput] = useState("");
  const [days, setDays] = useState(365);
  const [adding, setAdding] = useState(false);

  const fetchStock = useCallback(
    async (sym: string, daysBack: number): Promise<StockEntry | null> => {
      try {
        const url = encodeURIComponent(
          `https://www.tipranks.com/api/stocks/getHistoricalPriceExtended?daysBack=${daysBack}&name=${sym}`
        );
        const res = await fetch(`${PROXY_URL}${url}`);
        const data = await res.json();
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
        return {
          symbol: sym,
          name: sym,
          visible: true,
          data: [],
          latestPrice: 0,
          change: 0,
          changePct: 0,
          loading: false,
          error: "Failed to fetch",
        };
      }
    },
    []
  );

  const addSymbol = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    if (symbols.find((s) => s.symbol === sym)) {
      setInput("");
      return;
    }
    if (symbols.length >= 6) return;
    setAdding(true);
    const entry = await fetchStock(sym, days);
    if (entry) setSymbols((prev) => [...prev, entry]);
    setInput("");
    setAdding(false);
  };

  const removeSymbol = (sym: string) => {
    setSymbols((prev) => prev.filter((s) => s.symbol !== sym));
  };

  const toggleVisible = (sym: string) => {
    setSymbols((prev) =>
      prev.map((s) => (s.symbol === sym ? { ...s, visible: !s.visible } : s))
    );
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

  // Auto-add a couple defaults on mount
  useEffect(() => {
    (async () => {
      const defaults = ["SYF", "COF"];
      const results = await Promise.all(
        defaults.map((d) => fetchStock(d, 365))
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

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Compare Stocks</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Compare % price change across multiple tickers
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSymbol()}
              placeholder="Add symbol (e.g. AAPL)"
              className="h-9 w-full sm:w-48 uppercase"
              disabled={adding || symbols.length >= 6}
            />
            <Button
              size="sm"
              onClick={addSymbol}
              disabled={adding || !input.trim() || symbols.length >= 6}
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Symbol legend list */}
        <div className="mt-4 space-y-2">
          {symbols.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add a stock symbol to start comparing.
            </p>
          )}
          {symbols.map((s, idx) => {
            const color = COLORS[idx % COLORS.length];
            return (
              <div
                key={s.symbol}
                className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Checkbox
                    checked={s.visible}
                    onCheckedChange={() => toggleVisible(s.symbol)}
                    style={{
                      backgroundColor: s.visible ? color : undefined,
                      borderColor: color,
                    }}
                  />
                  <span
                    className="font-bold text-sm sm:text-base"
                    style={{ color }}
                  >
                    {s.symbol}
                  </span>
                  {s.loading && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                  {s.error && (
                    <span className="text-xs text-destructive">{s.error}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm shrink-0">
                  <span className="font-mono tabular-nums hidden sm:inline">
                    {s.latestPrice.toFixed(2)}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      s.changePct >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {s.changePct >= 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}%
                  </span>
                  <button
                    onClick={() => removeSymbol(s.symbol)}
                    className="text-muted-foreground hover:text-destructive"
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

      <Card className="p-3 sm:p-5">
        {/* Range selector */}
        <div className="flex justify-end mb-3">
          <div className="inline-flex rounded-lg bg-muted p-1 gap-1">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setDays(r.days)}
                className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                  days === r.days
                    ? "bg-background shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[320px] sm:h-[440px] w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {symbols.some((s) => s.loading)
                ? "Loading chart…"
                : "No data to display"}
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
                  .map((s, idx) => {
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
    </div>
  );
};

export default CompareStocks;
