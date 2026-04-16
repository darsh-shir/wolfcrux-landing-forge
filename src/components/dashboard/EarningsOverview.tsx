import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

interface EarningStock {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  change: { percent: number };
  earning: {
    reportOnTimeOfDay: string;
    value: number;
    lastYearValue: number;
    fiscalPeriod: number;
    fiscalYear: number;
    isConfirm: boolean;
  };
  analystRatings: {
    consensus: {
      id: string;
      priceTarget: { value: number };
    };
  };
}

const formatMC = (mc: number) => {
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
  return `${(mc / 1e6).toFixed(0)}M`;
};

const EarningsOverview = () => {
  const [stocks, setStocks] = useState<EarningStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const url = `https://www.tipranks.com/calendars/earnings/${today}/payload.json`;
        const resp = await fetch(`${PROXY}${encodeURIComponent(url)}`);
        const json = await resp.json();
        const tableData: EarningStock[] = json?.data?.tableData || [];
        // Show pre-market earnings sorted by market cap, top 8
        const preMarket = tableData
          .filter((s) => s.earning?.reportOnTimeOfDay === "PreMarket")
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
          .slice(0, 8);
        setStocks(preMarket);
      } catch (e) {
        console.error("Earnings overview fetch failed", e);
      } finally {
        setLoading(false);
      }
    };
    fetchToday();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Today's Pre-Market Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stocks.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Today's Pre-Market Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pre-market earnings today.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today's Pre-Market Earnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stocks.map((s) => (
            <div
              key={s.ticker}
              className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-muted flex items-center justify-center text-[10px] font-bold">
                  {s.ticker.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.ticker}</p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                    {s.name}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-muted-foreground">${s.price?.toFixed(2)}</span>
                  <span
                    className={`flex items-center gap-0.5 ${
                      s.change?.percent >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {s.change?.percent >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(s.change?.percent * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-muted-foreground">
                  EPS Est: ${s.earning?.value?.toFixed(2)} • {formatMC(s.marketCap)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningsOverview;
