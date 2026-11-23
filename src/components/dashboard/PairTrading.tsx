import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, Pin, PinOff, RefreshCw, Search, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import DataAge from "@/components/dashboard/DataAge";
import { fetchTipranksSimilar } from "@/lib/tipranksPeers";
import type { NormalizedQuote } from "@/lib/tipranksQuote";
import {
  DEFAULT_OPTIONS,
  PAIR_GROUPS,
  computePair,
  describePair,
  fetchHistories,
  fetchLiveQuotes,
  groupOf,
  isLinked,
  liveSignal,
  type Bar,
  type PairOptions,
  type PairStats,
} from "@/lib/pairs";

const OPTS_KEY = "wolfcrux.pairs.opts";
const PINNED_KEY = "wolfcrux.pairs.pinned";
const QUOTES_MS = 60_000;

const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const pct = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
const tone = (v: number | null | undefined) =>
  !v ? "text-muted-foreground" : v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
const share = (x: number) => `${Math.round(x * 100)}%`;
const scoreTone = (s: number) =>
  s >= 75
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : s >= 60
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "bg-muted text-muted-foreground";
const zTone = (z: number) => (Math.abs(z) >= 2 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground");

const Tk = ({ s }: { s: string }) => (
  <button type="button" data-ticker={s} className="font-mono font-semibold hover:underline">
    {s}
  </button>
);

const Score = ({ v }: { v: number }) => (
  <span className={`inline-block min-w-[2.25rem] rounded px-1.5 py-0.5 text-center font-mono text-xs font-semibold ${scoreTone(v)}`}>{v}</span>
);

const RateCell = ({ r }: { r: { n: number; hit: number; avg: number } }) =>
  r.n === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="whitespace-nowrap">
      <span className={r.hit >= 0.6 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>{share(r.hit)}</span>
      <span className="text-muted-foreground"> · {pct(r.avg)} · {r.n}×</span>
    </span>
  );

const pairKey = (l: string, f: string) => `${l}>${f}`;

/** Table head cell with a plain-English hint. */
const Th = ({ children, hint, className = "" }: { children: React.ReactNode; hint?: string; className?: string }) => (
  <th title={hint} className={`whitespace-nowrap px-2 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground ${hint ? "cursor-help underline decoration-dotted underline-offset-2" : ""} ${className}`}>
    {children}
  </th>
);
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`whitespace-nowrap px-2 py-1.5 font-mono text-xs ${className}`}>{children}</td>
);

const HINTS = {
  score: "0–100. How reliably the follower tracks the leader: correlation, same-direction rate on big days, and catch-up rate.",
  corr: "How closely daily moves line up (1 = identical, 0 = unrelated). 1 year / last 3 months.",
  beta: "On an ordinary day, how many % the follower moves for every 1% the leader moves.",
  follow: "On the leader's big days, how often the follower moved the same way.",
  gets: "Typical share of the leader's move the follower gets on big days.",
  sameDay: "Leader opened with a big gap, follower opened behind. How often the follower kept moving the leader's way from open to close · average move · how many times.",
  nextDay: "Follower closed behind a big leader day. How often it moved the leader's way the next day · average · how many times.",
  z: "How stretched the price gap is versus the last 60 days, in standard deviations. ±2 or more is unusual (mean-reversion idea).",
  lag: "How far behind the follower is right now versus what the leader's move implies (in % points).",
};

/* ------------------------------------------------------------------ */

