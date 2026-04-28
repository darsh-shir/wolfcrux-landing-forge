import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Radio } from "lucide-react";

interface NewsOverviewProps {
  data: any[];
  loading: boolean;
}

const NewsOverview = ({ data, loading }: NewsOverviewProps) => {
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
            {[...Array(3)].map((_, i) => (
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

  const posts = data || [];

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5" />
          // Market Highlights
        </CardTitle>
        <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm">
          <Radio className="w-3 h-3 animate-pulse" />
          LIVE
        </span>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {posts.slice(0, 5).map((item: any, i: number) => (
            <div
              key={i}
              className="relative pl-3 border-l-2 border-border hover:border-foreground transition-colors pb-3 animate-fade-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-foreground/70" />
              <h3 className="text-sm font-semibold text-foreground leading-snug">
                {item.headline}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3 font-mono">
                {item.text}
              </p>
            </div>
          ))}

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
