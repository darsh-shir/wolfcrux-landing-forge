import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Search, ExternalLink, Loader2, Radio } from "lucide-react";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

interface NewsItem { date: string; headline: string; url: string; source: string; rawDate: Date | null; }
interface Snapshot { earnings?: string; sector?: string; industry?: string; price?: string; change?: string; company?: string; }

const RISK_KEYWORDS = [
  "earnings", "downgrade", "upgrade", "sec ", "lawsuit", "investigation", "fraud",
  "halt", "halted", "recall", "fda", "merger", "acquisition", "acquires", "bankrupt",
  "guidance", "warns", "warning", "miss", "beats", "beat", "cuts", "slashes", "soars",
  "plunges", "surge", "tumbles", "ceo", "resign", "dividend", "split",
];

// Finviz sector filter slugs
const SECTOR_SLUGS: Record<string, string> = {
  "basic materials": "basicmaterials",
  "communication services": "communicationservices",
  "consumer cyclical": "consumercyclical",
  "consumer defensive": "consumerdefensive",
  "energy": "energy",
  "financial": "financial",
  "financial services": "financial",
  "healthcare": "healthcare",
  "industrials": "industrials",
  "real estate": "realestate",
  "technology": "technology",
  "utilities": "utilities",
};

// Compute the most-recent US market close (16:00 America/New_York) in the past, as a UTC Date.
const getPrevCloseUTC = (): Date => {
  const toET = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const now = new Date();
  const et = toET(now);
  const pivotEt = new Date(et);
  pivotEt.setHours(16, 0, 0, 0);
  if (et.getTime() < pivotEt.getTime()) pivotEt.setDate(pivotEt.getDate() - 1);
  while (pivotEt.getDay() === 0 || pivotEt.getDay() === 6) pivotEt.setDate(pivotEt.getDate() - 1);
  // Convert ET wall-clock back to a real UTC instant
  const guess = new Date(Date.UTC(
    pivotEt.getFullYear(), pivotEt.getMonth(), pivotEt.getDate(),
    pivotEt.getHours(), pivotEt.getMinutes(), 0
  ));
  const diff = guess.getTime() - toET(guess).getTime();
  return new Date(guess.getTime() + diff);
};

// Parse Finviz screener "Total: N" count from result HTML
const parseScreenerCount = (html: string): number => {
  const m = html.match(/Total:\s*<\/b>\s*(\d+)/i) || html.match(/#1\s*\/\s*(\d+)/) || html.match(/Total:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
};


const parseFinvizNews = (html: string): NewsItem[] => {
  try {
    const doc = new DOMParser().parseFromString(`<table>${html}</table>`, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    let lastDay = "";
    return rows.map((tr): NewsItem | null => {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 2) return null;
      const dateRaw = (tds[0].textContent || "").trim().replace(/\s+/g, " ");
      const a = tr.querySelector("a.tab-link-news") as HTMLAnchorElement | null;
      if (!a) return null;
      const headline = (a.textContent || "").trim();
      let url = a.getAttribute("href") || "#";
      if (url.startsWith("/")) url = `https://finviz.com${url}`;
      const sourceEl = tr.querySelector(".news-link-right span");
      const source = (sourceEl?.textContent || "").trim().replace(/^\(|\)$/g, "");
      // parse date - finviz formats: "Nov-15-25 08:30AM" or just "08:30AM"
      let datePart = dateRaw;
      let timePart = "";
      if (dateRaw.includes(" ")) {
        [datePart, timePart] = dateRaw.split(" ");
        lastDay = datePart;
      } else {
        timePart = dateRaw;
        datePart = lastDay;
      }
      let parsed: Date | null = null;
      try {
        if (datePart && timePart) {
          const d = new Date(`${datePart} ${timePart}`);
          if (!isNaN(d.getTime())) parsed = d;
        }
      } catch {}
      return { date: dateRaw, headline, url, source, rawDate: parsed };
    }).filter((x): x is NewsItem => !!x);
  } catch { return []; }
};

const parseFinvizQuote = (html: string): Snapshot => {
  const snap: Snapshot = {};
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cells = Array.from(doc.querySelectorAll(".snapshot-table2 td, table.snapshot-table2 td"));
    for (let i = 0; i < cells.length - 1; i++) {
      const label = (cells[i].textContent || "").trim();
      const val = (cells[i + 1].textContent || "").trim();
      if (label === "Earnings") snap.earnings = val;
    }
    const sectorLinks = Array.from(doc.querySelectorAll('a.tab-link'));
    if (sectorLinks[0]) snap.sector = sectorLinks[0].textContent?.trim();
    if (sectorLinks[1]) snap.industry = sectorLinks[1].textContent?.trim();
    const h2 = doc.querySelector("h2, .quote-name_ticker, .quote-header_ticker-wrapper");
    if (h2) snap.company = (h2.textContent || "").trim();
  } catch {}
  return snap;
};

