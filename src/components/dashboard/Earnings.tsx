import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

interface EarningsItem {
  symbol: string;
  name: string;
  image?: string;
  quarter: string;
  time: string;
}

interface EarningsDay {
  date: string;
  earnings: EarningsItem[];
}

interface EarningsProps {
  data: EarningsDay[];
  loading: boolean;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const Earnings = ({ data = [], loading = false }: EarningsProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
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
          <Calendar className="w-5 h-5" />
          Earnings Calendar
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-8">
        {data.map((day, dayIndex) => (
          <div key={dayIndex} className="space-y-4">
            {/* Date Header */}
            <h3 className="text-base font-bold text-foreground border-b pb-2">
              {formatDate(day.date)}
            </h3>

            {day.earnings.length > 0 ? (
              <div className="space-y-4">
                {day.earnings.map((item, idx) => (
                  <div key={idx} className="pb-4 border-b last:border-none">
                    <div className="flex items-center justify-between">

                      {/* LEFT SIDE — LOGO + NAME + SYMBOL */}
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.symbol}
                            className="w-8 h-8 rounded object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                            {item.symbol.slice(0, 2)}
                          </div>
                        )}

                        <div>
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.symbol}</p>
                        </div>
                      </div>

                      {/* RIGHT SIDE — QUARTER + TIME */}
                      <div className="text-right text-sm space-y-1">
                        <p className="font-semibold text-foreground">{item.quarter}</p>
                        <p className="text-muted-foreground">{item.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">No earnings scheduled</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default Earnings;
