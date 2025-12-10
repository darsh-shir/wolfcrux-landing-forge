import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors } from "lucide-react";

interface SplitData {
  companyName: string;
  ticker: string;
  splitRatio: string;
  exDate: string;
}

const StockSplits = () => {
  const [splits, setSplits] = useState<SplitData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSplits = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "https://tr-cdn.tipranks.com/calendars/prod/calendars/stock-splits/upcoming/payload.json"
      );

      if (!response.ok) throw new Error("Failed to fetch splits");

      const json = await response.json();

      // ✅ EXACT PATH FROM YOUR JSON
      const rawList = json?.StockSplitCalendar?.data?.list || [];

      const mappedSplits: SplitData[] = rawList.slice(0, 10).map((item: any) => ({
        companyName: item.name,
        ticker: item.ticker,
        splitRatio: item.split?.ratio?.text || "",
        exDate: item.split?.date || "",
      }));

      mappedSplits.sort(
        (a, b) =>
          new Date(a.exDate).getTime() - new Date(b.exDate).getTime()
      );

      setSplits(mappedSplits);
    } catch (err) {
      console.error("Error fetching splits:", err);
      setSplits(getFallbackSplits());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackSplits = (): SplitData[] => [
    { companyName: "Broadcom Inc", ticker: "AVGO", splitRatio: "10:1", exDate: "2025-12-20" },
    { companyName: "Chipotle", ticker: "CMG", splitRatio: "50:1", exDate: "2025-12-22" },
    { companyName: "Walmart", ticker: "WMT", splitRatio: "3:1", exDate: "2025-12-28" },
  ];

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntil = (dateString: string): number => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  };

  useEffect(() => {
    fetchSplits();
    const interval = setInterval(fetchSplits, 300000);
    return () => clearInterval(interval);
  }, []);

  /* ================= LOADING STATE ================= */

  if (loading && splits.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Upcoming Stock Splits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  /* ================= MAIN UI ================= */

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Scissors className="w-4 h-4" />
          Upcoming Stock Splits
        </CardTitle>
      </CardHeader>

      <CardContent>
        {splits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No upcoming stock splits
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left pb-2">Company</th>
                  <th className="text-left pb-2">Ticker</th>
                  <th className="text-center pb-2">Ratio</th>
                  <th className="text-right pb-2">Ex-Date</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((split, index) => {
                  const daysUntil = getDaysUntil(split.exDate);

                  return (
                    <tr
                      key={index}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-2 font-medium">
                        {split.companyName}
                      </td>

                      <td className="py-2">
                        <Badge variant="secondary">
                          {split.ticker}
                        </Badge>
                      </td>

                      <td className="py-2 text-center font-semibold">
                        {split.splitRatio}
                      </td>

                      <td className="py-2 text-right">
                        <div className="flex flex-col items-end">
                          <span>{formatDate(split.exDate)}</span>
                          <span className="text-xs text-muted-foreground">
                            {daysUntil === 0
                              ? "Today"
                              : daysUntil === 1
                              ? "Tomorrow"
                              : `${daysUntil} days`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockSplits;
