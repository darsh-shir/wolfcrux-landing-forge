import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, ExternalLink, Filter, Loader2, Plus, RefreshCw, Save, SlidersHorizontal, X } from "lucide-react";
import { useTerminal } from "@/components/dashboard/TerminalContext";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import DataAge from "@/components/dashboard/DataAge";
import { FILTER_GROUPS, PRESETS, SORTS, runScreen, type FilterKey, type ScreenerResult, type ScreenerRow } from "@/lib/finvizScreener";
import { fmtAmt } from "@/lib/utils";

const REFRESH_MS = 3 * 60_000;
const SAVED_KEY = "wolfcrux.screener.saved";
const NONE = "__any"; // Select can't use "" as a value

type Filters = Partial<Record<FilterKey, string>>;
interface SavedScreen { name: string; filters: Filters; order: string }

const loadSaved = (): SavedScreen[] => {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const big = (v: number | null, digits = 1) => {
  if (v === null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
};
const cap = (m: number | null) => (m === null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(m >= 100000 ? 0 : 1)}B` : `${m.toFixed(0)}M`);
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "");

type ColKey = keyof ScreenerRow;
const COLS: { key: ColKey; label: string; render: (r: ScreenerRow) => React.ReactNode; className?: string; hideSm?: boolean }[] = [
  { key: "price", label: "Price", render: (r) => (r.price === null ? "—" : `$${fmtAmt(r.price, 2)}`) },
  { key: "change", label: "Chg", render: (r) => <span className={tone(r.change)}>{pct(r.change)}</span> },
  { key: "gap", label: "Gap", render: (r) => <span className={tone(r.gap)}>{pct(r.gap)}</span>, hideSm: true },
  { key: "changeFromOpen", label: "From open", render: (r) => <span className={tone(r.changeFromOpen)}>{pct(r.changeFromOpen)}</span>, hideSm: true },
  { key: "volume", label: "Volume", render: (r) => big(r.volume) },
  { key: "relVolume", label: "Rel vol", render: (r) => (r.relVolume === null ? "—" : <span className={r.relVolume >= 2 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>{r.relVolume.toFixed(2)}×</span>) },
  { key: "marketCap", label: "Mkt cap", render: (r) => cap(r.marketCap), hideSm: true },
  { key: "floatShares", label: "Float", render: (r) => (r.floatShares === null ? "—" : `${r.floatShares.toFixed(1)}M`), hideSm: true },
  { key: "shortFloat", label: "Short", render: (r) => (r.shortFloat === null ? "—" : `${r.shortFloat.toFixed(1)}%`), hideSm: true },
  { key: "rsi", label: "RSI", render: (r) => (r.rsi === null ? "—" : r.rsi.toFixed(0)), hideSm: true },
];

/** Finviz-powered stock screener (delayed data; live prices stay on TipRanks). */
const FinvizScreener = () => {
  const { addToWatchlist, watchlist } = useTerminal();
  const [preset, setPreset] = useState<string | null>(PRESETS[0].id);
  const [filters, setFilters] = useState<Filters>(PRESETS[0].filters);
  const [order, setOrder] = useState(PRESETS[0].order);
  const [maxRows, setMaxRows] = useState(60);
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 } | null>(null);
  const [saved, setSaved] = useState<SavedScreen[]>(loadSaved);
  const [saveName, setSaveName] = useState("");
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const codes = useMemo(() => Object.values(filters).filter(Boolean) as string[], [filters]);

  const run = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        setResult(await runScreen(codes, order, maxRows, force));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [codes, order, maxRows]
  );
  useEffect(() => {
    void run();
  }, [run]);
  useVisibleInterval(() => void run(true), REFRESH_MS);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setFilters(p.filters);
    setOrder(p.order);
    setSort(null);
  };
  const setFilter = (k: FilterKey, v: string) => {
    setPreset(null);
    setFilters((f) => ({ ...f, [k]: v === NONE ? "" : v }));
  };
  const persist = (list: SavedScreen[]) => {
    setSaved(list);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  };
  const saveScreen = () => {
    const name = saveName.trim();
    if (!name) return;
    persist([...saved.filter((s) => s.name !== name), { name, filters, order }]);
    setSaveName("");
  };

  const rows = useMemo(() => {
    const list = result?.rows ?? [];
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const x = a[sort.key] as number | string | null;
      const y = b[sort.key] as number | string | null;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }, [result, sort]);

  const finvizLink = `https://finviz.com/screener.ashx?v=111&f=${codes.join(",")}&o=${order}`;
  const activeCount = codes.length;

  const add = async (t: string) => {
    const r = await addToWatchlist(t);
    if (r.ok) setAdded((m) => ({ ...m, [t]: true }));
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Screener
            <span className="normal-case tracking-normal text-[10px] text-muted-foreground/70">Finviz · delayed ~15 min</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <DataAge at={result ? new Date(result.fetchedAt) : null} staleAfterMinutes={10} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void run(true)} disabled={loading} aria-label="Refresh screener">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Presets and saved screens */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${preset === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
            >
              {p.label}
            </button>
          ))}
          {saved.map((s) => (
            <span key={s.name} className="inline-flex items-center rounded-full border border-dashed border-primary/50 text-xs">
              <button
                type="button"
                className="py-1 pl-3 pr-1 hover:underline"
                onClick={() => {
                  setPreset(null);
                  setFilters(s.filters);
                  setOrder(s.order);
                  setSort(null);
                }}
              >
                ★ {s.name}
              </button>
              <button type="button" className="px-1.5 text-muted-foreground hover:text-destructive" aria-label={`Delete ${s.name}`} onClick={() => persist(saved.filter((x) => x.name !== s.name))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant={showFilters ? "secondary" : "outline"} size="sm" className="h-8 gap-1.5" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <Select value={order} onValueChange={(v) => { setOrder(v); setSort(null); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SORTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(maxRows)} onValueChange={(v) => setMaxRows(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[20, 60, 100].map((n) => <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>)}</SelectContent>
          </Select>
          <a href={finvizLink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Open in Finviz <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {showFilters && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {(Object.keys(FILTER_GROUPS) as FilterKey[]).map((k) => (
                <div key={k} className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{FILTER_GROUPS[k].label}</p>
                  <Select value={filters[k] || NONE} onValueChange={(v) => setFilter(k, v)}>
                    <SelectTrigger className={`h-8 text-xs ${filters[k] ? "border-primary/60" : ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_GROUPS[k].options.map(([v, l]) => (
                        <SelectItem key={v || NONE} value={v || NONE}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setPreset(null); setFilters({}); }}>Clear all</Button>
              <Input className="h-8 w-44 text-xs" placeholder="Name this screen" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveScreen()} />
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!saveName.trim()} onClick={saveScreen}>
                <Save className="h-3.5 w-3.5" /> Save screen
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {result ? `${result.total.toLocaleString()} match${result.total === 1 ? "" : "es"}${result.total > rows.length ? ` · showing ${rows.length}` : ""}` : loading ? "Loading…" : ""}
          </span>
          <span className="hidden sm:inline">Click a ticker for live quote, chart and news</span>
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/40 p-4 text-sm">
            <p className="text-destructive">{error}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => void run(true)}>Try again</Button>
          </div>
        ) : !result && loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-shimmer h-7 rounded" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No stocks match these filters right now.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/50">
            <table className="w-full text-xs font-mono">
              <thead className="whitespace-nowrap bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted px-2 py-2 text-left">Ticker</th>
                  {COLS.map((c) => (
                    <th key={c.key} className={`px-2 py-2 text-right ${c.hideSm ? "hidden md:table-cell" : ""}`}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 uppercase hover:text-foreground"
                        onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 }))}
                      >
                        {c.label}
                        {sort?.key === c.key && (sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="hidden px-2 py-2 text-left lg:table-cell">Sector</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ticker} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left">
                      <button type="button" data-ticker={r.ticker} className="font-semibold hover:underline">{r.ticker}</button>
                      <span className="ml-2 hidden max-w-[11rem] truncate align-bottom font-sans text-[11px] text-muted-foreground sm:inline-block" title={r.company}>{r.company}</span>
                    </td>
                    {COLS.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${c.hideSm ? "hidden md:table-cell" : ""}`}>{c.render(r)}</td>
                    ))}
                    <td className="hidden max-w-[9rem] truncate px-2 py-1.5 font-sans text-[11px] text-muted-foreground lg:table-cell" title={r.industry}>{r.sector}</td>
                    <td className="px-1 py-1.5 text-right">
                      {watchlist.includes(r.ticker) || added[r.ticker] ? (
                        <span className="px-1.5 text-[10px] text-muted-foreground">✓</span>
                      ) : (
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Add to watchlist" aria-label={`Add ${r.ticker} to watchlist`} onClick={() => void add(r.ticker)}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinvizScreener;
