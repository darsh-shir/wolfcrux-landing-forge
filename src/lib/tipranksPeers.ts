// Shared TipRanks "stock-similar" payload fetcher + normalizer.
// Endpoint: https://www.tipranks.com/stocks/<sym>/stock-similar/payload.json

const PROXY_URL =
  "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

export interface TipranksPeer {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  currency: string;
  exchange: string;
  image?: string;
}

export interface TipranksQuote {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  open: number;
  previousClose: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  pe: number;
  eps: number;
  priceAvg50: number;
  priceAvg200: number;
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursPercentChange?: number;
  isMarketOpen?: boolean;
}

export interface TipranksProfile {
  symbol: string;
  companyName: string;
  ceo: string;
  sector: string;
  industry: string;
  country: string;
  fullTimeEmployees: string;
  exchange: string;
  exchangeShortName: string;
  ipoDate: string;
  description: string;
  image?: string;
  website?: string;
  mktCap?: number;
}

const ISO_TO_EXCHANGE: Record<string, string> = {
  xnas: "NASDAQ",
  xnys: "NYSE",
  arcx: "NYSE ARCA",
  bats: "BATS",
  xase: "AMEX",
  xtse: "TSX",
  xtsx: "TSXV",
  xlon: "LSE",
  xetr: "XETRA",
};

const exchangeOf = (isomic?: string, tradeOn?: string): string => {
  if (isomic && ISO_TO_EXCHANGE[isomic.toLowerCase()])
    return ISO_TO_EXCHANGE[isomic.toLowerCase()];
  if (isomic) return isomic.toUpperCase();
  if (tradeOn) return tradeOn.toUpperCase();
  return "";
};

const countryOf = (address?: string): string => {
  if (!address) return "";
  const parts = address.split(",").map((s) => s.trim());
  const last = parts[parts.length - 1]?.toUpperCase() || "";
  if (last === "US") return "United States";
  return last;
};

const stockToPeer = (s: any): TipranksPeer => {
  const daily = s?.prices?.daily || {};
  const price = Number(daily.price ?? 0);
  const change = Number(daily.priceChange ?? 0);
  const changesPercentage = Number((daily.gain ?? 0) * 100);
  const marketCap =
    Number(s?.marketCap?.daily?.marketCap ?? 0) ||
    Number(s?.fundamentals?.marketCap ?? 0);
  return {
    symbol: String(s?._id ?? ""),
    name: s?.company?.fullName || s?.company?.name || s?._id || "",
    price,
    change,
    changesPercentage,
    marketCap,
    currency: s?.quotes?.currency || s?.fundamentals?.marketCapCurrency || "USD",
    exchange: exchangeOf(s?.company?.isomic, s?.company?.tradeOn),
  };
};

const stockToQuote = (s: any): TipranksQuote => {
  const daily = s?.prices?.daily || {};
  const yr = s?.prices?.year?.range || {};
  const open = s?.quotes?.open || {};
  const pre = s?.quotes?.pre || {};
  const price = Number(daily.price ?? open.price ?? 0);
  const change = Number(daily.priceChange ?? open?.change?.amount ?? 0);
  const changesPercentage = Number(
    (daily.gain ?? open?.change?.percent ?? 0) * 100
  );
  return {
    symbol: String(s?._id ?? ""),
    price,
    change,
    changesPercentage,
    dayLow: 0,
    dayHigh: 0,
    yearLow: Number(yr.low ?? 0),
    yearHigh: Number(yr.high ?? 0),
    open: Number(open.price ?? 0),
    previousClose: price - change,
    volume: Number(daily.volume ?? open.volume ?? 0),
    avgVolume: Number(s?.technical?.volume?.["30"]?.avg ?? 0),
    marketCap:
      Number(s?.marketCap?.daily?.marketCap ?? 0) ||
      Number(s?.fundamentals?.marketCap ?? 0),
    pe: Number(s?.fundamentals?.pe ?? 0),
    eps: Number(s?.earning?.reportedEPS ?? s?.earning?.lastYearValue ?? 0),
    priceAvg50: Number(s?.technical?.sma?.["50"] ?? 0),
    priceAvg200: Number(s?.technical?.sma?.["200"] ?? 0),
    afterHoursPrice: pre?.price != null ? Number(pre.price) : undefined,
    afterHoursChange:
      pre?.change?.amount != null ? Number(pre.change.amount) : undefined,
    afterHoursPercentChange:
      pre?.change?.percent != null
        ? Number(pre.change.percent) * 100
        : undefined,
    isMarketOpen: s?.quotes?.tradeTime === "open",
  };
};

const stockToProfile = (s: any): TipranksProfile => {
  const c = s?.company || {};
  return {
    symbol: String(s?._id ?? ""),
    companyName: c.fullName || c.name || "",
    ceo: c.ceo || "",
    sector: c.sector || "",
    industry: c.industry || "",
    country: countryOf(c.address),
    fullTimeEmployees: c.employees ? String(c.employees) : "",
    exchange: exchangeOf(c.isomic, c.tradeOn),
    exchangeShortName: exchangeOf(c.isomic, c.tradeOn),
    ipoDate: "",
    description: c.description || "",
    website: c.website || "",
    mktCap:
      Number(s?.marketCap?.daily?.marketCap ?? 0) ||
      Number(s?.fundamentals?.marketCap ?? 0) ||
      undefined,
  };
};

export interface TipranksSimilarResult {
  profile: TipranksProfile | null;
  quote: TipranksQuote | null;
  peers: TipranksPeer[];
}

/** Fetch TipRanks "stock-similar" payload and normalize. */
export async function fetchTipranksSimilar(
  symbol: string
): Promise<TipranksSimilarResult> {
  const sym = symbol.trim().toLowerCase();
  if (!sym) return { profile: null, quote: null, peers: [] };
  const target = `https://www.tipranks.com/stocks/${sym}/stock-similar/payload.json`;
  const res = await fetch(`${PROXY_URL}${encodeURIComponent(target)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const stocks: any[] = Array.isArray(data?.models?.stocks)
    ? data.models.stocks
    : [];
  const upper = sym.toUpperCase();
  const primary =
    stocks.find((s) => String(s?._id).toUpperCase() === upper) || stocks[0];
  if (!primary) return { profile: null, quote: null, peers: [] };

  const similarSyms: string[] = Array.isArray(primary?.similar)
    ? primary.similar
    : [];
  const byId = new Map<string, any>();
  stocks.forEach((s) => byId.set(String(s?._id).toUpperCase(), s));

  const peers = similarSyms
    .map((sym) => byId.get(sym.toUpperCase()))
    .filter(Boolean)
    .map(stockToPeer)
    .filter((p) => p.symbol);

  peers.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

  return {
    profile: stockToProfile(primary),
    quote: stockToQuote(primary),
    peers,
  };
}
