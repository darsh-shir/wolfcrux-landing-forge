// TipRanks earnings adapter.
//
// TipRanks retired the old page feed
//   https://www.tipranks.com/calendars/earnings/YYYY-MM-DD/payload.json   (now 404)
// Their earnings page now loads two JSON APIs instead, which we call through
// the Cloudflare proxy (TipRanks sends no CORS headers for other sites):
//   • /api/earnings/getCalendar/                       → company count per day
//   • /api/earnings/getByDate/?name=YYYY-MM-DD&country=us → companies reporting that day
// The day list has no live price, so prices come from the same GetQuotes
// endpoint the ticker watchlist uses.
//
// Rows are returned in the same shape the Earnings UI already expects.

import { normalizeTipranksQuotes, type ExtendedHoursQuote } from "@/lib/tipranksQuote";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";
const TR_API = "https://www.tipranks.com/api";
const QUOTES_API = "https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=";

export interface NormalizedEarning {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  change: { percent: number; amount: number };
  /** Pre-market / after-hours move (e.g. the reaction to the report). */
  extended?: ExtendedHoursQuote | null;
  earning: {
    isConfirm: boolean;
    reportOnTimeOfDay: string; // PreMarket | AfterHours | Other
    value: number;
    lastYearValue: number;
    fiscalPeriod: number;
    fiscalYear: number;
    salesEstimate: number;
    lowEstimateEps: number;
    highEstimateEps: number;
    reportedEPS: number | null;
  };
  analystRatings: {
    consensus: {
      id: string;
      buy: number;
      sell: number;
      hold: number;
      total: number;
      priceTarget: { value: number };
    };
  };
  smartScore: { value: number };
}

export interface EarningsCalendarDay {
  date: string; // YYYY-MM-DD
  count: number;
  topFollowedTickers: string[];
}

// TipRanks numeric codes, taken from the tables in TipRanks' own web app.
const TIME_OF_DAY: Record<number, string> = { 1: "AfterHours", 2: "PreMarket" }; // 3 = during market, 4 = unknown → "Other"
const SECTORS: Record<number, string> = {
  17343: "Basic Materials",
  17344: "Conglomerates",
  17346: "Financial",
  17347: "Healthcare",
  17348: "Industrials",
  17349: "Technology",
  17350: "Services",
  17351: "Utilities",
  18555: "Energy",
  18731: "Consumer Goods",
  20301: "Consumer Cyclical",
  20703: "Communication Services",
  60463: "Real Estate",
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const viaProxy = async (url: string) => {
  const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
  if (!resp.ok) throw new Error(`TipRanks request failed (${resp.status}): ${url}`);
  return resp.json();
};

const mapRow = (r: any): NormalizedEarning => {
  const ratings = r?.ratingsAndPT || {};
  const buy = num(ratings.numBuys);
  const hold = num(ratings.numHolds);
  const sell = num(ratings.numSells);
  return {
    ticker: r?.ticker || "",
    name: r?.company || r?.ticker || "",
    sector: SECTORS[r?.sector] || "",
    marketCap: num(r?.marketCap),
    price: 0, // filled in from live quotes below
    change: { percent: 0, amount: 0 },
    earning: {
      isConfirm: !!r?.isConfirmed,
      reportOnTimeOfDay: TIME_OF_DAY[r?.timeOfDay] || "Other",
      value: num(r?.eps),
      lastYearValue: num(r?.lastEps),
      fiscalPeriod: num(r?.fiscalPeriod),
      fiscalYear: num(r?.fiscalYear),
      // The API reports sales in millions; the UI formats whole dollars.
      salesEstimate: num(r?.salesEstimate) * 1e6,
      lowEstimateEps: num(r?.lowEstimate),
      highEstimateEps: num(r?.highEstimate),
      reportedEPS: r?.reportedEPS ?? null,
    },
    analystRatings: {
      consensus: {
        id: "",
        buy,
        sell,
        hold,
        total: buy + hold + sell,
        priceTarget: { value: num(ratings.priceTarget) },
      },
    },
    smartScore: { value: num(r?.smartScore) },
  };
};

/** Add live price / daily change. Failures are ignored (price stays 0 and is hidden). */
const addQuotes = async (rows: NormalizedEarning[]) => {
  const tickers = [...new Set(rows.map((r) => r.ticker).filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += 50) chunks.push(tickers.slice(i, i + 50));

  const results = await Promise.allSettled(
    chunks.map((c) => viaProxy(QUOTES_API + c.map(encodeURIComponent).join("%2C")))
  );
  const quotes = new Map(
    results
      .flatMap((r) => (r.status === "fulfilled" ? normalizeTipranksQuotes(r.value) : []))
      .map((q) => [q.symbol, q])
  );

  for (const row of rows) {
    const q = quotes.get(row.ticker);
    if (!q) continue;
    row.price = q.price;
    // The UI expects a fraction (0.012 = 1.2%); quotes come in percent.
    row.change = { percent: q.changesPercentage / 100, amount: q.change };
    row.extended = q.extended;
  }
  return rows;
};

/** Companies reporting on `date` (YYYY-MM-DD). Name kept for existing callers. */
export const fetchPerplexityEarnings = async (date: string): Promise<NormalizedEarning[]> => {
  try {
    const json = await viaProxy(`${TR_API}/earnings/getByDate/?name=${date}&country=us`);
    const rows = (Array.isArray(json) ? json : []).map(mapRow);
    return await addQuotes(rows);
  } catch (e) {
    console.error("TipRanks earnings fetch failed", e);
    return [];
  }
};

/** Just the tickers reporting on `date` (one request, no quotes). */
export const fetchEarningsTickers = async (date: string): Promise<string[]> => {
  try {
    const json = await viaProxy(`${TR_API}/earnings/getByDate/?name=${date}&country=us`);
    return (Array.isArray(json) ? json : []).map((r: any) => String(r?.ticker || "")).filter(Boolean);
  } catch {
    return [];
  }
};

// The calendar endpoint returns every day for roughly the next year at once,
// so one request serves every date the UI asks about.
let calendarCache: Promise<EarningsCalendarDay[]> | null = null;

export const fetchTipranksCalendar = async (_date?: string): Promise<EarningsCalendarDay[]> => {
  if (!calendarCache) {
    calendarCache = viaProxy(`${TR_API}/earnings/getCalendar/`)
      .then((json: any) =>
        (Array.isArray(json) ? json : []).map((d: any) => ({
          date: String(d?.date || "").split("T")[0],
          count: num(d?.count),
          topFollowedTickers: Array.isArray(d?.topFollowedTickers) ? d.topFollowedTickers : [],
        }))
      )
      .catch((e) => {
        calendarCache = null; // allow a retry next time
        console.error("TipRanks calendar fetch failed", e);
        return [];
      });
  }
  return calendarCache;
};