const NewsCheck = () => {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const symbol = (ticker || "").toUpperCase();
  const [input, setInput] = useState(symbol);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [snap, setSnap] = useState<Snapshot>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectorEarnings, setSectorEarnings] = useState<{ count: number; sectorSlug: string | null }>({ count: 0, sectorSlug: null });
  const prevCloseUTC = useMemo(() => getPrevCloseUTC(), [symbol]);

  useEffect(() => {
    document.title = symbol ? `${symbol} • News Check` : "News Check";
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
    return () => { meta?.remove(); };
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    setInput(symbol);
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const newsUrl = `https://finviz.com/api/news/quote/${encodeURIComponent(symbol)}`;
        const quoteUrl = `https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}&p=d`;
        const [nRes, qRes] = await Promise.all([
          fetch(`${PROXY}${encodeURIComponent(newsUrl)}`),
          fetch(`${PROXY}${encodeURIComponent(quoteUrl)}`),
        ]);
        const nJson = await nRes.json().catch(() => ({}));
        const qText = await qRes.text().catch(() => "");
        // proxy may wrap quote response in JSON too
        let qHtml = qText;
        try { const parsed = JSON.parse(qText); if (parsed?.html) qHtml = parsed.html; else if (parsed?.contents) qHtml = parsed.contents; } catch {}
        if (cancelled) return;
        setNews(parseFinvizNews(nJson?.html || ""));
        const parsedSnap = parseFinvizQuote(qHtml);
        setSnap(parsedSnap);

        // Sector earnings (this week) — only if we resolved a sector
        const sectorKey = (parsedSnap.sector || "").toLowerCase().trim();
        const slug = SECTOR_SLUGS[sectorKey] || null;
        if (slug) {
          try {
            const screenerUrl = `https://finviz.com/screener.ashx?v=111&f=sec_${slug},earningsdate_thisweek`;
            const sRes = await fetch(`${PROXY}${encodeURIComponent(screenerUrl)}`);
            const sText = await sRes.text();
            let sHtml = sText;
            try { const p = JSON.parse(sText); if (p?.html) sHtml = p.html; else if (p?.contents) sHtml = p.contents; } catch {}
            if (!cancelled) setSectorEarnings({ count: parseScreenerCount(sHtml), sectorSlug: slug });
          } catch {
            if (!cancelled) setSectorEarnings({ count: 0, sectorSlug: slug });
          }
        } else {
          setSectorEarnings({ count: 0, sectorSlug: null });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  const verdict = useMemo(() => {
    if (!symbol) return null;
    const reasons: string[] = [];
    let level: "green" | "yellow" | "red" = "green";

    // Earnings check
    if (snap.earnings) {
      const e = snap.earnings.toLowerCase();
      const today = new Date();
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const m = e.match(/([a-z]{3})\s*(\d{1,2})/);
      if (m) {
        const mi = months.indexOf(m[1]);
        const day = parseInt(m[2], 10);
        if (mi >= 0) {
          const earnDate = new Date(today.getFullYear(), mi, day);
          const diff = Math.ceil((earnDate.getTime() - today.setHours(0,0,0,0)) / 86400000);
          if (diff >= 0 && diff <= 1) { level = "red"; reasons.push(`Earnings ${diff === 0 ? "today" : "tomorrow"} (${snap.earnings})`); }
          else if (diff > 1 && diff <= 3) { if (level === "green") level = "yellow"; reasons.push(`Earnings in ${diff} days (${snap.earnings})`); }
        }
      }
    }

    // Post-close news — anything after the last US market close is overnight/premarket risk
    const pivotMs = prevCloseUTC.getTime();
    const postClose = news.filter((n) => n.rawDate && n.rawDate.getTime() > pivotMs);
    if (postClose.length > 0) {
      level = "red";
      reasons.push(`${postClose.length} headline${postClose.length > 1 ? "s" : ""} since last close (${prevCloseUTC.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })})`);
    }

    // Recent news check (last 24h)
    const now = Date.now();
    const recent = news.filter((n) => n.rawDate && (now - n.rawDate.getTime()) <= 24 * 3600 * 1000);
    const risky = recent.filter((n) => RISK_KEYWORDS.some((k) => n.headline.toLowerCase().includes(k)));
    if (risky.length >= 3) { level = "red"; reasons.push(`${risky.length} high-impact headlines in last 24h`); }
    else if (risky.length >= 1) { if (level === "green") level = "yellow"; reasons.push(`${risky.length} notable headline${risky.length > 1 ? "s" : ""} in last 24h`); }
    if (recent.length >= 8 && level === "green") { level = "yellow"; reasons.push(`Heavy news flow (${recent.length} items / 24h)`); }

    // Sector-wide earnings risk
    if (sectorEarnings.count > 0 && snap.sector) {
      if (sectorEarnings.count >= 10) {
        if (level !== "red") level = "yellow";
        reasons.push(`${sectorEarnings.count} ${snap.sector} earnings this week — sector volatility risk`);
      } else {
        if (level === "green") level = "yellow";
        reasons.push(`${sectorEarnings.count} ${snap.sector} earnings this week`);
      }
    }

    if (level === "green") reasons.push("No earnings, events or significant news detected");
    return { level, reasons, postClose };
  }, [news, snap, symbol, prevCloseUTC, sectorEarnings]);

  const submit = (v?: string) => {
    const s = (v ?? input).trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (s) navigate(`/newscheck/${s}`);
  };

  const verdictStyles = verdict?.level === "red"
    ? "from-red-500/20 to-red-600/5 border-red-500/40 text-red-700 dark:text-red-400"
    : verdict?.level === "yellow"
    ? "from-amber-500/20 to-amber-600/5 border-amber-500/40 text-amber-700 dark:text-amber-400"
    : "from-emerald-500/20 to-emerald-600/5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
  const VerdictIcon = verdict?.level === "red" ? XCircle : verdict?.level === "yellow" ? AlertTriangle : CheckCircle2;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/terminal" className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-primary">
            ← Terminal
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> NewsCheck · Tradability Probe
          </span>
        </div>

        <Card className="bg-card border border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
              // Symbol
            </CardTitle>
            <div className="flex gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter ticker (e.g. SAIA)"
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="pl-8 h-10 font-mono text-sm uppercase"
                />
              </div>
              <Button onClick={() => submit()} className="h-10 font-mono text-xs uppercase tracking-wider">
                Check
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {!symbol ? (
              <p className="text-sm font-mono text-muted-foreground text-center py-10 uppercase tracking-wider">
                // Enter a symbol to run the check
              </p>
            ) : loading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="font-mono text-[11px] uppercase tracking-[0.25em]">Scanning {symbol}…</span>
              </div>
            ) : error ? (
              <p className="text-sm font-mono text-destructive text-center py-6">// {error}</p>
            ) : (
              <>
                {/* Verdict banner */}
                <div className={`rounded-lg border bg-gradient-to-br p-6 ${verdictStyles}`}>
                  <div className="flex items-start gap-4">
                    <VerdictIcon className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-70">Verdict for {symbol}</div>
                      <div className="text-2xl font-bold mt-1">
                        {verdict?.level === "red" ? "NOT CLEAR" : verdict?.level === "yellow" ? "CAUTION" : "CLEAR TO TRADE"}
                      </div>
                      <ul className="mt-3 space-y-1 text-sm">
                        {verdict?.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="opacity-60">›</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Snapshot */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Earnings", value: snap.earnings || "—" },
                    { label: "Sector", value: snap.sector || "—" },
                    { label: "Industry", value: snap.industry || "—" },
                    { label: "Sector Earnings / Wk", value: sectorEarnings.sectorSlug ? String(sectorEarnings.count) : "—" },
                    { label: "Since Last Close", value: String(verdict?.postClose?.length || 0) },
                    { label: "Headlines / 24h", value: String(news.filter((n) => n.rawDate && Date.now() - n.rawDate.getTime() <= 86400000).length) },
                  ].map((kv) => (
                    <div key={kv.label} className="border border-border/40 rounded-md p-3 bg-muted/20">
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{kv.label}</div>
                      <div className="font-mono text-sm mt-1 text-foreground truncate">{kv.value}</div>
                    </div>
                  ))}
                </div>

                {/* Recent headlines */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">// Recent Headlines</h3>
                    <Badge variant="outline" className="font-mono text-[10px]">{news.length}</Badge>
                  </div>
                  {news.length === 0 ? (
                    <p className="text-sm font-mono text-muted-foreground py-4">// No headlines</p>
                  ) : (
                    <ul className="divide-y divide-border/30 border border-border/40 rounded-md max-h-[420px] overflow-y-auto">
                      {news.slice(0, 40).map((it, i) => (
                        <li key={i}>
                          <a href={it.url} target="_blank" rel="noopener noreferrer"
                            className="grid grid-cols-[110px_1fr_auto] items-baseline gap-3 px-3 py-2 hover:bg-muted/40 transition-colors group">
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{it.date}</span>
                            <span className="text-sm text-foreground group-hover:text-primary leading-snug">{it.headline}</span>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                              {it.source}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          // Heuristic check — verify independently before trading
        </p>
      </div>
    </div>
  );
};

export default NewsCheck;
