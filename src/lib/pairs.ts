/**
 * Pair trading maths for the Terminal "Pairs" tab.
 *
 * Data: TipRanks daily bars (open / close / previous close) and live quotes,
 * both through the existing market proxy. Everything is computed in the
 * browser; daily history is cached per ticker for the trading day.
 *
 * The idea a trader uses: when a LEADER makes a big move and its usual
 * FOLLOWER has moved less than it normally does, the follower tends to catch
 * up. We measure, from history, how reliably that has happened for each pair.
 */
import { nyDateKey } from "@/lib/marketDate";
import { supabase } from "@/integrations/supabase/client";
import { normalizeTipranksQuotes, type NormalizedQuote } from "@/lib/tipranksQuote";

const PROXY_URL = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";
const CACHE_PREFIX = "wc-pairs-hist:";
const HISTORY_DAYS = 400; // ~275 trading days

export interface Bar {
  d: string; // YYYY-MM-DD
  o: number;
  c: number;
  pc: number;
}

/* ------------------------------------------------------------------ */
/* Curated groups (stocks that usually trade together)                 */
/* ------------------------------------------------------------------ */

export const PAIR_GROUPS: { id: string; name: string; tickers: string[] }[] = [
  { id: "semicap", name: "Chip equipment", tickers: ["AMAT", "KLAC", "LRCX", "ASML", "TER", "ONTO", "MKSI"] },
  { id: "semis", name: "Chips", tickers: ["NVDA", "AMD", "AVGO", "MRVL", "MU", "TSM", "ARM", "QCOM"] },
  { id: "analog", name: "Analog chips", tickers: ["TXN", "ADI", "NXPI", "MCHP", "ON"] },
  { id: "aiinfra", name: "AI servers & network", tickers: ["SMCI", "DELL", "ANET", "VRT", "CLS"] },
  { id: "mega", name: "Mega-cap tech", tickers: ["AAPL", "MSFT", "GOOGL", "AMZN", "META"] },
  { id: "software", name: "Software", tickers: ["CRM", "NOW", "ADBE", "ORCL", "WDAY", "SNOW", "DDOG", "MDB"] },
  { id: "cyber", name: "Cybersecurity", tickers: ["CRWD", "PANW", "ZS", "NET", "FTNT", "S"] },
  { id: "banks", name: "Big banks", tickers: ["JPM", "BAC", "C", "WFC", "GS", "MS"] },
  { id: "payments", name: "Payments", tickers: ["V", "MA", "AXP", "PYPL"] },
  { id: "crypto", name: "Crypto stocks", tickers: ["COIN", "MSTR", "MARA", "RIOT", "HOOD", "CLSK"] },
  { id: "oil", name: "Oil producers", tickers: ["XOM", "CVX", "COP", "OXY", "EOG", "DVN"] },
  { id: "oilsvc", name: "Oil services", tickers: ["SLB", "HAL", "BKR"] },
  { id: "airlines", name: "Airlines", tickers: ["DAL", "UAL", "AAL", "LUV"] },
  { id: "cruise", name: "Cruise lines", tickers: ["CCL", "RCL", "NCLH"] },
  { id: "homes", name: "Homebuilders", tickers: ["DHI", "LEN", "PHM", "TOL"] },
  { id: "metals", name: "Steel & copper", tickers: ["NUE", "STLD", "CLF", "FCX", "SCCO"] },
  { id: "retail", name: "Big-box retail", tickers: ["WMT", "COST", "TGT", "HD", "LOW"] },
  { id: "pharma", name: "Pharma", tickers: ["LLY", "NVO", "PFE", "MRK", "BMY", "ABBV"] },
  { id: "ev", name: "Autos & EV", tickers: ["TSLA", "RIVN", "GM", "F"] },
];

export const groupOf = (ticker: string) => PAIR_GROUPS.find((g) => g.tickers.includes(ticker));

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const readCache = (sym: string): Bar[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + sym);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day: string; bars: Bar[] };
    return parsed.day === nyDateKey() ? parsed.bars : null;
  } catch {
    return null;
  }
};

