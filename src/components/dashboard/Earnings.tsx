import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const PROXY = "https://wolfcrux-market-proxy.pc-shiroiya25.workers.dev/?url=";

interface EarningsItem {
  symbol: string;
  name: string;
  image?: string;
  quarter: string;
  time: string;
  session: string;
}

interface EarningsDay {
  date: string;
  earnings: EarningsItem[];
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const getSession = (date: Date) => {
  const hrs = date.getHours();
  const mins = date.getMinutes();

  const total = hrs * 60 + mins;

  if (total < 570) return "PRE-MARKET"; // before 9:30
  if (total >= 570 && total <= 960) return "MARKET HOURS"; // 9:30–4:00
  return "POST-MARKET";
};

const Earnings = () => {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<EarningsDay[]>([]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);

      const today = new Date();

      // Generate 11 days: [-5 to +5]
      const dates: string[] = [];
      for (let i = -5; i <= 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
      }

      const results: EarningsDay[] = [];

      for (const d of dates) {
        const encoded = encodeURIComponent(
          `https://www.perplexity.ai/rest/finance/earnings?date=${d}&timezone=America/New_York&country=US`
        );

        const resp = await fetch(`${PROXY}${encoded}`);
        const api = await resp.json();

        const mapped: EarningsItem[] = (api || []).map((e: any) => {
          const dt = new Date(e.date); // Already in UTC from API
          const estTime = dt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/New_York",
          });

          // Session classification
          const localEST = new Date(
            dt.toLocaleString("en-US", { timeZone: "America/New_York" })
          );

          return {
            symbol: e.symbol,
            name: e.companyName,
            image: e.image,
            quarter: `${e.fiscalPeriod} '${String(e.fiscalYear).slice(2)}`,
            time: estTime,
            session: getSession(localEST),
          };
        });

        results.push({
          date: d,
          earnings: mapped,
        });
      }

      setDays(results);
    } catch (e) {
      console.error("Earnings fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Earnings Calendar
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {days.map((day, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              {formatDate(day.date)}
            </h3>

            {day.earnings.length ? (
              <div className="space-y-1">
                {day.earnings.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {e.image ? (
                        <img
                          src={e.image}
                          className="w-8 h-8 rounded object-contain"
                          alt={e.symbol}
                          onError={(ev) =>
                            ((ev.target as HTMLImageElement).style.display =
                              "none")
                          }
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                          {e.symbol.slice(0, 2)}
                        </div>
                      )}

                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">{e.symbol}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground">
                        {e.quarter} • {e.time} •{" "}
                        <span className="text-foreground">{e.session}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2 px-3">
                No earnings scheduled
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Earnings;
