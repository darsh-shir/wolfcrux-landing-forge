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
  data?: EarningsDay[];
  loading?: boolean;
}

// Placeholder data for 8 days - replace with API data
const placeholderData: EarningsDay[] = [
  {
    date: "2025-12-11",
    earnings: [
      { symbol: "AVGO", name: "Broadcom Inc.", quarter: "Q4 '25", time: "5:00 PM" },
      { symbol: "COST", name: "Costco Wholesale Corporation", quarter: "Q1 '26", time: "5:00 PM" },
      { symbol: "CIEN", name: "Ciena Corporation", quarter: "Q4 '25", time: "8:30 AM" },
    ],
  },
  {
    date: "2025-12-12",
    earnings: [],
  },
  {
    date: "2025-12-13",
    earnings: [],
  },
  {
    date: "2025-12-14",
    earnings: [],
  },
  {
    date: "2025-12-15",
    earnings: [],
  },
  {
    date: "2025-12-16",
    earnings: [],
  },
  {
    date: "2025-12-17",
    earnings: [],
  },
  {
    date: "2025-12-18",
    earnings: [],
  },
];

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const Earnings = ({ data = placeholderData, loading = false }: EarningsProps) => {
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
      <CardContent className="space-y-6">
        {data.map((day, dayIndex) => (
          <div key={dayIndex} className="space-y-2">
            {/* Date Header */}
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              {formatDate(day.date)}
            </h3>

            {/* Earnings Rows */}
            {day.earnings.length > 0 ? (
              <div className="space-y-1">
                {day.earnings.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    {/* Left: Logo + Company Info */}
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
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {item.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.symbol}</p>
                      </div>
                    </div>

                    {/* Right: Quarter + Time */}
                    <div className="text-right">
                      <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground">
                        {item.quarter} <span className="text-foreground">{item.time}</span>
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
