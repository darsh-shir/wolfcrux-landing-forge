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
        `https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=https://www.perplexity.ai/rest/finance/peers/${symbol}`
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
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            {activeSearch ? `${activeSearch} News` : "Market News"}
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search stock (e.g., AAPL)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-8 h-9"
              />
            </div>
            <Button onClick={handleSearch} size="sm" className="h-9">
              Search
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
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((item: any, i: number) => {
              const sources = item.sources || [];

              return (
                <div key={i} className="border-b border-border/30 pb-6 last:border-0 last:pb-0">
                  <h3 className="text-base font-semibold text-foreground leading-snug">
                    {item.headline}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-2">
                    {item.text}
                  </p>

                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(item.timestamp)}</span>
                  </div>

                  {sources.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Sources
                      </p>
                      <div className="space-y-2">
                        {sources.map((source: any, sIdx: number) => (
                          <a
                            key={sIdx}
                            href={source.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground line-clamp-1">
                                {source.name}
                              </p>
                              {source.snippet && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {source.snippet}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {posts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {activeSearch ? `No news found for ${activeSearch}` : "No market news available"}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketNews;