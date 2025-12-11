import { TrendingUp, TrendingDown, Clock } from "lucide-react";

interface MarketSentimentProps {
  sentiment: string;
  marketStatus: string;
  loading?: boolean;
}

const MarketSentiment = ({ sentiment, marketStatus, loading }: MarketSentimentProps) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isBullish = sentiment?.toLowerCase() === "bullish";
  const statusText = marketStatus === "closed" ? "Market Closed" : "Market Open";

  if (loading) {
    return (
      <div className="flex items-center gap-4 text-sm animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">{dateStr}, EST</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {statusText}
      </span>
      {sentiment && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">||||||||</span>
            {isBullish ? (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Bullish Sentiment
              </span>
            ) : (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Bearish Sentiment
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
};

export default MarketSentiment;
