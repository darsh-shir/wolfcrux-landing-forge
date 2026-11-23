// Finviz stock screener, fetched through the Cloudflare proxy (free Finviz:
// quotes are delayed ~15–20 min; live prices come from TipRanks elsewhere).
// Finviz embeds the result rows as JSON in the page, so no HTML scraping.
const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";
const PAGE_SIZE = 20; // free Finviz returns 20 rows per page
// Custom view columns: ticker, company, sector, industry, market cap, P/E, float,
// short float, short ratio, RSI, change from open, gap, recom, price, change,
// volume, avg volume, rel volume, earnings date.
const COLUMNS = "1,2,3,4,6,7,25,30,31,59,60,61,62,63,64,65,66,67,68";
const CACHE_MS = 2 * 60_000;

export interface ScreenerRow {
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  marketCap: number | null; // $M
  pe: number | null;
  price: number | null;
  change: number | null; // %
  changeFromOpen: number | null; // %
  gap: number | null; // %
  volume: number | null;
  avgVolume: number | null;
  relVolume: number | null;
  floatShares: number | null; // M
  shortFloat: number | null; // %
  rsi: number | null;
  recom: number | null; // 1 strong buy … 5 strong sell
  earningsDate: string | null;
}
export interface ScreenerResult {
  rows: ScreenerRow[];
  total: number;
  fetchedAt: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function extractData(html: string): { rows: unknown[]; totalCount: number } {
  const i = html.indexOf('"data":{"rows":');
  if (i < 0) throw new Error("Finviz didn't return results (page format changed or request blocked).");
  const start = html.indexOf("{", i + 7);
  let depth = 0;
  let inStr = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (c === "\\") j++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(html.slice(start, j + 1));
  }
  throw new Error("Couldn't read Finviz results.");
}

const toRow = (r: { text?: Record<string, string>; numbers?: Record<string, number> }): ScreenerRow => {
  const t = r.text ?? {};
  const n = r.numbers ?? {};
  return {
    ticker: t.ticker ?? "",
    company: t.company ?? "",
    sector: t.sector ?? "",
    industry: t.industry ?? "",
    marketCap: num(n.marketCap),
    pe: num(n.PE ?? n.pe),
    price: num(n.price),
    change: num(n.change),
    changeFromOpen: num(n.changeopen),
    gap: num(n.gap),
    volume: num(n.volume),
    avgVolume: num(n.averageVolume),
    relVolume: num(n.relativeVolume),
    floatShares: num(n.sharesFloat),
    shortFloat: num(n.shortInterestShare),
    rsi: num(n.rsi),
    recom: num(n.recom),
    earningsDate: t.earningsDate ?? null,
  };
};

const cache = new Map<string, { at: number; promise: Promise<ScreenerResult> }>();

/**
 * Run a Finviz screen. `filters` are Finviz filter codes (e.g. "cap_largeover",
 * "sh_relvol_o2"); `order` is a Finviz sort code (e.g. "-change"). Loads up to
 * `maxRows` results (20 per request).
 */
export function runScreen(filters: string[], order: string, maxRows = 60, force = false): Promise<ScreenerResult> {
  const key = `${[...filters].sort().join(",")}|${order}|${maxRows}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const page = async (r: number) => {
    const url = `https://finviz.com/screener.ashx?v=152&f=${filters.map(encodeURIComponent).join(",")}&o=${encodeURIComponent(order)}&c=${COLUMNS}&r=${r}`;
    const res = await fetch(`${PROXY}${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Finviz request failed (HTTP ${res.status})`);
    return extractData(await res.text());
  };
  const promise = (async () => {
    const first = await page(1);
    const total = Number(first.totalCount) || first.rows.length;
    const pages = Math.min(Math.ceil(Math.min(total, maxRows) / PAGE_SIZE), Math.ceil(maxRows / PAGE_SIZE));
    // Remaining pages one after another, gently, to stay polite to Finviz.
    const rest: unknown[] = [];
    for (let p = 1; p < pages; p++) rest.push(...(await page(p * PAGE_SIZE + 1)).rows);
    const rows = [...first.rows, ...rest].map((r) => toRow(r as never)).filter((r) => r.ticker);
    return { rows: rows.slice(0, maxRows), total, fetchedAt: Date.now() };
  })();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

