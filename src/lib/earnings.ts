// TipRanks earnings adapter.
// Fetches https://www.tipranks.com/calendars/earnings/YYYY-MM-DD/payload.json
// via the Cloudflare proxy and returns rows in the shape the Earnings UI
// already expects.

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

export interface NormalizedEarning {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  change: { percent: number; amount: number };
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

const mapRow = (r: any): NormalizedEarning => {
  const e = r?.earning || {};
  const c = r?.analystRatings?.consensus || {};
  return {
    ticker: r?.ticker || "",
    name: r?.name || r?.ticker || "",
    sector: r?.sector || "",
    marketCap: Number(r?.marketCap) || 0,
    price: Number(r?.price) || 0,
    change: {
      percent: Number(r?.change?.percent) || 0,
      amount: Number(r?.change?.amount) || 0,
    },
    earning: {
      isConfirm: !!e.isConfirm,
      reportOnTimeOfDay: e.reportOnTimeOfDay || "Other",
      value: Number(e.value) || 0,
      lastYearValue: Number(e.lastYearValue) || 0,
      fiscalPeriod: Number(e.fiscalPeriod) || 0,
      fiscalYear: Number(e.fiscalYear) || 0,
      salesEstimate: Number(e.salesEstimate) || 0,
      lowEstimateEps: Number(e.lowEstimateEps) || 0,
      highEstimateEps: Number(e.highEstimateEps) || 0,
      reportedEPS: e.reportedEPS ?? null,
    },
    analystRatings: {
      consensus: {
        id: c.id || "",
        buy: Number(c.buy) || 0,
        sell: Number(c.sell) || 0,
        hold: Number(c.hold) || 0,
        total: Number(c.total) || 0,
        priceTarget: { value: Number(c?.priceTarget?.value) || 0 },
      },
    },
    smartScore: { value: Number(r?.smartScore?.value) || 0 },
  };
};

const fetchTipranks = async (date: string) => {
  const url = `https://www.tipranks.com/calendars/earnings/${date}/payload.json`;
  const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
  if (!resp.ok) return null;
  return resp.json();
};

export const fetchPerplexityEarnings = async (
  date: string
): Promise<NormalizedEarning[]> => {
  try {
    const json = await fetchTipranks(date);
    const rows: any[] = json?.data?.tableData || [];
    return rows.map(mapRow);
  } catch (e) {
    console.error("TipRanks earnings fetch failed", e);
    return [];
  }
};

export const fetchTipranksCalendar = async (
  date: string
): Promise<EarningsCalendarDay[]> => {
  try {
    const json = await fetchTipranks(date);
    const items: any[] = json?.data?.calendarData || [];
    return items.map((d) => ({
      date: (d?.date || "").split("T")[0],
      count: Number(d?.count) || 0,
      topFollowedTickers: Array.isArray(d?.topFollowedTickers)
        ? d.topFollowedTickers
        : [],
    }));
  } catch (e) {
    console.error("TipRanks calendar fetch failed", e);
    return [];
  }
};
