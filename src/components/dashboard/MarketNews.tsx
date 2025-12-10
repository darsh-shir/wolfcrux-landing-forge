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
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Market News
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {posts.slice(0, 6).map((item: any, i: number) => {
            const source = item.sources?.[0];

            return (
              <a
                key={i}
                href={source?.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg hover:bg-muted/50 transition group"
              >
                <div className="flex justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug">
                    {item.headline}
                  </h3>
                  <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                </div>

                {/* ✅ THIS IS THE FIX: SHOW TEXT NOT SOURCE NAME */}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.text}
                </p>

                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {source?.name || "Market"}
                  </span>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(item.timestamp)}</span>
                </div>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketNews;
