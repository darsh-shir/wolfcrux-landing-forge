import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTerminal } from "@/components/dashboard/TerminalContext";
import { useState } from "react";
import { Newspaper, Radio, ExternalLink, Clock } from "lucide-react";

interface NewsOverviewProps {
  data: any[];
  loading: boolean;
}

const NewsOverview = ({ data, loading }: NewsOverviewProps) => {
  const { watchlist } = useTerminal();
  const [mineOnly, setMineOnly] = useState(false);
  if (loading && (!data || data.length === 0)) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Newspaper className="w-3.5 h-3.5" />
            // Market Highlights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton-shimmer h-4 w-full" />
                <div className="skeleton-shimmer h-3 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const all = data || [];
  const posts = mineOnly
    ? all.filter((p: any) => (p.tickers || []).some((t: string) => watchlist.includes(t)))
    : all;

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5" />
          // Market Highlights
        </CardTitle>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMineOnly((v) => !v)}
            disabled={watchlist.length === 0}
            title={watchlist.length === 0 ? "Add tickers to your watchlist first" : "Only news about my watchlist"}
            className={`px-2 py-0.5 rounded-sm border text-[10px] font-mono uppercase tracking-wider disabled:opacity-40 ${
              mineOnly ? "bg-foreground text-background border-foreground" : "border-border/60 text-muted-foreground"
            }`}
          >
            ★ Mine
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm">
            <Radio className="w-3 h-3 animate-pulse" />
            LIVE
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {mineOnly && posts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No current headlines mention your watchlist.</p>
          )}
          {posts.slice(0, 8).map((item: any, i: number) => {
            const title = item.title || item.headline;
            const desc = item.description || item.text;
            const tickers: string[] = item.tickers || [];
            const Wrap: any = item.link ? "a" : "div";
            const wrapProps = item.link
              ? { href: item.link, target: "_blank", rel: "noopener noreferrer" }
              : {};
            return (
              <Wrap
                key={i}
                {...wrapProps}
                className="group relative pl-3 border-l-2 border-border hover:border-foreground transition-colors pb-3 block animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-foreground/70" />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:underline">
                    {title}
                  </h3>
                  {item.link && (
                    <ExternalLink className="w-3 h-3 mt-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                  )}
                </div>
                {desc && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                    {desc}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {item.timeAgo && (
                    <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                      <Clock className="w-2.5 h-2.5" />
                      {item.timeAgo}
                    </span>
                  )}
                  {tickers.slice(0, 5).map((t) => (
                    <span
                      key={t}
                      // US tickers only (news tags also include private companies like "PC:QUERA")
                      data-ticker={/^[A-Z][A-Z.-]{0,5}$/.test(t) ? t : undefined}
                      className="text-[10px] font-mono font-semibold text-foreground/80 bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded-sm hover:border-foreground/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Wrap>
            );
          })}

          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No market news available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsOverview;
