import { useEffect, useState, useMemo } from "react";
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
  marketCap?: number;
}

interface EarningsDay {
  date: string;
  earnings: EarningsItem[];
}

const formatDisplayDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatHeaderDate = (dateStr: string) => {
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

  if (total < 570) return "PRE-MARKET";
  if (total >= 570 && total <= 960) return "MARKET HOURS";
  return "POST-MARKET";
};

const Earnings = () => {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<EarningsDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sortMode, setSortMode] = useState<"marketcap" | "time">("marketcap");

  const fetchEarnings = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const dates: string[] = [];

      for (let i = -5; i <= 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().split("T")[0];
        dates.push(iso);
      }

      setSelectedDate(dates[5]); // today auto-select

      const results: EarningsDay[] = [];

      for (const d of dates) {
        const encoded = encodeURIComponent(
          `https://www.perplexity.ai/rest/finance/earnings?date=${d}&timezone=America/New_York&country=US`
        );

        const resp = await fetch(`${PROXY}${encoded}`);
        const api = await resp.json();

        const mapped: EarningsItem[] = (api || []).map((e: any) => {
          const dt = new Date(e.date);

          const estTime = dt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/New_York",
          });

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
            marketCap: e.marketCap || e.mktCap || 0,
          };
        });

        results.push({ date: d, earnings: mapped });
      }

      setDays(results);
    } catch (e) {
      console.error("Earnings fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate),
    [days, selectedDate]
  );

  const sortedEarnings = useMemo(() => {
    if (!selectedDay) return [];

    let arr = [...selectedDay.earnings];

    if (sortMode === "marketcap") {
      return arr.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    }

    const sessionRank: any = {
      "PRE-MARKET": 1,
      "MARKET HOURS": 2,
      "POST-MARKET": 3,
    };

    return arr.sort(
      (a, b) =>
        sessionRank[a.session] - sessionRank[b.session] ||
        a.time.localeCompare(b.time)
    );
  }, [selectedDay, sortMode]);

  const grouped = useMemo(() => {
    const base = {
      "PRE-MARKET": [] as EarningsItem[],
      "MARKET HOURS": [] as EarningsItem[],
      "POST-MARKET": [] as EarningsItem[],
    };

    sortedEarnings.forEach((e) => {
      base[e.session].push(e);
    });

    return base;
  }, [sortedEarnings]);

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
        {/* DATE SELECTOR */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {days.map((d) => (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              className={`px-3 py-2 rounded-lg border text-sm whitespace-nowrap ${
                selectedDate === d.date
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {formatDisplayDate(d.date)}
            </button>
          ))}
        </div>

        {/* SORTER */}
        <div className="flex justify-end">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="marketcap">Market Cap (Big → Small)</option>
            <option value="time">Time (PRE → MARKET → POST)</option>
          </select>
        </div>

        {/* SELECTED DATE HEADER */}
        {selectedDay && (
          <h3 className="text-md font-semibold text-muted-foreground border-b pb-2">
            {formatHeaderDate(selectedDay.date)}
          </h3>
        )}

        {/* SESSION GROUPS (H4 STYLE) */}
        {["PRE-MARKET", "MARKET HOURS", "POST-MARKET"].map((session) => (
          <div key={session}>
            {grouped[session].length > 0 && (
              <>
                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t" />
                  <span className="mx-4 text-xs font-semibold text-muted-foreground">
                    {session}
                  </span>
                  <div className="flex-grow border-t" />
                </div>

                <div className="space-y-2">
                  {grouped[session].map((e, i) => (
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
                              ((ev.target as HTMLImageElement).style.display = "none")
                            }
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                            {e.symbol.slice(0, 2)}
                          </div>
                        )}

                        <div>
                          <p className="font-medium">{e.symbol}</p>
                          <p className="text-xs text-muted-foreground">{e.name}</p>
                        </div>
                      </div>

                      <div className="text-right text-xs text-muted-foreground">
                        {e.quarter} • {e.time}
                        <br />
                        {e.marketCap
                          ? `${(e.marketCap / 1_000_000_000).toFixed(1)}B`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Earnings;
