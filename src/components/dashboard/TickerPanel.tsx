import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, BellRing, ExternalLink, Loader2, Star, StarOff, Trash2 } from "lucide-react";
import { normalizeTipranksQuotes, type NormalizedQuote } from "@/lib/tipranksQuote";
import { fetchFinvizNews, type FinvizItem } from "@/lib/finviz";
import { fetchTipranksSimilar, type TipranksPeer } from "@/lib/tipranksPeers";
import { useTerminal } from "@/components/dashboard/TerminalContext";
import ExtendedHoursBadge from "@/components/dashboard/ExtendedHoursBadge";
import { toast } from "@/hooks/use-toast";
import { fmtAmt } from "@/lib/utils";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

const compact = (n?: number) => {
  if (!n) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

const pctClass = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500");
const signed = (n: number, digits = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;

interface Props {
  symbol: string | null;
  onClose: () => void;
}

/** Slide-over with everything about one ticker. Opened from anywhere in the Terminal. */
const TickerPanel = ({ symbol, onClose }: Props) => {
  const { watchlist, addToWatchlist, removeFromWatchlist, alerts, addAlert, removeAlert, openTicker } = useTerminal();
  const [quote, setQuote] = useState<NormalizedQuote | null>(null);
  const [quoteState, setQuoteState] = useState<"loading" | "ok" | "missing">("loading");
  const [news, setNews] = useState<FinvizItem[] | null>(null);
  const [peers, setPeers] = useState<TipranksPeer[] | null>(null);
  const [alertPrice, setAlertPrice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setQuote(null);
    setQuoteState("loading");
    setNews(null);
    setPeers(null);
    setAlertPrice("");

    const target = `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${encodeURIComponent(
      symbol
    )}`;
    fetch(`${PROXY}${encodeURIComponent(target)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const q = normalizeTipranksQuotes(d)[0] ?? null;
        setQuote(q);
        setQuoteState(q ? "ok" : "missing");
      })
      .catch(() => !cancelled && setQuoteState("missing"));

    fetchFinvizNews(symbol)
      .then((items) => !cancelled && setNews(items.slice(0, 8)))
      .catch(() => !cancelled && setNews([]));

    fetchTipranksSimilar(symbol)
      .then((r) => !cancelled && setPeers(r.peers.slice(0, 8)))
      .catch(() => !cancelled && setPeers([]));

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!symbol) return null;

  const watched = watchlist.includes(symbol);
  const myAlerts = alerts.filter((a) => a.symbol === symbol);
  const last = quote ? quote.extended?.price ?? quote.price : 0;

  const toggleWatch = async () => {
    if (watched) {
      removeFromWatchlist(symbol);
      return;
    }
    setBusy(true);
    const r = await addToWatchlist(symbol);
    setBusy(false);
    if (!r.ok) toast({ title: "Couldn't add to watchlist", description: r.error, variant: "destructive" });
  };

  const createAlert = () => {
    const price = Number(alertPrice);
    if (!Number.isFinite(price) || price <= 0 || !last) return;
    addAlert(symbol, price >= last ? "above" : "below", price);
    setAlertPrice("");
    toast({
      title: `Alert set for ${symbol}`,
      description: `When it trades ${price >= last ? "at or above" : "at or below"} $${fmtAmt(price, 2)}.`,
    });
  };

  return (
    <Sheet open={!!symbol} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-mono tracking-wider text-xl">{symbol}</SheetTitle>
          <SheetDescription className="truncate">{quote?.name || " "}</SheetDescription>
        </SheetHeader>

        {/* ---------- Quote ---------- */}
        <section className="mt-4 rounded-md border border-border/60 p-4">
          {quoteState === "loading" && <div className="skeleton-shimmer h-16 rounded" />}
          {quoteState === "missing" && (
            <p className="text-sm text-muted-foreground">No quote found for {symbol}.</p>
          )}
          {quote && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums">${fmtAmt(quote.price, 2)}</span>
                <span className={`font-mono tabular-nums text-sm font-semibold ${pctClass(quote.changesPercentage)}`}>
                  {signed(quote.change)} ({signed(quote.changesPercentage)}%)
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                <span>{quote.session === "closed" ? "At close" : "Regular session"}</span>
                <ExtendedHoursBadge extended={quote.extended} showPrice />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <dt className="text-muted-foreground">Day range</dt>
                  <dd className="tabular-nums">
                    {quote.dayLow && quote.dayHigh ? `${quote.dayLow.toFixed(2)}–${quote.dayHigh.toFixed(2)}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Volume</dt>
                  <dd className="tabular-nums">{compact(quote.volume)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mkt cap</dt>
                  <dd className="tabular-nums">{compact(quote.marketCap)}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        {/* ---------- Actions ---------- */}
        <section className="mt-4 flex flex-wrap gap-2">
          <Button variant={watched ? "secondary" : "default"} size="sm" onClick={toggleWatch} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : watched ? (
              <StarOff className="mr-1.5 h-4 w-4" />
            ) : (
              <Star className="mr-1.5 h-4 w-4" />
            )}
            {watched ? "Remove from watchlist" : "Add to watchlist"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`https://www.tipranks.com/stocks/${symbol.toLowerCase()}`} target="_blank" rel="noopener noreferrer">
              TipRanks <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </section>

        {/* ---------- Price alerts ---------- */}
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> Price alert
          </h3>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createAlert();
            }}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder={last ? `e.g. ${(last * 1.03).toFixed(2)}` : "Price"}
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              className="font-mono"
              aria-label={`Alert price for ${symbol}`}
            />
            <Button type="submit" size="sm" disabled={!alertPrice || !last}>
              Set alert
            </Button>
          </form>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Notifies you in this browser while the Terminal is open.
          </p>
          {myAlerts.length > 0 && (
            <ul className="mt-2 space-y-1">
              {myAlerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-xs font-mono"
                >
                  <span className="flex items-center gap-1.5">
                    {a.triggeredAt ? (
                      <BellRing className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {a.direction === "above" ? "≥" : "≤"} ${fmtAmt(a.price, 2)}
                    {a.triggeredAt && (
                      <span className="text-amber-600">· hit at ${fmtAmt(a.triggeredPrice, 2)}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAlert(a.id)}
                    className="text-muted-foreground hover:text-red-500"
                    aria-label="Delete alert"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- News ---------- */}
        <section className="mt-6">
          <h3 className="mb-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Headlines</h3>
          {news === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer h-8 rounded" />
              ))}
            </div>
          ) : news.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent headlines.</p>
          ) : (
            <ul className="space-y-2">
              {news.map((n) => (
                <li key={n.url + n.headline}>
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm leading-snug hover:underline"
                  >
                    {n.headline}
                  </a>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {n.date} {n.source && `· ${n.source}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Peers ---------- */}
        <section className="mt-6 mb-4">
          <h3 className="mb-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Peers</h3>
          {peers === null ? (
            <div className="skeleton-shimmer h-16 rounded" />
          ) : peers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No peers found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {peers.map((p) => (
                <button
                  key={p.symbol}
                  type="button"
                  onClick={() => openTicker(p.symbol)}
                  className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5 text-left text-xs font-mono hover:bg-muted/40"
                >
                  <span className="font-semibold">{p.symbol}</span>
                  {Number.isFinite(p.changesPercentage) && p.price > 0 && (
                    <span className={`tabular-nums ${pctClass(p.changesPercentage)}`}>
                      {signed(p.changesPercentage)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
};

export default TickerPanel;
