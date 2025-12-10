import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Newspaper, Clock } from "lucide-react";

interface RawSource {
  id: number;
  url: string;
  name: string;
  snippet: string;
  timestamp: string;
}

interface RawPost {
  headline: string;
  text: string;
  timestamp: string;
  sources: RawSource[];
}

interface MarketNewsProps {
  data: any; // because API structure is nested
  loading: boolean;
}

const MarketNews = ({ data, loading }: MarketNewsProps) => {
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

  /* ✅ MAP YOUR REAL JSON HERE */
  const news: {
    id: string;
    headline: string;
    source: string;
    datetime: string;
    url: string;
  }[] =
    data?.posts?.length > 0
      ? data.posts.map((post: RawPost, index: number) => ({
          id: String(index),
          headline: post.headline,
          source: post.sources?.[0]?.name || "Source",
          datetime: post.timestamp,
          url: post.sources?.[0]?.url || "#",
        }))
      : [
          {
            id: "1",
            headline: "Federal Reserve signals cautious approach to rate cuts",
            source: "Reuters",
            datetime: new Date().toISOString(),
            url: "#",
          },
        ];

  /* ================= LOADING ================= */
  if (loading && (!data || !data.posts)) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse space-y-2 pb-4 border-b border-border/30 last:border-0"
              >
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ================= MAIN UI ================= */
  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Market News
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground leading-snug group-hover:text-accent transition-colors">
                  {item.headline}
                </h3>
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span className="font-medium">{item.source}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(item.datetime)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketNews;
