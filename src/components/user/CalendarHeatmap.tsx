import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, getDay, getDaysInMonth, addMonths, subMonths } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TradingDataRaw {
  trade_date: string;
  net_pnl: number;
  shares_traded: number;
}

interface CalendarHeatmapProps {
  allTradingData: TradingDataRaw[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CalendarHeatmap = ({ allTradingData }: CalendarHeatmapProps) => {
  const [viewDate, setViewDate] = useState(() => new Date());

  // Build pnlMap from ALL trading data (not filtered by parent)
  const pnlMap = useMemo(() => {
    const grouped: Record<string, { pnl: number; shares: number }> = {};
    allTradingData.forEach((t) => {
      if (!grouped[t.trade_date]) {
        grouped[t.trade_date] = { pnl: 0, shares: 0 };
      }
      grouped[t.trade_date].pnl += Number(t.net_pnl);
      grouped[t.trade_date].shares += t.shares_traded;
    });
    const map: Record<string, number> = {};
    Object.entries(grouped).forEach(([date, data]) => {
      const brokerage = (data.shares / 1000) * 14;
      map[date] = data.pnl - brokerage;
    });
    return map;
  }, [allTradingData]);

  // Get all available months from data
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = subMonths(now, i);
      months.push(format(d, "yyyy-MM"));
    }
    return months;
  }, []);

  // Get max absolute PnL for color scaling
  const maxAbsPnl = useMemo(() => {
    const values = Object.values(pnlMap);
    if (values.length === 0) return 1;
    return Math.max(...values.map(Math.abs), 1);
  }, [pnlMap]);

  const getColor = (pnl: number): string => {
    const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);
    if (pnl > 0) {
      // Green shades
      const alpha = 0.15 + intensity * 0.75;
      return `rgba(34, 197, 94, ${alpha})`;
    } else if (pnl < 0) {
      // Red shades
      const alpha = 0.15 + intensity * 0.75;
      return `rgba(239, 68, 68, ${alpha})`;
    }
    return "transparent";
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const daysInMonth = getDaysInMonth(viewDate);
    const startDayOfWeek = getDay(monthStart);

    const days: Array<{ day: number | null; dateStr: string | null }> = [];

    // Empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, dateStr: null });
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = format(new Date(viewDate.getFullYear(), viewDate.getMonth(), d), "yyyy-MM-dd");
      days.push({ day: d, dateStr });
    }

    return days;
  }, [viewDate]);

  const monthPnl = useMemo(() => {
    let total = 0;
    calendarDays.forEach(({ dateStr }) => {
      if (dateStr && pnlMap[dateStr] !== undefined) {
        total += pnlMap[dateStr];
      }
    });
    return total;
  }, [calendarDays, pnlMap]);

  const fmt = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            P&L Calendar Heatmap
          </CardTitle>
           <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${monthPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmt(monthPnl)}
              </span>
              <button
                onClick={() => setViewDate(prev => subMonths(prev, 1))}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            <Select
              value={format(viewDate, "yyyy-MM")}
              onValueChange={(v) => setViewDate(parseISO(`${v}-01`))}
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {format(parseISO(`${m}-01`), "MMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              <button
                onClick={() => setViewDate(prev => addMonths(prev, 1))}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ day, dateStr }, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const pnl = dateStr ? pnlMap[dateStr] : undefined;
            const hasTrade = pnl !== undefined;
            const bgColor = hasTrade ? getColor(pnl) : undefined;

            return (
              <Tooltip key={dateStr}>
                <TooltipTrigger asChild>
                  <div
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium cursor-default transition-colors
                      ${hasTrade ? "text-foreground border border-border/30" : "text-muted-foreground/50"}
                      ${!hasTrade ? "bg-muted/30" : ""}
                    `}
                    style={hasTrade ? { backgroundColor: bgColor } : undefined}
                  >
                    {day}
                  </div>
                </TooltipTrigger>
                {hasTrade && (
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">
                      {format(parseISO(dateStr!), "MMM d, yyyy")}
                    </p>
                    <p className={pnl! >= 0 ? "text-green-500" : "text-red-500"}>
                      {fmt(pnl!)}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Loss</span>
          <div className="flex gap-0.5">
            {[0.9, 0.6, 0.3].map((a) => (
              <div
                key={`red-${a}`}
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: `rgba(239, 68, 68, ${a})` }}
              />
            ))}
            <div className="w-4 h-4 rounded-sm bg-muted/30" />
            {[0.3, 0.6, 0.9].map((a) => (
              <div
                key={`green-${a}`}
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: `rgba(34, 197, 94, ${a})` }}
              />
            ))}
          </div>
          <span>Profit</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarHeatmap;
