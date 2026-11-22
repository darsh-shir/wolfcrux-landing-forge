import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Plus, Star, X } from "lucide-react";
import { useTerminal } from "@/components/dashboard/TerminalContext";
import ExtendedHoursBadge from "@/components/dashboard/ExtendedHoursBadge";
import type { TickerQuote } from "@/hooks/useTickerWatchlist";

interface Props {
  /** Live quotes already loaded for the ticker tape (includes watchlist symbols). */
  quotes: TickerQuote[];
  loading: boolean;
}

/** The trader's own tickers with live prices and their price alerts. */
const WatchlistPanel = ({ quotes, loading }: Props) => {
  const { watchlist, addToWatchlist, removeFromWatchlist, alerts, removeAlert } = useTerminal();
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const activeAlerts = alerts.filter((a) => !a.triggeredAt);
  const triggered = alerts.filter((a) => a.triggeredAt).sort((a, b) => (b.triggeredAt ?? 0) - (a.triggeredAt ?? 0));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setAdding(true);
    setError(null);
    const r = await addToWatchlist(input);
    setAdding(false);
    if (r.ok) setInput("");
    else setError(r.error || "Couldn't add that ticker");
  };

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Star className="w-3.5 h-3.5" />
          // My Watchlist
        </CardTitle>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {watchlist.length} TICKERS · {activeAlerts.length} ALERTS
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Add ticker, e.g. AMD"
            className="h-8 font-mono text-xs"
            aria-label="Add ticker to watchlist"
          />
          <Button type="submit" size="sm" className="h-8" disabled={adding || !input.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
        {error && <p className="text-[11px] text-red-500">{error}</p>}

        {watchlist.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Add tickers here or with ★ in any ticker's panel. Click a ticker anywhere in the Terminal to open its panel.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {watchlist.map((sym) => {
              const q = bySymbol.get(sym);
              const up = (q?.changesPercentage ?? 0) >= 0;
              const hasAlert = activeAlerts.some((a) => a.symbol === sym);
              return (
                <li key={sym} className="group flex items-center gap-2 py-1.5 text-xs font-mono">
                  <button
                    type="button"
                    data-ticker={sym}
                    className="w-16 shrink-0 text-left font-semibold hover:underline"
                  >
                    {sym}
                  </button>
                  {hasAlert && <Bell className="h-3 w-3 text-amber-500 shrink-0" aria-label="Has price alert" />}
                  <span className="flex-1" />
                  {q ? (
                    <>
                      <ExtendedHoursBadge extended={q.extended} className="hidden sm:inline-flex" />
                      <span className="w-16 text-right tabular-nums">${q.price.toFixed(2)}</span>
                      <span className={`w-16 text-right tabular-nums ${up ? "text-emerald-600" : "text-red-500"}`}>
                        {up ? "+" : ""}
                        {q.changesPercentage.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{loading ? "…" : "—"}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromWatchlist(sym)}
                    className="opacity-60 sm:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                    aria-label={`Remove ${sym} from watchlist`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {triggered.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Triggered alerts</p>
            <ul className="space-y-1">
              {triggered.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs font-mono">
                  <BellRing className="h-3 w-3 text-amber-500" />
                  <button type="button" data-ticker={a.symbol} className="font-semibold hover:underline">
                    {a.symbol}
                  </button>
                  <span className="text-muted-foreground">
                    {a.direction === "above" ? "≥" : "≤"} ${a.price.toFixed(2)} · hit ${a.triggeredPrice?.toFixed(2)}{" "}
                    {a.triggeredAt &&
                      new Date(a.triggeredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => removeAlert(a.id)}
                    className="text-muted-foreground hover:text-red-500"
                    aria-label="Dismiss alert"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WatchlistPanel;
