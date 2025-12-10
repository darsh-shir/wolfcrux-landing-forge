import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Newspaper, Clock } from "lucide-react";

interface NewsItem {
  id: string;
  headline: string;
  text: string;
  source: string;
  datetime: string;
  url: string;
  category?: string;
}

interface MarketNewsProps {
  data: NewsItem[];
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

  if (loading && data.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-4 h-4" /> Market News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="w-4 h-4" /> Market News
        </CardTitle>
      </CardHeader>

      <CardContent className="max-h-[430px] overflow-y-auto divide-y divide-border/40">
        {data.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-4 px-2 hover:bg-muted/40 transition rounded"
          >
            {/* ✅ HEADLINE (BOLD) */}
            <h3 className="text-sm font-bold text-foreground">
              {item.headline}
            </h3>

            {/* ✅ FULL TEXT (NO CLAMP, SHOW COMPLETE) */}
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {item.text}
            </p>

            {/* ✅ SOURCE + TIME */}
            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
              <span className="font-medium">{item.source}</span>
              <span>•</span>
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(item.datetime)}</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
            </div>
          </a>
        ))}
      </CardContent>
    </Card>
  );
};

export default MarketNews;
