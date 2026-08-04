import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";

const PROXY_URL =
  "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

interface Holding {
  ticker: string;
  name: string;
  sector?: string;
  gain?: { yearly?: number };
  holdingData?: { ratio?: number; shares?: number; value?: number };
}

interface EtfPayload {
  extraData?: {
    description?: string;
    name?: string;
    fullName?: string;
    closePrice?: number;
    marketCap?: number;
    etfExtraData?: {
      assetClass?: string;
      created?: string;
      sponsor?: string;
      netExpenseRatio?: number;
      category?: string;
      index?: { name?: string };
      nav?: { value?: number; date?: string };
      holdings?: { total?: number };
      topTenPercentage?: number;
      distribution?: {
        sector?: Record<string, number>;
        country?: Record<string, number>;
      };
    };
  };
  holdings?: {
    holdings?: Holding[];
    exposures?: {
      topTenPercentage?: number;
      distribution?: {
        sector?: Record<string, number>;
      };
    };
  };
}

interface Props {
  ticker: string | null;
  sectorName: string | null;
  changePct?: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const fmtPct = (n?: number, digits = 2) =>
  typeof n === "number" ? `${(n * 100).toFixed(digits)}%` : "—";

const fmtMoney = (n?: number) => {
  if (typeof n !== "number") return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
};

const humanizeSector = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\b(\w)/g, (c) => c.toUpperCase());

const SectorDetailDialog = ({ ticker, sectorName, changePct, open, onOpenChange }: Props) => {
  const [data, setData] = useState<EtfPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ticker) return;
    setData(null);
    setError(null);
    setLoading(true);
    const url = encodeURIComponent(
      `https://tr-cdn.tipranks.com/assets/prod/etf/${ticker.toLowerCase()}/payload.json?`
    );
    fetch(`${PROXY_URL}${url}`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open, ticker]);

  const extra = data?.extraData;
  const etf = extra?.etfExtraData;
  const holdings = data?.holdings?.holdings ?? [];
  const topTen = etf?.topTenPercentage ?? data?.holdings?.exposures?.topTenPercentage;
  const distSector =
    etf?.distribution?.sector ?? data?.holdings?.exposures?.distribution?.sector ?? {};
  const isPos = (changePct ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                // Sector
              </span>
              <span className="truncate text-base sm:text-lg">
                {sectorName}
              </span>
              {ticker && (
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold">
                  {ticker}
                </span>
              )}
            </div>
            {typeof changePct === "number" && (
              <span
                className={`inline-flex items-center gap-1 font-mono tabular-nums text-sm ${
                  isPos ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {isPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPos ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="font-mono text-xs uppercase tracking-widest">Loading ETF data…</span>
          </div>
        )}

        {error && !loading && (
          <div className="py-8 text-center text-sm text-red-600 font-mono">
            Failed to load: {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-5">
            {/* Key stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "NAV", value: etf?.nav?.value ? `$${etf.nav.value.toFixed(2)}` : "—" },
                { label: "Expense", value: fmtPct(etf?.netExpenseRatio, 2) },
                { label: "AUM / Mkt Cap", value: fmtMoney(extra?.marketCap) },
                { label: "Holdings", value: etf?.holdings?.total ?? holdings.length ?? "—" },
                { label: "Top 10 Weight", value: fmtPct(topTen, 1) },
                { label: "Sponsor", value: etf?.sponsor ?? "—" },
                { label: "Category", value: etf?.category ?? "—" },
                {
                  label: "Inception",
                  value: etf?.created ? new Date(etf.created).getFullYear() : "—",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="font-mono font-bold text-sm mt-0.5 truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {extra?.description && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-1">
                  // About
                </div>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed line-clamp-6">
                  {extra.description}
                </p>
              </div>
            )}

            {/* Sector distribution */}
            {Object.keys(distSector).length > 1 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-2">
                  // Sector Breakdown
                </div>
                <div className="space-y-1.5">
                  {Object.entries(distSector)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-40 truncate font-medium">{humanizeSector(k)}</span>
                        <div className="flex-1 h-2 bg-muted/40 rounded overflow-hidden">
                          <div
                            className="h-full bg-primary/70"
                            style={{ width: `${Math.min(100, v * 100)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right font-mono tabular-nums">
                          {(v * 100).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Holdings */}
            {holdings.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-2">
                  // Holdings ({holdings.length})
                </div>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground bg-muted/40">
                    <span className="col-span-2">Ticker</span>
                    <span className="col-span-7">Name</span>
                    <span className="col-span-3 text-right">Weight</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                    {holdings.map((h) => {
                      const w = h.holdingData?.ratio;
                      return (
                        <a
                          key={h.ticker}
                          href={`https://www.tipranks.com/stocks/${h.ticker.toLowerCase()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors"
                        >
                          <span className="col-span-2 font-mono font-bold flex items-center gap-1">
                            {h.ticker}
                            <ExternalLink className="w-3 h-3 opacity-40" />
                          </span>
                          <span className="col-span-7 truncate text-muted-foreground">
                            {h.name}
                          </span>
                          <span className="col-span-3 text-right font-mono font-bold tabular-nums">
                            {typeof w === "number" ? `${(w * 100).toFixed(2)}%` : "—"}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {etf?.index?.name && (
              <div className="text-[11px] font-mono text-muted-foreground">
                Tracks: <span className="text-foreground">{etf.index.name}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SectorDetailDialog;
