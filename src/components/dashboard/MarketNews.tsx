import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Newspaper, Clock } from "lucide-react";

interface MarketNewsProps {
  data: any;
  loading: boolean;
}

const MarketNews = ({ data, loading }: MarketNewsProps) => {
  const posts = data?.posts || [];

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

  if (loading && posts.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Market News
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {posts.map((item: any, i: number) => {
            const sources = item.sources || [];

            return (
              <div key={i} className="border-b border-border/30 pb-6 last:border-0 last:pb-0">
                {/* Headline */}
                <h3 className="text-base font-semibold text-foreground leading-snug">
                  {item.headline}
                </h3>

                {/* Text */}
                <p className="text-sm text-muted-foreground mt-2">
                  {item.text}
                </p>

                {/* Timestamp */}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(item.timestamp)}</span>
                </div>

                {/* Sources */}
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
              No market news available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketNews;