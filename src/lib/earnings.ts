// Perplexity finance earnings adapter.
// Maps the public Perplexity earnings endpoint to the existing
// TipRanks-shaped objects the Earnings UI already understands so the
// rest of the component code keeps working unchanged.

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

const sessionFromIso = (iso: string): string => {
  try {
    const d = new Date(iso);
    // Convert to ET wall clock to classify session.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const mins = h * 60 + m;
    if (mins < 9 * 60 + 30) return "PreMarket";
    if (mins >= 16 * 60) return "AfterHours";
    return "Other";
  } catch {
    return "Other";
  }
};

const periodNum = (p?: string | number | null): number => {
  if (typeof p === "number") return p;
  if (!p) return 0;
  const m = String(p).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};

export const fetchPerplexityEarnings = async (
  date: string // YYYY-MM-DD
): Promise<NormalizedEarning[]> => {
  const url = `https://www.perplexity.ai/rest/finance/earnings?date=${date}&timezone=America%2FNew_York&country=US`;
  const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
  if (!resp.ok) return [];
  const json = await resp.json();
  const items: any[] = Array.isArray(json) ? json : json?.data || [];

  return items.map((r) => ({
    ticker: r.symbol || "",
    name: r.companyName || r.symbol || "",
    sector: r.sector || "",
    marketCap: Number(r.mktCap) || 0,
    price: 0,
    change: { percent: 0, amount: 0 },
    earning: {
      isConfirm: r.status === "confirmed" || !!r.status,
      reportOnTimeOfDay: sessionFromIso(r.date),
      value: Number(r.estimatedEps) || 0,
      lastYearValue: 0,
      fiscalPeriod: periodNum(r.fiscalPeriod),
      fiscalYear: Number(r.fiscalYear) || 0,
      salesEstimate: Number(r.estimatedRevenue) || 0,
      lowEstimateEps: 0,
      highEstimateEps: 0,
      reportedEPS: r.actualEps ?? null,
    },
    analystRatings: {
      consensus: {
        id: "",
        buy: 0,
        sell: 0,
        hold: 0,
        total: 0,
        priceTarget: { value: 0 },
      },
    },
    smartScore: { value: 0 },
  }));
};
