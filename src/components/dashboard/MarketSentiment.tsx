import { TrendingUp, TrendingDown, Clock } from "lucide-react";

interface MarketSentimentProps {
  sentiment: string;
  marketStatus: string;
  created: string;
  loading?: boolean;
}

const MarketSentiment = ({ sentiment, marketStatus, created, loading }: MarketSentimentProps) => {
  // Format the created timestamp from API
  const formatTimestamp = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + ", " + date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return "";
    }
  };

  const isBullish = sentiment?.toLowerCase() === "bullish";
  const isOpen = marketStatus?.toLowerCase() === "open";
  const statusText = isOpen ? "Market Open" : "Market Closed";

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
      {created && (
        <span className="text-muted-foreground">{formatTimestamp(created)}</span>
      )}
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
                Bullish
              </span>
            ) : (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Bearish
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
};

export default MarketSentiment;
