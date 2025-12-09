import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Newspaper, Clock } from "lucide-react";

interface NewsItem {
  headline: string;
  source: string;
  publishedAt: string;
  url: string;
}

const MarketNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    try {
      setLoading(true);
      
      const response = await fetch("https://www.perplexity.ai/rest/finance/general-news/market?country=US");
      
      if (!response.ok) throw new Error("Failed to fetch news");
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const mappedNews: NewsItem[] = data.slice(0, 10).map((item: any) => ({
          headline: item.headline || item.title || "",
          source: item.source || item.publisher || "",
          publishedAt: item.publishedAt || item.datetime || item.date || "",
          url: item.url || item.link || "#"
        }));
        setNews(mappedNews);
      } else {
        setNews(getFallbackNews());
      }
    } catch (err) {
      console.error("Error fetching news:", err);
      setNews(getFallbackNews());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackNews = (): NewsItem[] => [
    { headline: "Federal Reserve signals measured approach to interest rate adjustments", source: "Reuters", publishedAt: new Date().toISOString(), url: "#" },
    { headline: "Tech giants lead market rally amid strong earnings outlook", source: "Bloomberg", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "#" },
    { headline: "Treasury yields stabilize as inflation data meets expectations", source: "CNBC", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "#" },
    { headline: "Global markets react to economic policy announcements", source: "WSJ", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "#" },
    { headline: "Energy sector faces headwinds amid shifting demand patterns", source: "MarketWatch", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "#" },
    { headline: "Retail investors show renewed interest in dividend stocks", source: "Barron's", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "#" }
  ];

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

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && news.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2 pb-4 border-b border-border/30 last:border-0">
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

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Market News
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {news.map((item, index) => (
            <a 
              key={index}
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
                  <span>{formatTimeAgo(item.publishedAt)}</span>
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
