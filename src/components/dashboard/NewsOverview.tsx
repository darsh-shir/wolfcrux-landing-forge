import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

interface NewsOverviewProps {
  data: any[];
  loading: boolean;
}

const NewsOverview = ({ data, loading }: NewsOverviewProps) => {
  if (loading && (!data || data.length === 0)) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Market Highlights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
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

  const posts = data || [];

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Market Highlights
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {posts.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="border-b border-border/30 pb-3 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground leading-snug">
                {item.headline}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
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