const PairTrading = () => {
  const [opts, setOpts] = useState<PairOptions>(() => ({ ...DEFAULT_OPTIONS, ...load(OPTS_KEY, {}) }));
  const [pinned, setPinned] = useState<string[]>(() => load<string[]>(PINNED_KEY, []));
  const [view, setView] = useState<"live" | "find" | "all">("live");

  const [hist, setHist] = useState<Record<string, Bar[]>>({});
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, NormalizedQuote>>({});
  const [quotesAt, setQuotesAt] = useState<Date | null>(null);
  const [detail, setDetail] = useState<PairStats | null>(null);

  useEffect(() => save(OPTS_KEY, opts), [opts]);
  useEffect(() => save(PINNED_KEY, pinned), [pinned]);

  const togglePin = (l: string, f: string) => {
    const k = pairKey(l, f);
    setPinned((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };

  const pinnedTickers = useMemo(() => pinned.flatMap((k) => k.split(">")), [pinned]);
  const universe = useMemo(
    () => [...new Set([...PAIR_GROUPS.flatMap((g) => g.tickers), ...pinnedTickers])],
    [pinnedTickers],
  );

  const loadHistories = useCallback(async (tickers: string[]) => {
    const need = tickers.filter((t) => !hist[t]);
    if (!need.length) return hist;
    setScan({ done: 0, total: need.length });
    const { data, failed: bad } = await fetchHistories(need, (done, total) => setScan({ done, total }));
    setScan(null);
    if (bad.length) setFailed((f) => [...new Set([...f, ...bad])]);
    const merged = { ...hist, ...data };
    setHist(merged);
    return merged;
  }, [hist]);

  // Load the pair universe once (cached per trading day in the browser).
  useEffect(() => {
    void loadHistories(universe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe.join(",")]);

  // Tickers looked up in "Who follows…" keep getting live prices too.
  const extraTickers = useRef(new Set<string>());
  const refreshQuotes = useCallback(async (extra: string[] = []) => {
    extra.forEach((t) => extraTickers.current.add(t));
    const q = await fetchLiveQuotes([...universe, ...extraTickers.current]);
    if (Object.keys(q).length) {
      setQuotes((old) => ({ ...old, ...q }));
      setQuotesAt(new Date());
    }
  }, [universe]);

  useEffect(() => {
    void refreshQuotes();
  }, [refreshQuotes]);
  useVisibleInterval(() => void refreshQuotes(), QUOTES_MS);

  /* ---------- every pair inside each group, both directions ---------- */
  const groupPairs = useMemo(() => {
    const out: PairStats[] = [];
    for (const g of PAIR_GROUPS) {
      for (const a of g.tickers) {
        for (const b of g.tickers) {
          if (a === b || !hist[a] || !hist[b]) continue;
          const p = computePair(a, b, hist[a], hist[b], opts);
          if (p) out.push(p);
        }
      }
    }
    for (const k of pinned) {
      const [a, b] = k.split(">");
      if (groupOf(a)?.tickers.includes(b) || !hist[a] || !hist[b]) continue;
      const p = computePair(a, b, hist[a], hist[b], opts);
      if (p) out.push(p);
    }
    return out;
  }, [hist, opts, pinned]);

  const statsFor = (l: string, f: string) =>
    groupPairs.find((p) => p.leader === l && p.follower === f) ??
    (hist[l] && hist[f] ? computePair(l, f, hist[l], hist[f], opts) : null);

  const scanning = scan !== null;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-mono text-base uppercase tracking-wider">Pairs</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Who follows whom, how reliably, and which followers are lagging right now. Built from the last year of daily prices.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Big move</span>
              <Select value={String(opts.bigMove)} onValueChange={(v) => setOpts((o) => ({ ...o, bigMove: Number(v) }))}>
                <SelectTrigger className="h-8 w-[80px] font-mono text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1.5, 2, 3, 4, 5].map((v) => <SelectItem key={v} value={String(v)}>{v}%+</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">History</span>
              <Select value={String(opts.lookback)} onValueChange={(v) => setOpts((o) => ({ ...o, lookback: Number(v) }))}>
                <SelectTrigger className="h-8 w-[90px] font-mono text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="63">3 months</SelectItem>
                  <SelectItem value="126">6 months</SelectItem>
                  <SelectItem value="250">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([
              ["live", "Live catch-up"],
              ["find", "Who follows…"],
              ["all", "All pairs"],
            ] as const).map(([v, label]) => (
              <Button key={v} size="sm" variant={view === v ? "default" : "outline"} className="h-8 font-mono text-xs" onClick={() => setView(v)}>
                {label}
              </Button>
            ))}
          </div>
          {scanning && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading price history {scan.done}/{scan.total} (once a day, then it's instant)
              </div>
              <Progress value={(scan.done / Math.max(scan.total, 1)) * 100} className="h-1" />
            </div>
          )}
          {!scanning && failed.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">No history for: {failed.join(", ")}</p>
          )}
        </CardHeader>
      </Card>

      {view === "live" && (
        <LiveView
          pairs={groupPairs}
          pinned={pinned}
          quotes={quotes}
          quotesAt={quotesAt}
          opts={opts}
          onRefresh={() => void refreshQuotes()}
          onOpen={setDetail}
          onPin={togglePin}
          statsFor={statsFor}
        />
      )}
      {view === "find" && (
        <FindView
          opts={opts}
          quotes={quotes}
          pinned={pinned}
          loadHistories={loadHistories}
          refreshQuotes={refreshQuotes}
          onOpen={setDetail}
          onPin={togglePin}
        />
      )}
      {view === "all" && <AllView pairs={groupPairs} quotes={quotes} onOpen={setDetail} />}

      <PairDetail
        pair={detail}
        opts={opts}
        quotes={quotes}
        pinned={detail ? pinned.includes(pairKey(detail.leader, detail.follower)) : false}
        onPin={() => detail && togglePin(detail.leader, detail.follower)}
        onClose={() => setDetail(null)}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Live catch-up                                                       */
/* ------------------------------------------------------------------ */

const LiveView = ({
  pairs, pinned, quotes, quotesAt, opts, onRefresh, onOpen, onPin, statsFor,
}: {
  pairs: PairStats[];
  pinned: string[];
  quotes: Record<string, NormalizedQuote>;
  quotesAt: Date | null;
  opts: PairOptions;
  onRefresh: () => void;
  onOpen: (p: PairStats) => void;
  onPin: (l: string, f: string) => void;
  statsFor: (l: string, f: string) => PairStats | null;
}) => {
  const [minScore, setMinScore] = useState(60);

  const rows = useMemo(() => {
    type Row = { p: PairStats; s: ReturnType<typeof liveSignal>; pinned: boolean };
    // One row per pair: the stock that moved more today is the leader (pinned pairs keep their direction).
    const best = new Map<string, Row>();
    for (const p of pairs) {
      const ql = quotes[p.leader];
      const qf = quotes[p.follower];
      if (!ql || !qf) continue;
      const isPinned = pinned.includes(pairKey(p.leader, p.follower));
      const s = liveSignal(p, ql.changesPercentage, qf.changesPercentage, opts.bigMove);
      const show = isPinned || ((s.side || s.diverging) && p.score >= minScore && Math.abs(s.leaderMove) >= opts.bigMove);
      if (!show) continue;
      const k = isPinned ? pairKey(p.leader, p.follower) : [p.leader, p.follower].sort().join("|");
      const cur = best.get(k);
      if (!cur || Math.abs(s.leaderMove) > Math.abs(cur.s.leaderMove)) best.set(k, { p, s, pinned: isPinned });
    }
    const rank = (r: Row) => (r.s.side ? 2 : r.pinned ? 1 : 0);
    return [...best.values()].sort((a, b) => rank(b) - rank(a) || b.s.lag - a.s.lag);
  }, [pairs, quotes, pinned, opts.bigMove, minScore]);

  // Leaders making a big move right now (for context).
  const movers = useMemo(() => {
    const seen = new Set<string>();
    return pairs
      .map((p) => p.leader)
      .filter((t) => !seen.has(t) && seen.add(t))
      .map((t) => ({ t, q: quotes[t] }))
      .filter((x) => x.q && Math.abs(x.q.changesPercentage) >= opts.bigMove)
      .sort((a, b) => Math.abs(b.q.changesPercentage) - Math.abs(a.q.changesPercentage));
  }, [pairs, quotes, opts.bigMove]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
              <Zap className="h-4 w-4 text-amber-500" /> Followers lagging their leader
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              A leader moved {opts.bigMove}%+ today and its follower has moved less than it normally does. Trade ideas first, then pairs that split today (usually news). Pinned pairs always show.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(minScore)} onValueChange={(v) => setMinScore(Number(v))}>
              <SelectTrigger className="h-8 w-[120px] font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="50">Score 50+</SelectItem>
                <SelectItem value="60">Score 60+</SelectItem>
                <SelectItem value="70">Score 70+</SelectItem>
                <SelectItem value="80">Score 80+</SelectItem>
              </SelectContent>
            </Select>
            <DataAge at={quotesAt} staleAfterMinutes={5} />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRefresh} aria-label="Refresh prices">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {movers.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Big movers:</span>
            {movers.slice(0, 14).map(({ t, q }) => (
              <span key={t} className="rounded border border-border/60 px-1.5 py-0.5 font-mono">
                <Tk s={t} /> <span className={tone(q.changesPercentage)}>{pct(q.changesPercentage, 1)}</span>
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {Object.keys(quotes).length === 0
              ? "Loading live prices…"
              : `No follower is lagging right now. When a leader moves ${opts.bigMove}%+ and its follower hasn't kept up, it shows here.`}
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <Th>Leader</Th>
                  <Th>Today</Th>
                  <Th>Follower</Th>
                  <Th>Today</Th>
                  <Th hint="What the follower's move would be if it tracked the leader as usual.">Should be</Th>
                  <Th hint={HINTS.lag}>Behind by</Th>
                  <Th hint={HINTS.score}>Score</Th>
                  <Th hint={HINTS.sameDay}>Caught up same day</Th>
                  <Th hint={HINTS.nextDay}>Caught up next day</Th>
                  <Th>Idea</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, s, pinned: isPinned }) => (
                  <tr key={pairKey(p.leader, p.follower)} className="cursor-pointer border-b border-border/30 hover:bg-muted/40" onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    onOpen(statsFor(p.leader, p.follower) ?? p);
                  }}>
                    <Td><Tk s={p.leader} /></Td>
                    <Td className={tone(s.leaderMove)}>{pct(s.leaderMove)}</Td>
                    <Td><Tk s={p.follower} /></Td>
                    <Td className={tone(s.followerMove)}>{pct(s.followerMove)}</Td>
                    <Td className="text-muted-foreground">{pct(s.expected)}</Td>
                    <Td className={s.lag > 0 && !s.diverging ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                      {s.lag > 0 ? `${s.lag.toFixed(2)} pts` : "—"}
                    </Td>
                    <Td><Score v={p.score} /></Td>
                    <Td><RateCell r={p.sameDay} /></Td>
                    <Td><RateCell r={p.nextDay} /></Td>
                    <Td>
                      {s.side ? (
                        <Badge className={s.side === "long" ? "bg-emerald-600 hover:bg-emerald-600" : "bg-red-600 hover:bg-red-600"}>
                          {s.side === "long" ? "Long" : "Short"} {p.follower}
                        </Badge>
                      ) : s.diverging ? (
                        <Badge variant="outline" className="text-muted-foreground" title={`${p.follower} is moving hard the other way. Usually its own news, not a lag.`}>
                          Split · check news
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onPin(p.leader, p.follower)} aria-label={isPinned ? "Unpin pair" : "Pin pair"} title={isPinned ? "Unpin" : "Pin (always show)"}>
                        {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Ideas come from past behaviour only and are not a guarantee. Check news first: a follower can lag for a real reason (its own earnings, a downgrade).
        </p>
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Who follows X                                                       */
/* ------------------------------------------------------------------ */

const FindView = ({
  opts, quotes, pinned, loadHistories, refreshQuotes, onOpen, onPin,
}: {
  opts: PairOptions;
  quotes: Record<string, NormalizedQuote>;
  pinned: string[];
  loadHistories: (t: string[]) => Promise<Record<string, Bar[]>>;
  refreshQuotes: (extra: string[]) => Promise<void>;
  onOpen: (p: PairStats) => void;
  onPin: (l: string, f: string) => void;
}) => {
  const [input, setInput] = useState("");
  const [extra, setExtra] = useState("");
  const [leader, setLeader] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, Bar[]>>({});
  const [busy, setBusy] = useState(false);

  const run = async (raw?: string) => {
    const sym = (raw ?? input).trim().toUpperCase();
    if (!sym) return;
    setInput(sym);
    setBusy(true);
    try {
      const set = new Set<string>();
      groupOf(sym)?.tickers.forEach((t) => set.add(t));
      extra.split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean).forEach((t) => set.add(t));
      const [similar, corr] = await Promise.allSettled([
        fetchTipranksSimilar(sym),
        supabase
          .from("stock_correlations")
          .select("stock1, stock2, correlation")
          .or(`stock1.eq.${sym},stock2.eq.${sym}`)
          .order("correlation", { ascending: false })
          .limit(15),
      ]);
      if (similar.status === "fulfilled") similar.value.peers.slice(0, 12).forEach((p) => set.add(p.symbol.toUpperCase()));
      if (corr.status === "fulfilled" && corr.value.data)
        for (const r of corr.value.data) {
          if (Number(r.correlation) < 50) continue;
          set.add(String(r.stock1 === sym ? r.stock2 : r.stock1).toUpperCase());
        }
      set.delete(sym);
      const list = [...set].filter((t) => /^[A-Z.-]{1,6}$/.test(t)).slice(0, 30);
      if (!list.length) {
        toast.error(`No related stocks found for ${sym}. Add some under "Also test".`);
        return;
      }
      const hist = await loadHistories([sym, ...list]);
      if (!hist[sym]) {
        toast.error(`No price history for ${sym}`);
        return;
      }
      setData(hist);
      setCandidates(list);
      setLeader(sym);
      void refreshQuotes([sym, ...list]);
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    if (!leader || !data[leader]) return [];
    return candidates
      .map((f) => (data[f] ? computePair(leader, f, data[leader], data[f], opts) : null))
      .filter((p): p is PairStats => !!p)
      .sort((a, b) => b.score - a.score);
  }, [leader, candidates, data, opts]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-sm uppercase tracking-wider">Who follows a stock?</CardTitle>
        <p className="text-xs text-muted-foreground">
          Type the leader (e.g. AMAT). We test its sector group, similar companies and your uploaded correlations, then rank the best followers.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void run()}
            placeholder="Leader, e.g. AMAT"
            className="h-9 w-[160px] font-mono uppercase"
          />
          <Input
            value={extra}
            onChange={(e) => setExtra(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void run()}
            placeholder="Also test (optional): KLAC, LRCX"
            className="h-9 min-w-[200px] flex-1 font-mono uppercase sm:max-w-[300px]"
          />
          <Button className="h-9 font-mono text-xs" onClick={() => void run()} disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />} Find followers
          </Button>
        </div>
        {!leader && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["AMAT", "NVDA", "JPM", "XOM", "COIN", "DAL", "CRWD"].map((t) => (
              <Button key={t} size="sm" variant="outline" className="h-7 font-mono text-xs" onClick={() => void run(t)}>{t}</Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {leader && rows.length > 0 && (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <Th>Follower</Th>
                  <Th hint={HINTS.score}>Score</Th>
                  <Th hint={HINTS.corr}>Corr 1y / 3m</Th>
                  <Th hint={HINTS.beta}>Moves per 1%</Th>
                  <Th hint={HINTS.follow}>Same way</Th>
                  <Th hint={HINTS.gets}>Gets</Th>
                  <Th hint={HINTS.sameDay}>Catch-up same day</Th>
                  <Th hint={HINTS.nextDay}>Catch-up next day</Th>
                  <Th hint={HINTS.z}>Spread</Th>
                  <Th>Today {leader} → follower</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const ql = quotes[p.leader];
                  const qf = quotes[p.follower];
                  const s = ql && qf ? liveSignal(p, ql.changesPercentage, qf.changesPercentage, opts.bigMove) : null;
                  const isPinned = pinned.includes(pairKey(p.leader, p.follower));
                  return (
                    <tr key={p.follower} className={`cursor-pointer border-b border-border/30 hover:bg-muted/40 ${isLinked(p) ? "" : "opacity-60"}`} onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      onOpen(p);
                    }}>
                      <Td><Tk s={p.follower} /></Td>
                      <Td><Score v={p.score} /></Td>
                      <Td>{p.corr.toFixed(2)} <span className="text-muted-foreground">/ {p.corr3m.toFixed(2)}</span></Td>
                      <Td>{p.beta.toFixed(2)}%</Td>
                      <Td>{share(p.follow.hit)} <span className="text-muted-foreground">({p.follow.n})</span></Td>
                      <Td>{share(p.capture)}</Td>
                      <Td><RateCell r={p.sameDay} /></Td>
                      <Td><RateCell r={p.nextDay} /></Td>
                      <Td className={zTone(p.spreadZ)}>{p.spreadZ.toFixed(1)}σ</Td>
                      <Td>
                        {s ? (
                          <span className="whitespace-nowrap">
                            <span className={tone(s.leaderMove)}>{pct(s.leaderMove, 1)}</span>
                            <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" />
                            <span className={tone(s.followerMove)}>{pct(s.followerMove, 1)}</span>
                            {s.side && (
                              <Badge className={`ml-2 ${s.side === "long" ? "bg-emerald-600 hover:bg-emerald-600" : "bg-red-600 hover:bg-red-600"}`}>
                                {s.side === "long" ? "Long" : "Short"} · {s.lag.toFixed(1)} pts behind
                              </Badge>
                            )}
                          </span>
                        ) : "—"}
                      </Td>
                      <Td>
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onPin(p.leader, p.follower)} aria-label={isPinned ? "Unpin pair" : "Pin pair"} title={isPinned ? "Unpin" : "Pin to Live catch-up"}>
                          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 px-2 text-[11px] text-muted-foreground">
              Faded rows don't move closely enough with {leader} to trade as followers. Tap a row for the full read-out and chart.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* All pairs                                                           */
/* ------------------------------------------------------------------ */

const AllView = ({
  pairs, quotes, onOpen,
}: {
  pairs: PairStats[];
  quotes: Record<string, NormalizedQuote>;
  onOpen: (p: PairStats) => void;
}) => {
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState<"score" | "corr" | "z" | "sameDay">("score");

  const rows = useMemo(() => {
    // One row per pair: keep the direction with the better score.
    const best = new Map<string, PairStats>();
    for (const p of pairs) {
      if (group !== "all" && !PAIR_GROUPS.find((g) => g.id === group)?.tickers.includes(p.leader)) continue;
      const k = [p.leader, p.follower].sort().join("|");
      const cur = best.get(k);
      if (!cur || p.score > cur.score) best.set(k, p);
    }
    const list = [...best.values()];
    const by: Record<typeof sort, (p: PairStats) => number> = {
      score: (p) => p.score,
      corr: (p) => p.corr,
      z: (p) => (isLinked(p) ? Math.abs(p.spreadZ) : -1),
      sameDay: (p) => (p.sameDay.n >= 5 ? p.sameDay.hit : -1),
    };
    return list.sort((a, b) => by[sort](b) - by[sort](a));
  }, [pairs, group, sort]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-sm uppercase tracking-wider">All pairs ({rows.length})</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Every pair inside each sector group, best first. Sort by "Stretched" to find pairs whose price gap is unusually wide.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="h-8 w-[170px] font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {PAIR_GROUPS.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-8 w-[170px] font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Best followers</SelectItem>
                <SelectItem value="corr">Highest correlation</SelectItem>
                <SelectItem value="sameDay">Best same-day catch-up</SelectItem>
                <SelectItem value="z">Most stretched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading pairs…</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <Th>Leader → follower</Th>
                  <Th>Group</Th>
                  <Th hint={HINTS.score}>Score</Th>
                  <Th hint={HINTS.corr}>Corr 1y / 3m</Th>
                  <Th hint={HINTS.beta}>Moves per 1%</Th>
                  <Th hint={HINTS.follow}>Same way</Th>
                  <Th hint={HINTS.sameDay}>Catch-up same day</Th>
                  <Th hint={HINTS.z}>Spread</Th>
                  <Th hint="How many days a stretched spread usually takes to get half way back.">Snap-back</Th>
                  <Th>Today</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((p) => (
                  <tr key={p.leader + p.follower} className={`cursor-pointer border-b border-border/30 hover:bg-muted/40 ${isLinked(p) ? "" : "opacity-60"}`} onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    onOpen(p);
                  }}>
                    <Td><Tk s={p.leader} /> <ArrowRight className="mx-0.5 inline h-3 w-3 text-muted-foreground" /> <Tk s={p.follower} /></Td>
                    <Td className="text-muted-foreground">{groupOf(p.leader)?.name ?? "Pinned"}</Td>
                    <Td><Score v={p.score} /></Td>
                    <Td>{p.corr.toFixed(2)} <span className="text-muted-foreground">/ {p.corr3m.toFixed(2)}</span></Td>
                    <Td>{p.beta.toFixed(2)}%</Td>
                    <Td>{share(p.follow.hit)}</Td>
                    <Td><RateCell r={p.sameDay} /></Td>
                    <Td className={zTone(p.spreadZ)}>{p.spreadZ.toFixed(1)}σ</Td>
                    <Td className="text-muted-foreground">{p.halfLife ? `${Math.round(p.halfLife)}d` : "—"}</Td>
                    <Td>
                      <span className={tone(quotes[p.leader]?.changesPercentage)}>{pct(quotes[p.leader]?.changesPercentage, 1)}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className={tone(quotes[p.follower]?.changesPercentage)}>{pct(quotes[p.follower]?.changesPercentage, 1)}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

const PairDetail = ({
  pair, opts, quotes, pinned, onPin, onClose,
}: {
  pair: PairStats | null;
  opts: PairOptions;
  quotes: Record<string, NormalizedQuote>;
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
}) => {
  const chart = useMemo(() => {
    if (!pair) return [];
    const s = pair.series.slice(-126);
    if (!s.length) return [];
    const l0 = s[0].l;
    const f0 = s[0].f;
    return s.map((r) => ({ d: r.d.slice(5), l: (r.l / l0 - 1) * 100, f: (r.f / f0 - 1) * 100 }));
  }, [pair]);

  if (!pair) return null;
  const ql = quotes[pair.leader];
  const qf = quotes[pair.follower];
  const s = ql && qf ? liveSignal(pair, ql.changesPercentage, qf.changesPercentage, opts.bigMove) : null;

  const stat = (label: string, value: React.ReactNode, hint?: string) => (
    <div className="rounded-md border border-border/60 p-2" title={hint}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
    </div>
  );

  return (
    <Dialog open={!!pair} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono">
            <Tk s={pair.leader} /> <ArrowRight className="h-4 w-4 text-muted-foreground" /> <Tk s={pair.follower} />
            <Score v={pair.score} />
            <Button size="sm" variant="outline" className="ml-auto h-7 font-mono text-xs" onClick={onPin}>
              {pinned ? <PinOff className="mr-1 h-3.5 w-3.5" /> : <Pin className="mr-1 h-3.5 w-3.5" />}
              {pinned ? "Unpin" : "Pin to Live"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {s && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            Today: {pair.leader} <span className={tone(s.leaderMove)}>{pct(s.leaderMove)}</span>, {pair.follower}{" "}
            <span className={tone(s.followerMove)}>{pct(s.followerMove)}</span>. Tracking normally, {pair.follower} would be about{" "}
            <span className="font-semibold">{pct(s.expected)}</span>
            {s.side ? (
              <>
                {" "}, so it is <span className="font-semibold text-amber-600 dark:text-amber-400">{s.lag.toFixed(2)} pts behind</span>.
                Idea: <span className="font-semibold">{s.side === "long" ? "long" : "short"} {pair.follower}</span>.
              </>
            ) : "."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("Correlation", `${pair.corr.toFixed(2)} / ${pair.corr3m.toFixed(2)}`, HINTS.corr)}
          {stat("Moves per 1%", `${pair.beta.toFixed(2)}%`, HINTS.beta)}
          {stat("Same way on big days", share(pair.follow.hit), HINTS.follow)}
          {stat("Spread", `${pair.spreadZ.toFixed(1)}σ${pair.halfLife ? ` · ${Math.round(pair.halfLife)}d` : ""}`, HINTS.z)}
        </div>

        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {describePair(pair, opts.bigMove).map((t) => <li key={t}>{t}</li>)}
          {Math.abs(pair.leadLag) >= 0.1 && (
            <li>
              {pair.leadLag > 0
                ? `${pair.leader}'s move today has tended to show up in ${pair.follower} tomorrow (next-day link ${pair.leadLag.toFixed(2)}).`
                : `${pair.follower} has tended to partly reverse the day after ${pair.leader} moves (next-day link ${pair.leadLag.toFixed(2)}).`}
            </li>
          )}
          {!isLinked(pair) && <li className="text-amber-600 dark:text-amber-400">These two don't move closely enough to trade as leader and follower.</li>}
        </ul>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="d" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="l" name={pair.leader} stroke="hsl(217, 91%, 60%)" dot={false} strokeWidth={1.75} />
              <Line type="monotone" dataKey="f" name={pair.follower} stroke="hsl(38, 92%, 55%)" dot={false} strokeWidth={1.75} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Last 6 months, % change · <span style={{ color: "hsl(217, 91%, 60%)" }}>■</span> {pair.leader}{" "}
          <span style={{ color: "hsl(38, 92%, 55%)" }}>■</span> {pair.follower}
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default PairTrading;
