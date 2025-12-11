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

  // Determine sentiment color based on positive/negative keywords
  const isPositive = ["bullish", "upbeat", "optimistic", "positive"].includes(sentiment?.toLowerCase() || "");

  if (loading) {
    return (
      <div className="flex items-center gap-4 text-sm animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  // Format market status for display (replace underscores with spaces, capitalize)
  const formatStatus = (status: string) => {
    if (!status) return "";
    return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  // Capitalize first letter of sentiment
  const formatSentiment = (s: string) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {created && (
        <span className="text-muted-foreground">{formatTimestamp(created)}</span>
      )}
      {marketStatus && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatStatus(marketStatus)}
          </span>
        </>
      )}
      {sentiment && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">||||||||</span>
            <span className={`font-medium flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {formatSentiment(sentiment)}
            </span>
          </span>
        </>
      )}
    </div>
  );
};

export default MarketSentiment;
