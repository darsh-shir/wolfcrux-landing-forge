import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Radio, Rss } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface FinvizItem {
  date: string;
  headline: string;
  url: string;
  source: string;
}

interface Props {
  defaultSymbol?: string;
}

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

const parseFinvizHtml = (html: string): FinvizItem[] => {
  try {
    const doc = new DOMParser().parseFromString(`<table>${html}</table>`, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    return rows
      .map((tr): FinvizItem | null => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 2) return null;
        const date = (tds[0].textContent || "").trim().replace(/\s+/g, " ");
        const a = tr.querySelector("a.tab-link-news") as HTMLAnchorElement | null;
        if (!a) return null;
        const headline = (a.textContent || "").trim();
        let url = a.getAttribute("href") || "#";
        if (url.startsWith("/")) url = `https://finviz.com${url}`;
        const sourceEl = tr.querySelector(".news-link-right span");
        const source = (sourceEl?.textContent || "").trim().replace(/^\(|\)$/g, "");
        if (!headline) return null;
        return { date, headline, url, source };
      })
      .filter((x): x is FinvizItem => !!x);
  } catch {
    return [];
  }
};

const FinvizNews = ({ defaultSymbol = "SPY" }: Props) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [input, setInput] = useState(defaultSymbol);
  const [items, setItems] = useState<FinvizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const inflight = useRef(false);

  const load = async (sym: string) => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const target = `https://finviz.com/api/news/quote/${encodeURIComponent(sym)}`;
      const res = await fetch(`${PROXY}${encodeURIComponent(target)}`);
      const json = await res.json();
      setItems(parseFinvizHtml(json?.html || ""));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  };

  useEffect(() => {
    load(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const submit = () => {
    const v = input.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (v) setSymbol(v);
  };

  const grouped = useMemo(() => {
    const groups: { label: string; items: FinvizItem[] }[] = [];
    let current: { label: string; items: FinvizItem[] } | null = null;
    for (const it of items) {
      const parts = it.date.split(" ");
      const hasDay = parts.length > 1;
      const label = hasDay ? parts[0] : current?.label ?? "Earlier";
      const time = hasDay ? parts.slice(1).join(" ") : it.date;
      if (!current || current.label !== label) {
        current = { label, items: [] };
        groups.push(current);
      }
      current.items.push({ ...it, date: time });
    }
    return groups;
  }, [items]);

  return (
    <Card className="bg-card border border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-gradient-to-r from-card to-muted/20">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
              <Rss className="w-3.5 h-3.5" />
              // Finviz Wire · <span className="text-foreground">{symbol}</span>
            </CardTitle>
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm">
              <Radio className="w-3 h-3 animate-pulse" />
              PRIMARY
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Symbol (e.g. AAPL, STM, SPY)"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="pl-8 h-9 font-mono text-sm uppercase"
              />
            </div>
            <Button onClick={submit} size="sm" className="h-9 font-mono text-xs uppercase tracking-wider">
              Load
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading && items.length === 0 ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton-shimmer h-5 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm font-mono text-muted-foreground text-center py-10 uppercase tracking-wider">
            // No headlines for {symbol}
          </p>
        ) : (
          <div className="max-h-[560px] overflow-y-auto divide-y divide-border/40">
            {grouped.map((g, gi) => (
              <div key={gi}>
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-muted/60 backdrop-blur border-b border-border/40">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {g.label}
                  </span>
                </div>
                <ul className="divide-y divide-border/30">
                  {g.items.map((it, i) => (
                    <li key={i} className="group">
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid grid-cols-[72px_1fr_auto] items-baseline gap-3 px-4 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80 text-right">
                          {it.date}
                        </span>
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors leading-snug">
                          {it.headline}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                          {it.source}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinvizNews;
