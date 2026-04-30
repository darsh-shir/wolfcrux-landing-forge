import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  getDay,
  getDaysInMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";

interface TradeRow {
  trade_date: string;
  net_pnl: number;
  shares_traded: number;
  trader2_role?: string | null;
}

interface PayoutCalendarHeatmapProps {
  primaryTrades: TradeRow[];     // user is primary (user_id = trader)
  partnerTrades: TradeRow[];     // user is trader2 (partner)
  month: number;                 // 1-12
  year: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BROKERAGE_PER_1000 = 14;

interface DayEntry {
  primary: { gross: number; shares: number; brokerage: number; net: number; count: number };
  partner: { gross: number; shares: number; brokerage: number; net: number; count: number };
  totalNet: number;
}

const PayoutCalendarHeatmap = ({
  primaryTrades,
  partnerTrades,
  month,
  year,
}: PayoutCalendarHeatmapProps) => {
  const [viewDate, setViewDate] = useState(() => new Date(year, month - 1, 1));

  useEffect(() => {
    setViewDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const dayMap = useMemo(() => {
    const map: Record<string, DayEntry> = {};
    const ensure = (d: string): DayEntry => {
      if (!map[d]) {
        map[d] = {
          primary: { gross: 0, shares: 0, brokerage: 0, net: 0, count: 0 },
          partner: { gross: 0, shares: 0, brokerage: 0, net: 0, count: 0 },
          totalNet: 0,
        };
      }
      return map[d];
    };

    primaryTrades.forEach((t) => {
      const e = ensure(t.trade_date);
      const shares = Number(t.shares_traded || 0);
      const gross = Number(t.net_pnl || 0);
      const brokerage = (shares / 1000) * BROKERAGE_PER_1000;
      e.primary.gross += gross;
      e.primary.shares += shares;
      e.primary.brokerage += brokerage;
      e.primary.net += gross - brokerage;
      e.primary.count += 1;
    });

    partnerTrades.forEach((t) => {
      if ((t.trader2_role || "").toLowerCase() !== "partner") return;
      const e = ensure(t.trade_date);
      const shares = Number(t.shares_traded || 0);
      const gross = Number(t.net_pnl || 0);
      const brokerage = (shares / 1000) * BROKERAGE_PER_1000;
      e.partner.gross += gross;
      e.partner.shares += shares;
      e.partner.brokerage += brokerage;
      e.partner.net += gross - brokerage;
      e.partner.count += 1;
    });

    Object.values(map).forEach((e) => {
      e.totalNet = e.primary.net + e.partner.net;
    });

    return map;
  }, [primaryTrades, partnerTrades]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const daysInMonth = getDaysInMonth(viewDate);
    const startDayOfWeek = getDay(monthStart);
    const days: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push({ day: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = format(new Date(viewDate.getFullYear(), viewDate.getMonth(), d), "yyyy-MM-dd");
      days.push({ day: d, dateStr });
    }
    return days;
  }, [viewDate]);

  const maxAbs = useMemo(() => {
    const values = calendarDays
      .filter((c) => c.dateStr && dayMap[c.dateStr])
      .map((c) => Math.abs(dayMap[c.dateStr!].totalNet));
    return Math.max(...values, 1);
  }, [calendarDays, dayMap]);

  const getColor = (net: number): string | undefined => {
    if (net === 0) return undefined;
    const intensity = Math.min(Math.abs(net) / maxAbs, 1);
    const alpha = 0.15 + intensity * 0.75;
    return net > 0
      ? `rgba(34, 197, 94, ${alpha})`
      : `rgba(239, 68, 68, ${alpha})`;
  };

  const monthTotal = useMemo(() => {
    let total = 0;
    calendarDays.forEach((c) => {
      if (c.dateStr && dayMap[c.dateStr]) total += dayMap[c.dateStr].totalNet;
    });
    return total;
  }, [calendarDays, dayMap]);

  const fmt = (v: number) => formatCurrencyINR(v);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            P&L Calendar — Both Accounts
          </CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold ${
                monthTotal >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {fmt(monthTotal)}
            </span>
            <button
              onClick={() => setViewDate((p) => subMonths(p, 1))}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium px-2">
              {format(viewDate, "MMM yyyy")}
            </span>
            <button
              onClick={() => setViewDate((p) => addMonths(p, 1))}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs text-muted-foreground font-medium py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ day, dateStr }, idx) => {
            if (day === null)
              return <div key={`empty-${idx}`} className="aspect-square" />;
            const entry = dateStr ? dayMap[dateStr] : undefined;
            const has = !!entry && (entry.primary.count + entry.partner.count > 0);
            const bg = has ? getColor(entry!.totalNet) : undefined;

            return (
              <Tooltip key={dateStr}>
                <TooltipTrigger asChild>
                  <div
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium cursor-default transition-colors ${
                      has
                        ? "text-foreground border border-border/30"
                        : "text-muted-foreground/50 bg-muted/30"
                    }`}
                    style={has ? { backgroundColor: bg } : undefined}
                  >
                    {day}
                  </div>
                </TooltipTrigger>
                {has && entry && (
                  <TooltipContent
                    side="top"
                    className="text-xs space-y-2 p-3 max-w-xs"
                  >
                    <p className="font-semibold text-sm">
                      {format(parseISO(dateStr!), "EEE, MMM d, yyyy")}
                    </p>

                    {entry.primary.count > 0 && (
                      <div className="space-y-0.5 border-t pt-2">
                        <p className="font-medium text-primary">
                          Own Account ({entry.primary.count} entry
                          {entry.primary.count > 1 ? "ies" : ""})
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span className="text-muted-foreground">Gross:</span>
                          <span
                            className={`text-right font-medium ${
                              entry.primary.gross >= 0
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {fmt(entry.primary.gross)}
                          </span>
                          <span className="text-muted-foreground">Shares:</span>
                          <span className="text-right">
                            {formatIndian(entry.primary.shares)}
                          </span>
                          <span className="text-muted-foreground">
                            Brokerage:
                          </span>
                          <span className="text-right text-orange-500">
                            -{fmt(entry.primary.brokerage)}
                          </span>
                          <span className="text-muted-foreground font-semibold">
                            Net:
                          </span>
                          <span
                            className={`text-right font-semibold ${
                              entry.primary.net >= 0
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {fmt(entry.primary.net)}
                          </span>
                        </div>
                      </div>
                    )}

                    {entry.partner.count > 0 && (
                      <div className="space-y-0.5 border-t pt-2">
                        <p className="font-medium text-blue-500">
                          Partner Account ({entry.partner.count} entry
                          {entry.partner.count > 1 ? "ies" : ""})
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span className="text-muted-foreground">Gross:</span>
                          <span
                            className={`text-right font-medium ${
                              entry.partner.gross >= 0
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {fmt(entry.partner.gross)}
                          </span>
                          <span className="text-muted-foreground">Shares:</span>
                          <span className="text-right">
                            {formatIndian(entry.partner.shares)}
                          </span>
                          <span className="text-muted-foreground">
                            Brokerage:
                          </span>
                          <span className="text-right text-orange-500">
                            -{fmt(entry.partner.brokerage)}
                          </span>
                          <span className="text-muted-foreground font-semibold">
                            Net:
                          </span>
                          <span
                            className={`text-right font-semibold ${
                              entry.partner.net >= 0
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {fmt(entry.partner.net)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="font-semibold">Total Net (Day):</span>
                      <span
                        className={`font-bold ${
                          entry.totalNet >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {fmt(entry.totalNet)}
                      </span>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PayoutCalendarHeatmap;
