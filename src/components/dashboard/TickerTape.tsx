import { useEffect, useRef } from "react";

/**
 * Bloomberg/Reuters-style horizontal scrolling ticker tape.
 * Pure CSS marquee, duplicated content so the loop is seamless.
 */
export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
}

const formatPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(2);

const TickerTape = ({ items, loading }: { items: TickerItem[]; loading?: boolean }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  // Restart the animation when items change so the marquee always feels fresh
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.animation = "none";
    // force reflow
    void el.offsetWidth;
    el.style.animation = "";
  }, [items.length]);

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

  const renderRow = (key: string) => (
    <div className="flex items-center gap-8 pr-8 shrink-0" key={key}>
      {items.map((it, i) => {
        const up = it.changesPercentage >= 0;
        return (
          <span
            key={`${key}-${it.symbol}-${i}`}
            className="flex items-center gap-2 text-xs font-mono whitespace-nowrap"
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
            <span className="text-border">|</span>
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="w-full h-9 border-y border-border/60 bg-muted/30 overflow-hidden relative">
      {/* edge fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />

      <div
        ref={trackRef}
        className="flex items-center h-full animate-[ticker_60s_linear_infinite] hover:[animation-play-state:paused]"
      >
        {renderRow("a")}
        {renderRow("b")}
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