const writeCache = (sym: string, bars: Bar[]) => {
  try {
    localStorage.setItem(CACHE_PREFIX + sym, JSON.stringify({ day: nyDateKey(), bars }));
  } catch {
    // Storage full or blocked: drop older entries once and give up quietly.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
};

const inflight = new Map<string, Promise<Bar[]>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Download completed daily bars from the provider (today's unfinished session is dropped). */
const downloadHistory = async (sym: string): Promise<Bar[]> => {
  const url = encodeURIComponent(
    `https://www.tipranks.com/api/stocks/getHistoricalPriceExtended?daysBack=${HISTORY_DAYS}&name=${sym}`,
  );
  let res: Response | null = null;
  // Back off politely when the provider says "too many requests".
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${PROXY_URL}${url}`);
    if (res.status !== 429 && res.status < 500) break;
    await sleep(2000 * 2 ** attempt);
  }
  if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? "?"}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("No data");
  const today = nyDateKey();
  const bars: Bar[] = [];
  for (const r of data) {
    const d = String(r?.date ?? "").slice(0, 10);
    const o = Number(r?.open);
    const c = Number(r?.close);
    const pc = Number(r?.previousClose);
    if (!d || d >= today || !(o > 0) || !(c > 0) || !(pc > 0)) continue;
    bars.push({ d, o, c, pc });
  }
  bars.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  if (bars.length < 40) throw new Error("Not enough history");
  return bars;
};

/** Store a download in the shared cache so colleagues don't fetch it again today. */
const shareHistory = (sym: string, bars: Bar[]) => {
  void supabase
    .from("price_history_cache")
    .upsert({ ticker: sym, trading_day: nyDateKey(), bars: bars as never, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.warn("[pairs] could not share history", sym, error.message);
    });
};

/** Today's copies already in the shared cache. */
const readShared = async (syms: string[]): Promise<Record<string, Bar[]>> => {
  const out: Record<string, Bar[]> = {};
  for (let i = 0; i < syms.length; i += 40) {
    const { data, error } = await supabase
      .from("price_history_cache")
      .select("ticker, bars")
      .eq("trading_day", nyDateKey())
      .in("ticker", syms.slice(i, i + 40));
    if (error) break;
    for (const r of data ?? []) {
      if (Array.isArray(r.bars) && r.bars.length >= 40) out[r.ticker] = r.bars as unknown as Bar[];
    }
  }
  return out;
};

export const fetchHistory = (rawSym: string): Promise<Bar[]> => {
  const sym = rawSym.trim().toUpperCase();
  const cached = readCache(sym);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(sym);
  if (running) return running;
  const p = (async () => {
    const shared = (await readShared([sym]))[sym];
    if (shared) {
      writeCache(sym, shared);
      return shared;
    }
    const bars = await downloadHistory(sym);
    writeCache(sym, bars);
    shareHistory(sym, bars);
    return bars;
  })().finally(() => inflight.delete(sym));
  inflight.set(sym, p);
  return p;
};

/**
 * Fetch many histories: this browser's copy first, then the team's shared copy
 * for today, and only then the provider (a few at a time). Failures are
 * reported, not thrown.
 */
export const fetchHistories = async (
  tickers: string[],
  onProgress?: (done: number, total: number) => void,
  concurrency = 3,
): Promise<{ data: Record<string, Bar[]>; failed: string[] }> => {
  const list = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const data: Record<string, Bar[]> = {};
  const failed: string[] = [];

  const missing: string[] = [];
  for (const sym of list) {
    const c = readCache(sym);
    if (c) data[sym] = c;
    else missing.push(sym);
  }
  let done = list.length - missing.length;
  onProgress?.(done, list.length);
  if (!missing.length) return { data, failed };

  const shared = await readShared(missing).catch(() => ({}) as Record<string, Bar[]>);
  const toDownload: string[] = [];
  for (const sym of missing) {
    if (shared[sym]) {
      data[sym] = shared[sym];
      writeCache(sym, shared[sym]);
      done++;
    } else toDownload.push(sym);
  }
  onProgress?.(done, list.length);

  let next = 0;
  const worker = async () => {
    while (next < toDownload.length) {
      const sym = toDownload[next++];
      try {
        data[sym] = await fetchHistory(sym);
      } catch {
        failed.push(sym);
      }
      done++;
      onProgress?.(done, list.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, toDownload.length) }, worker));
  return { data, failed };
};

export const fetchLiveQuotes = async (tickers: string[]): Promise<Record<string, NormalizedQuote>> => {
  const list = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const out: Record<string, NormalizedQuote> = {};
  for (let i = 0; i < list.length; i += 60) {
    const chunk = list.slice(i, i + 60);
    const url = encodeURIComponent(
      `https://marketsv3.tipranks.com/api/quotes/GetQuotes?app_name=tr&v=2&tickers=${chunk.join(",")}`,
    );
    try {
      const res = await fetch(`${PROXY_URL}${url}`);
      if (!res.ok) continue;
      for (const q of normalizeTipranksQuotes(await res.json())) out[q.symbol.toUpperCase()] = q;
    } catch {
      /* skip chunk */
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const corr = (x: number[], y: number[]) => {
  const n = Math.min(x.length, y.length);
  if (n < 10) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    sxy += a * b;
    sxx += a * a;
    syy += b * b;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
};
const slope = (y: number[], x: number[]) => {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  return sxx ? sxy / sxx : 0;
};

export interface Rate {
  /** How many qualifying days in the lookback. */
  n: number;
  /** Share of those days it worked (0..1). */
  hit: number;
  /** Average follower move in the leader's direction, in %. */
  avg: number;
}

export interface PairStats {
  leader: string;
  follower: string;
  days: number;
  /** Daily-return correlation over the lookback and the last ~3 months. */
  corr: number;
  corr3m: number;
  /** Follower % move per 1% leader move. */
  beta: number;
  /** Leader's big days: did the follower move the same way? */
  follow: Rate;
  /** Typical share of the leader's move the follower gets on big days (1 = same %). */
  capture: number;
  /** Leader opened big, follower opened behind: did follower gain open→close in the leader's direction? */
  sameDay: Rate;
  /** Leader closed big, follower closed behind: did follower move the leader's way next day? */
  nextDay: Rate;
  /** corr(leader today, follower tomorrow) — >0.1 means the leader tends to lead by a day. */
  leadLag: number;
  /** Price spread vs its 60-day normal, in standard deviations (+ = follower rich vs leader). */
  spreadZ: number;
  /** Days for a stretched spread to get half way back (mean-reversion speed). */
  halfLife: number | null;
  /** 0..100 combined rating for "trades as a follower". */
  score: number;
  /** For charts: aligned closes. */
  series: { d: string; l: number; f: number }[];
}

export interface PairOptions {
  /** Lookback in trading days. */
  lookback: number;
  /** A "big move" for the leader, in %. */
  bigMove: number;
}

export const DEFAULT_OPTIONS: PairOptions = { lookback: 250, bigMove: 3 };

/** A pair is only "tradeable as leader → follower" when they really move together. */
export const isLinked = (p: Pick<PairStats, "corr" | "beta">) => p.corr >= 0.5 && p.beta >= 0.2;

export const computePair = (
  leader: string,
  follower: string,
  lb: Bar[],
  fb: Bar[],
  opts: PairOptions = DEFAULT_OPTIONS,
): PairStats | null => {
  const fMap = new Map(fb.map((b) => [b.d, b]));
  const rows: { d: string; L: Bar; F: Bar }[] = [];
  for (const L of lb) {
    const F = fMap.get(L.d);
    if (F) rows.push({ d: L.d, L, F });
  }
  const win = rows.slice(-opts.lookback);
  if (win.length < 40) return null;

  const rl = win.map((r) => r.L.c / r.L.pc - 1);
  const rf = win.map((r) => r.F.c / r.F.pc - 1);
  const big = opts.bigMove / 100;

  const c = corr(rl, rf);
  const c3 = corr(rl.slice(-63), rf.slice(-63));
  const beta = slope(rf, rl);
  const b = beta > 0.05 ? beta : 1; // expected-move scale; fall back to 1:1 for odd pairs

  // Big days for the leader.
  let fN = 0;
  let fHit = 0;
  const fMoves: number[] = [];
  const caps: number[] = [];
  // Next-day catch-up.
  const nd: number[] = [];
  // Same-day (open -> close) catch-up after a gap.
  const sd: number[] = [];

  for (let i = 0; i < win.length; i++) {
    const s = Math.sign(rl[i]);
    if (Math.abs(rl[i]) >= big) {
      fN++;
      if (Math.sign(rf[i]) === s) fHit++;
      fMoves.push(s * rf[i] * 100);
      caps.push(rf[i] / rl[i]);
      const lagging = s * rf[i] < 0.6 * b * Math.abs(rl[i]);
      if (lagging && i + 1 < win.length) nd.push(s * rf[i + 1] * 100);
    }
    const gL = win[i].L.o / win[i].L.pc - 1;
    if (Math.abs(gL) >= big) {
      const sg = Math.sign(gL);
      const gF = win[i].F.o / win[i].F.pc - 1;
      if (sg * gF < 0.6 * b * Math.abs(gL)) sd.push(sg * (win[i].F.c / win[i].F.o - 1) * 100);
    }
  }

  const rate = (a: number[]): Rate => ({
    n: a.length,
    hit: a.length ? a.filter((x) => x > 0).length / a.length : 0,
    avg: mean(a),
  });

  const leadLag = corr(rl.slice(0, -1), rf.slice(1));

  // Spread on log prices with a hedge ratio from the last 120 days.
  const tail = win.slice(-120);
  const ll = tail.map((r) => Math.log(r.L.c));
  const lf = tail.map((r) => Math.log(r.F.c));
  const h = slope(lf, ll);
  const spread = tail.map((_, i) => lf[i] - h * ll[i]);
  const s60 = spread.slice(-60);
  const m60 = mean(s60);
  const sd60 = Math.sqrt(mean(s60.map((x) => (x - m60) ** 2)));
  const spreadZ = sd60 ? (spread[spread.length - 1] - m60) / sd60 : 0;
  const lam = slope(
    spread.slice(1).map((x, i) => x - spread[i]),
    spread.slice(0, -1),
  );
  const halfLife = lam < 0 ? Math.log(2) / -lam : null;

  const follow = { n: fN, hit: fN ? fHit / fN : 0, avg: mean(fMoves) };
  const sameDay = rate(sd);
  const nextDay = rate(nd);
  const catchHit = sameDay.n >= 5 ? sameDay.hit : follow.hit;
  const score = Math.round(
    100 * (0.45 * Math.max(c, 0) + 0.3 * follow.hit + 0.25 * catchHit) * (fN >= 8 ? 1 : 0.85),
  );

  return {
    leader,
    follower,
    days: win.length,
    corr: c,
    corr3m: c3,
    beta,
    follow,
    capture: median(caps),
    sameDay,
    nextDay,
    leadLag,
    spreadZ,
    halfLife: halfLife && halfLife < 500 ? halfLife : null,
    score,
    series: win.map((r) => ({ d: r.d, l: r.L.c, f: r.F.c })),
  };
};

/* ------------------------------------------------------------------ */
/* Live catch-up signal                                                */
/* ------------------------------------------------------------------ */

export interface LiveSignal {
  leaderMove: number; // %
  followerMove: number; // %
  expected: number; // % the follower "should" be at given the leader
  /** How far behind the follower is, in the leader's direction (pp). Positive = lagging. */
  lag: number;
  /** "long"/"short" the follower when it is lagging a big leader move. */
  side: "long" | "short" | null;
  /** Follower is moving hard the OTHER way — usually its own news, not a lag. */
  diverging: boolean;
}

export const liveSignal = (
  stats: Pick<PairStats, "beta" | "corr">,
  leaderMove: number,
  followerMove: number,
  bigMove: number,
  minLag = 1,
): LiveSignal => {
  const b = stats.beta > 0.05 ? stats.beta : 1;
  const expected = b * leaderMove;
  const s = Math.sign(leaderMove);
  const lag = s * (expected - followerMove);
  const diverging = s * followerMove <= -bigMove / 2;
  const side =
    isLinked(stats) && !diverging && Math.abs(leaderMove) >= bigMove && lag >= minLag ? (s > 0 ? "long" : "short") : null;
  return { leaderMove, followerMove, expected, lag, side, diverging };
};

/** Plain-English read-out of a pair, for the detail view. */
export const describePair = (p: PairStats, bigMove: number) => {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lines: string[] = [];
  lines.push(
    `When ${p.leader} moves ${bigMove}%+ in a day (${p.follow.n} times in ${p.days} days), ${p.follower} moved the same way ${pct(p.follow.hit)} of the time and typically got ${pct(p.capture)} of ${p.leader}'s move.`,
  );
  lines.push(`On a normal day ${p.follower} moves about ${p.beta.toFixed(2)}% for every 1% ${p.leader} moves.`);
  if (p.sameDay.n)
    lines.push(
      `${p.sameDay.n} times ${p.leader} opened ${bigMove}%+ up or down while ${p.follower} opened behind: ${p.follower} kept moving ${p.leader}'s way from open to close ${pct(p.sameDay.hit)} of the time (average ${p.sameDay.avg >= 0 ? "+" : ""}${p.sameDay.avg.toFixed(2)}%).`,
    );
  if (p.nextDay.n)
    lines.push(
      `${p.nextDay.n} times ${p.follower} closed behind a big ${p.leader} day: the next day it moved ${p.leader}'s way ${pct(p.nextDay.hit)} of the time (average ${p.nextDay.avg >= 0 ? "+" : ""}${p.nextDay.avg.toFixed(2)}%).`,
    );
  if (Math.abs(p.spreadZ) >= 2)
    lines.push(
      `The price gap between them is stretched (${p.spreadZ.toFixed(1)}σ): ${p.follower} is ${p.spreadZ > 0 ? "expensive" : "cheap"} versus ${p.leader} compared with the last 60 days.`,
    );
  return lines;
};
