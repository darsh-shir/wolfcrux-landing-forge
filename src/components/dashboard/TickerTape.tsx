import { useEffect, useRef, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { INDUSTRY_LEADERS } from "@/hooks/useTickerWatchlist";
import { toast } from "@/hooks/use-toast";

/**
 * Bloomberg/Reuters-style horizontal scrolling ticker tape.
 * - Defaults to industry leaders
 * - Users can add custom tickers via the "+" pill (persisted per-user in localStorage)
 * - User-added tickers are removable on hover
 */
export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
}

const formatPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(2);

interface TickerTapeProps {
  items: TickerItem[];
  loading?: boolean;
  onAdd?: (symbol: string) => Promise<{ ok: boolean; error?: string }>;
  onRemove?: (symbol: string) => void;
  userSymbols?: string[];
}

const TickerTape = ({ items, loading, onAdd, onRemove, userSymbols = [] }: TickerTapeProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }, [items.length]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAdd || !value.trim()) return;
    setSubmitting(true);
    const res = await onAdd(value);
    setSubmitting(false);
    if (res.ok) {
      toast({ title: "Added to ticker", description: value.trim().toUpperCase() });
      setValue("");
      setAdding(false);
    } else {
      toast({ title: "Could not add ticker", description: res.error, variant: "destructive" });
    }
  };

  if (loading || items.length === 0) {
    return (
      <div className="w-full h-9 border-y border-border/60 bg-muted/30 overflow-hidden">
        <div className="h-full flex items-center px-4 text-xs font-mono text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          Connecting to market data feed…
        </div>
      </div>
    );
  }

  // Sort: industry leaders first (in their canonical order), then user symbols
  const ordered = [
    ...INDUSTRY_LEADERS
      .map((s) => items.find((i) => i.symbol === s))
      .filter(Boolean) as TickerItem[],
    ...items.filter((i) => !INDUSTRY_LEADERS.includes(i.symbol)),
  ];

  const renderRow = (key: string) => (
    <div className="flex items-center gap-6 pr-6 shrink-0" key={key}>
      {ordered.map((it, i) => {
        const up = it.changesPercentage >= 0;
        const isUserAdded = userSymbols.includes(it.symbol);
        return (
          <span
            key={`${key}-${it.symbol}-${i}`}
            className="group flex items-center gap-2 text-xs font-mono whitespace-nowrap"
          >
            <span className="font-semibold text-foreground tracking-wider">
              {it.symbol}
            </span>
            <span className="text-foreground tabular-nums">
              {formatPrice(it.price)}
            </span>
            <span
              className={`tabular-nums ${
                up ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {up ? "▲" : "▼"} {Math.abs(it.changesPercentage).toFixed(2)}%
            </span>
            {isUserAdded && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(it.symbol)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                aria-label={`Remove ${it.symbol}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <span className="text-border">|</span>
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="w-full h-9 border-y border-border/60 bg-muted/30 overflow-hidden relative flex items-center">
      {/* Add ticker control — pinned left */}
      {onAdd && (
        <div className="relative z-30 h-full flex items-center pl-3 pr-2 border-r border-border/60 bg-background/80 backdrop-blur">
          {adding ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                onBlur={() => {
                  if (!value) setAdding(false);
                }}
                placeholder="TICKER"
                maxLength={10}
                className="w-20 h-6 bg-transparent border border-border/60 rounded-sm px-1.5 text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-6 px-2 text-[10px] font-mono uppercase tracking-wider bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-sm disabled:opacity-50 flex items-center gap-1"
              >
                {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setValue("");
                }}
                className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-emerald-600 transition-colors"
              title="Add a ticker to your live feed"
            >
              <Plus className="w-3 h-3" />
              Ticker
            </button>
          )}
        </div>
      )}

      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />

      <div className="flex-1 overflow-hidden h-full">
        <div
          ref={trackRef}
          className="flex items-center h-full animate-[ticker_90s_linear_infinite] hover:[animation-play-state:paused]"
        >
          {renderRow("a")}
          {renderRow("b")}
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default TickerTape;
