import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Newspaper, Clock, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MarketNewsProps {
  data: any;
  loading: boolean;
}

const MarketNews = ({ data, loading }: MarketNewsProps) => {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [stockNews, setStockNews] = useState<any>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [activeSearch, setActiveSearch] = useState("");

  const posts = stockNews?.posts || data?.posts || [];

  const handleSearch = async () => {
    if (!searchSymbol.trim()) return;
    
    const symbol = searchSymbol.trim().toUpperCase();
    setStockLoading(true);
    setActiveSearch(symbol);
    
    try {
      const response = await fetch(
        `https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=https://www.perplexity.ai/rest/finance/news/${symbol}`
      );
      const data = await response.json();
      setStockNews(data);
    } catch (error) {
      console.error("Error fetching stock news:", error);
    } finally {
      setStockLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchSymbol("");
    setStockNews(null);
    setActiveSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  const isLoading = stockLoading || (loading && posts.length === 0);

  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
              <Newspaper className="w-3.5 h-3.5" />
              // {activeSearch ? `${activeSearch} Feed` : "Market Wire"}
            </CardTitle>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-emerald-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Query symbol (e.g., AAPL)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="pl-8 h-9 font-mono text-sm uppercase"
              />
            </div>
            <Button onClick={handleSearch} size="sm" className="h-9 font-mono text-xs uppercase tracking-wider">
              Query
            </Button>
            {activeSearch && (
              <Button onClick={clearSearch} variant="outline" size="sm" className="h-9">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton-shimmer h-4 w-full" />
                <div className="skeleton-shimmer h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((item: any, i: number) => {
              const sources = item.sources || [];
              const seq = String(i + 1).padStart(2, "0");

              return (
                <article
                  key={i}
                  className="group relative rounded-md border border-border/60 bg-card hover:bg-muted/30 transition-colors p-4 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Status stripe */}
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500/70 rounded-l-md" />

                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono text-[10px] tracking-widest text-muted-foreground/70">
                      #{seq}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(item.timestamp)}</span>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-foreground leading-snug">
                    {item.headline}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {item.text}
                  </p>

                  {sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/80">
                        // Sources [{sources.length}]
                      </p>
                      <div className="space-y-1.5">
                        {sources.map((source: any, sIdx: number) => (
                          <a
                            key={sIdx}
                            href={source.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/60 transition group/src border border-transparent hover:border-border/60"
                          >
                            <span className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                              {String(sIdx + 1).padStart(2, "0")}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground line-clamp-1">
                                {source.name}
                              </p>
                              {source.snippet && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {source.snippet}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/src:opacity-100 transition shrink-0 mt-1" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {posts.length === 0 && (
              <p className="text-sm font-mono text-muted-foreground text-center py-8 uppercase tracking-wider">
                {activeSearch ? `// No data for ${activeSearch}` : "// No wire updates"}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketNews;
