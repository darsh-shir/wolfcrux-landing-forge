import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";

interface DailySummary {
  date: string;
  combinedPnl: number;
  totalShares: number;
  brokerage: number;
  netAfterBrokerage: number;
}

interface MonthlyPnlBreakdownProps {
  dailySummary: DailySummary[];
  softwareCosts?: Record<string, number>;
}

interface MonthlyData {
  month: string;
  label: string;
  grossPnl: number;
  brokerage: number;
  softwareCost: number;
  netPnl: number;
  tradingDays: number;
  winningDays: number;
  losingDays: number;
  winRate: number;
  totalShares: number;
  bestDay: number;
  worstDay: number;
}

const MonthlyPnlBreakdown = ({ dailySummary, softwareCosts = {} }: MonthlyPnlBreakdownProps) => {
  const monthlyData = useMemo((): MonthlyData[] => {
    const grouped: Record<string, DailySummary[]> = {};

    dailySummary.forEach((d) => {
      const monthKey = d.date.substring(0, 7); // yyyy-MM
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(d);
    });

    return Object.entries(grouped)
      .map(([month, days]) => {
        const grossPnl = days.reduce((s, d) => s + d.combinedPnl, 0);
        const brokerage = days.reduce((s, d) => s + d.brokerage, 0);
        const softwareCost = softwareCosts[month] !== undefined ? softwareCosts[month] : 1000;
        const netPnl = days.reduce((s, d) => s + d.netAfterBrokerage, 0) - softwareCost;
        const totalShares = days.reduce((s, d) => s + d.totalShares, 0);
        const winningDays = days.filter((d) => d.netAfterBrokerage > 0).length;
        const losingDays = days.filter((d) => d.netAfterBrokerage < 0).length;
        const bestDay = Math.max(...days.map((d) => d.netAfterBrokerage));
        const worstDay = Math.min(...days.map((d) => d.netAfterBrokerage));

        return {
          month,
          label: format(parseISO(`${month}-01`), "MMM yyyy"),
          grossPnl,
          brokerage,
          softwareCost,
          netPnl,
          tradingDays: days.length,
          winningDays,
          losingDays,
          winRate: days.length > 0 ? (winningDays / days.length) * 100 : 0,
          totalShares,
          bestDay,
          worstDay,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [dailySummary, softwareCosts]);

  if (monthlyData.length === 0) return null;

  const fmt = (v: number) => formatCurrencyINR(v);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Monthly P&L Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-6 px-6 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Month</TableHead>
                <TableHead className="text-right whitespace-nowrap">Gross P&L</TableHead>
                <TableHead className="text-right whitespace-nowrap">Brokerage</TableHead>
                <TableHead className="text-right whitespace-nowrap">Software</TableHead>
                <TableHead className="text-right whitespace-nowrap">Net P&L</TableHead>
                <TableHead className="text-center whitespace-nowrap">Days</TableHead>
                <TableHead className="text-center whitespace-nowrap">Win Rate</TableHead>
                <TableHead className="text-right whitespace-nowrap">Best Day</TableHead>
                <TableHead className="text-right whitespace-nowrap">Worst Day</TableHead>
                <TableHead className="text-right whitespace-nowrap">Shares</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium whitespace-nowrap">{m.label}</TableCell>
                  <TableCell className={`text-right font-mono whitespace-nowrap ${m.grossPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(m.grossPnl)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600 whitespace-nowrap">
                    -{fmt(m.brokerage)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-purple-600 whitespace-nowrap">
                    -{fmt(m.softwareCost)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Badge
                      variant={m.netPnl >= 0 ? "default" : "destructive"}
                      className={`font-mono ${m.netPnl >= 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      {m.netPnl >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {fmt(m.netPnl)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    <span className="text-green-600">{m.winningDays}W</span>
                    {" / "}
                    <span className="text-red-600">{m.losingDays}L</span>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    <span className={m.winRate >= 50 ? "text-green-600" : "text-red-600"}>
                      {m.winRate.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600 whitespace-nowrap">
                    {fmt(m.bestDay)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600 whitespace-nowrap">
                    {fmt(m.worstDay)}
                  </TableCell>
                  <TableCell className="text-right font-mono whitespace-nowrap">
                    {formatIndian(m.totalShares)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 sm:hidden">← Scroll horizontally to see more →</p>
      </CardContent>
    </Card>
  );
};

export default MonthlyPnlBreakdown;
