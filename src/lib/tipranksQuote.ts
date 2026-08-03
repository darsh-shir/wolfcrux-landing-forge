/**
 * Shared normalizer for the TipRanks GetQuotes endpoint.
 *
 * https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=JNJ%2CAAPL
 *
 * When the regular session is closed (`isMarketOpen === false`) and the payload
 * carries a `prePostMarket` block, we display the pre/post-market price and
 * measure the move against the previous regular-session close (`lastClose`,
 * falling back to `price`). TipRanks' own `prePostMarket.changePercent` is
 * measured against the regular close *tick*, which understates the session move,
 * so we recompute it.
 */
export interface NormalizedQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changesPercentage: number;
  /** True when the displayed numbers come from the pre/post-market session. */
  isExtended: boolean;
  session: "regular" | "pre" | "post" | "closed";
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const normalizeTipranksQuote = (q: any): NormalizedQuote | null => {
  if (!q?.ticker) return null;

  const regularPrice = num(q.price) ?? 0;
  const regularChange = num(q.changeAmount) ?? 0;
  const regularPct = num(q.changePercent) ?? 0;

  const closed = q.isMarketOpen === false;
  const pp = q.prePostMarket;
  const ppPrice = pp ? num(pp.price) : null;

  if (closed && ppPrice && ppPrice > 0) {
    // Baseline = last regular-session close
    const base = num(q.lastClose) ?? regularPrice ?? 0;
    const change = base > 0 ? ppPrice - base : num(pp.changeAmount) ?? 0;
    const pct = base > 0 ? (change / base) * 100 : num(pp.changePercent) ?? 0;
    return {
      symbol: q.ticker,
      name: q.companyName,
      price: ppPrice,
      change,
      changesPercentage: pct,
      isExtended: true,
      session: q.isPremarket ? "pre" : "post",
    };
  }

  if (regularPrice <= 0) return null;

  return {
    symbol: q.ticker,
    name: q.companyName,
    price: regularPrice,
    change: regularChange,
    changesPercentage: regularPct,
    isExtended: false,
    session: closed ? "closed" : "regular",
  };
};

export const normalizeTipranksQuotes = (data: any): NormalizedQuote[] =>
  (Array.isArray(data?.quotes) ? data.quotes : [])
    .map(normalizeTipranksQuote)
    .filter((q: NormalizedQuote | null): q is NormalizedQuote => !!q);
