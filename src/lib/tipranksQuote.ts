/**
 * Shared normalizer for the TipRanks GetQuotes endpoint.
 *
 * https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=JNJ%2CAAPL
 *
 * `price` / `change` / `changesPercentage` are ALWAYS the regular session
 * (the live session while the market is open, otherwise the last close), so a
 * day's real move is never replaced by a thin after-hours print.
 *
 * When the market is closed and TipRanks has a pre/post-market print, it is
 * returned separately in `extended`, measured against that regular close.
 * (TipRanks' own `prePostMarket.changePercent` uses the close *tick*, which can
 * differ slightly, so we recompute it.)
 */
export interface ExtendedHoursQuote {
  session: "pre" | "post";
  price: number;
  change: number;
  changesPercentage: number;
}

export interface NormalizedQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changesPercentage: number;
  /** Pre-market or after-hours move, when the regular session is closed. */
  extended: ExtendedHoursQuote | null;
  session: "regular" | "closed";
  volume?: number;
  marketCap?: number;
  dayLow?: number;
  dayHigh?: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const normalizeTipranksQuote = (q: any): NormalizedQuote | null => {
  if (!q?.ticker) return null;

  const price = num(q.price) ?? 0;
  if (price <= 0) return null;

  const closed = q.isMarketOpen === false;
  const ppPrice = num(q.prePostMarket?.price);

  let extended: ExtendedHoursQuote | null = null;
  // Ignore sub-cent differences (they would show as a meaningless "AH +0.00%").
  if (closed && ppPrice && ppPrice > 0 && Math.abs(ppPrice - price) >= 0.005) {
    const change = ppPrice - price;
    extended = {
      session: q.isPremarket ? "pre" : "post",
      price: ppPrice,
      change,
      changesPercentage: (change / price) * 100,
    };
  }

  return {
    symbol: q.ticker,
    name: q.companyName,
    price,
    change: num(q.changeAmount) ?? 0,
    changesPercentage: num(q.changePercent) ?? 0,
    extended,
    session: closed ? "closed" : "regular",
    volume: num(q.volume) ?? undefined,
    marketCap: num(q.marketCap) ?? undefined,
    dayLow: num(q.low) ?? undefined,
    dayHigh: num(q.high) ?? undefined,
  };
};

export const normalizeTipranksQuotes = (data: any): NormalizedQuote[] =>
  (Array.isArray(data?.quotes) ? data.quotes : [])
    .map(normalizeTipranksQuote)
    .filter((q: NormalizedQuote | null): q is NormalizedQuote => !!q);

/** Short label for an extended-hours session, e.g. "AH" / "PM". */
export const extendedLabel = (e: ExtendedHoursQuote | null | undefined) =>
  e ? (e.session === "pre" ? "PM" : "AH") : "";