/** Filter choices shown in the screener (Finviz codes). */
export const FILTER_GROUPS = {
  marketCap: {
    label: "Market cap",
    options: [
      ["", "Any"], ["cap_mega", "Mega ($200B+)"], ["cap_largeover", "Large+ ($10B+)"], ["cap_midover", "Mid+ ($2B+)"],
      ["cap_smallover", "Small+ ($300M+)"], ["cap_small", "Small ($300M–2B)"], ["cap_micro", "Micro ($50–300M)"],
    ],
  },
  price: {
    label: "Price",
    options: [["", "Any"], ["sh_price_o5", "Over $5"], ["sh_price_o10", "Over $10"], ["sh_price_o20", "Over $20"], ["sh_price_o50", "Over $50"], ["sh_price_u10", "Under $10"], ["sh_price_u5", "Under $5"]],
  },
  avgVolume: {
    label: "Avg volume",
    options: [["", "Any"], ["sh_avgvol_o200", "Over 200K"], ["sh_avgvol_o500", "Over 500K"], ["sh_avgvol_o1000", "Over 1M"], ["sh_avgvol_o2000", "Over 2M"]],
  },
  relVolume: {
    label: "Relative volume",
    options: [["", "Any"], ["sh_relvol_o1.5", "Over 1.5×"], ["sh_relvol_o2", "Over 2×"], ["sh_relvol_o3", "Over 3×"], ["sh_relvol_o5", "Over 5×"]],
  },
  change: {
    label: "Change today",
    options: [["", "Any"], ["ta_change_u", "Up"], ["ta_change_d", "Down"], ["ta_change_u5", "Up 5%+"], ["ta_change_u10", "Up 10%+"], ["ta_change_d5", "Down 5%+"], ["ta_change_d10", "Down 10%+"]],
  },
  gap: {
    label: "Gap",
    options: [["", "Any"], ["ta_gap_u3", "Gap up 3%+"], ["ta_gap_u5", "Gap up 5%+"], ["ta_gap_d3", "Gap down 3%+"], ["ta_gap_d5", "Gap down 5%+"]],
  },
  sector: {
    label: "Sector",
    options: [
      ["", "Any"], ["sec_technology", "Technology"], ["sec_healthcare", "Healthcare"], ["sec_financial", "Financial"],
      ["sec_consumercyclical", "Consumer Cyclical"], ["sec_consumerdefensive", "Consumer Defensive"], ["sec_communicationservices", "Communication"],
      ["sec_industrials", "Industrials"], ["sec_energy", "Energy"], ["sec_basicmaterials", "Basic Materials"], ["sec_realestate", "Real Estate"], ["sec_utilities", "Utilities"],
    ],
  },
  float: {
    label: "Float",
    options: [["", "Any"], ["sh_float_u20", "Under 20M"], ["sh_float_u50", "Under 50M"], ["sh_float_u100", "Under 100M"], ["sh_float_o100", "Over 100M"]],
  },
  shortFloat: {
    label: "Short float",
    options: [["", "Any"], ["sh_short_o10", "Over 10%"], ["sh_short_o20", "Over 20%"], ["sh_short_o30", "Over 30%"]],
  },
  highLow: {
    label: "52-week",
    options: [["", "Any"], ["ta_highlow52w_nh", "New high"], ["ta_highlow52w_nl", "New low"], ["ta_highlow52w_b0to5h", "Within 5% of high"]],
  },
  earnings: {
    label: "Earnings",
    options: [["", "Any"], ["earningsdate_today", "Today"], ["earningsdate_tomorrow", "Tomorrow"], ["earningsdate_thisweek", "This week"], ["earningsdate_nextweek", "Next week"]],
  },
} as const;
export type FilterKey = keyof typeof FILTER_GROUPS;

export const SORTS = [
  ["-change", "% change ↓"], ["change", "% change ↑"], ["-relativevolume", "Rel volume ↓"], ["-volume", "Volume ↓"],
  ["-gap", "Gap ↓"], ["gap", "Gap ↑"], ["-marketcap", "Market cap ↓"], ["-shortinterestshare", "Short float ↓"],
] as const;

/** One-click screens. Base liquidity: $5+ and 500K+ average volume. */
export const PRESETS: { id: string; label: string; filters: Partial<Record<FilterKey, string>>; order: string }[] = [
  { id: "gainers", label: "Top gainers", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", change: "ta_change_u5" }, order: "-change" },
  { id: "losers", label: "Top losers", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", change: "ta_change_d5" }, order: "change" },
  { id: "gapup", label: "Gap up", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", gap: "ta_gap_u3" }, order: "-gap" },
  { id: "gapdown", label: "Gap down", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", gap: "ta_gap_d3" }, order: "gap" },
  { id: "unusual", label: "Unusual volume", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", relVolume: "sh_relvol_o2" }, order: "-relativevolume" },
  { id: "earnings", label: "Earnings today", filters: { avgVolume: "sh_avgvol_o200", earnings: "earningsdate_today" }, order: "-change" },
  { id: "short", label: "High short float", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", shortFloat: "sh_short_o20" }, order: "-change" },
  { id: "highs", label: "New 52-week highs", filters: { price: "sh_price_o5", avgVolume: "sh_avgvol_o500", highLow: "ta_highlow52w_nh" }, order: "-change" },
  { id: "largecap", label: "Large-cap movers", filters: { marketCap: "cap_largeover", change: "ta_change_u" }, order: "-change" },
];
