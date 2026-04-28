import { formatCurrencyCompact, formatIndian } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { X, TrendingUp, TrendingDown, Users } from "lucide-react";
import { EmployeeStats, DailyPnL } from "./types";
import { format, parseISO } from "date-fns";

interface EmployeeComparisonProps {
  employees: EmployeeStats[];
  getEmployeeDailyPnL: (userId: string) => DailyPnL[];
}

const COLORS = [
  "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

const POS = "hsl(142 71% 45%)"; // green
const NEG = "hsl(0 72% 55%)";   // red

const EmployeeComparison = ({ employees, getEmployeeDailyPnL }: EmployeeComparisonProps) => {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const addEmployee = (userId: string) => {
    if (userId && !selectedEmployees.includes(userId) && selectedEmployees.length < 8) {
      setSelectedEmployees([...selectedEmployees, userId]);
    }
  };

  const removeEmployee = (userId: string) => {
    setSelectedEmployees(selectedEmployees.filter((id) => id !== userId));
  };

  const getEmployeeName = (userId: string) =>
    employees.find((e) => e.userId === userId)?.name || "Unknown";

  const comparisonData = useMemo(() => {
    if (selectedEmployees.length === 0) return [];
    const allDates = new Set<string>();
    const employeeData: Record<string, Record<string, DailyPnL>> = {};

    selectedEmployees.forEach((userId) => {
      const data = getEmployeeDailyPnL(userId);
      employeeData[userId] = {};
      data.forEach((d) => {
        allDates.add(d.date);
        employeeData[userId][d.date] = d;
      });
    });

    const sortedDates = Array.from(allDates).sort();
    return sortedDates.map((date) => {
      const point: Record<string, any> = { date };
      selectedEmployees.forEach((userId) => {
        const data = employeeData[userId][date];
        point[`${userId}_pnl`] = data?.pnl ?? 0;
        point[`${userId}_equity`] = data?.equity ?? null;
        point[`${userId}_cumulative`] = data?.cumulativePnl ?? null;
      });
      return point;
    });
  }, [selectedEmployees, getEmployeeDailyPnL]);

  // Per-employee summary (totals across selected window)
  const summaries = useMemo(() => {
    return selectedEmployees.map((userId) => {
      const data = getEmployeeDailyPnL(userId);
      const total = data.reduce((s, d) => s + (d.pnl || 0), 0);
      const wins = data.filter((d) => (d.pnl || 0) > 0).length;
      const losses = data.filter((d) => (d.pnl || 0) < 0).length;
      const days = wins + losses;
      const winRate = days > 0 ? (wins / days) * 100 : 0;
      return { userId, total, wins, losses, winRate };
    });
  }, [selectedEmployees, getEmployeeDailyPnL]);

  const formatXAxis = (value: string) => format(parseISO(value), "MMM d");
  const formatCurrency = (v: number) => formatCurrencyCompact(v);
  const formatFull = (v: number) => `${v < 0 ? "-" : ""}$${formatIndian(Math.abs(v))}`;

  const EquityTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl animate-scale-in">
        <p className="text-sm font-medium text-foreground mb-2">
          {format(parseISO(label), "MMM d, yyyy")}
        </p>
        {payload.map((entry: any, idx: number) => {
          const userId = entry.dataKey.split("_")[0];
          return (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{getEmployeeName(userId)}:</span>
              <span className="font-medium text-foreground">
                {formatFull(entry.value || 0)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const PnlTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl animate-scale-in">
        <p className="text-sm font-medium text-foreground mb-2">
          {format(parseISO(label), "MMM d, yyyy")}
        </p>
        {payload.map((entry: any, idx: number) => {
          const userId = entry.dataKey.split("_")[0];
          const v = entry.value || 0;
          const color = v >= 0 ? POS : NEG;
          return (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {v >= 0 ? (
                <TrendingUp className="h-3 w-3" style={{ color }} />
              ) : (
                <TrendingDown className="h-3 w-3" style={{ color }} />
              )}
              <span className="text-muted-foreground">{getEmployeeName(userId)}:</span>
              <span className="font-semibold" style={{ color }}>
                {formatFull(v)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-border/50 hover-lift-sm transition-all">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Employee Comparison
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={addEmployee}>
              <SelectTrigger className="w-48 transition-all hover:border-primary/50">
                <SelectValue placeholder="Add employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => !selectedEmployees.includes(e.userId))
                  .map((e) => (
                    <SelectItem key={e.userId} value={e.userId}>
                      {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedEmployees.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEmployees([])}
                className="transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {selectedEmployees.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedEmployees.map((userId, idx) => (
              <Badge
                key={userId}
                variant="outline"
                className="flex items-center gap-1.5 pr-1 pl-2 py-1 animate-scale-in transition-all hover:scale-105"
                style={{
                  borderColor: COLORS[idx % COLORS.length],
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                {getEmployeeName(userId)}
                <button
                  onClick={() => removeEmployee(userId)}
                  className="ml-1 hover:bg-destructive/15 hover:text-destructive rounded p-0.5 transition-colors"
                  aria-label={`Remove ${getEmployeeName(userId)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {selectedEmployees.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground animate-fade-in">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Select employees above to compare their performance</p>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Per-employee summary chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {summaries.map((s, idx) => {
                const positive = s.total >= 0;
                const color = COLORS[idx % COLORS.length];
                return (
                  <div
                    key={s.userId}
                    className="rounded-lg border border-border/60 bg-card/50 p-3 hover-lift-sm transition-all animate-scale-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {getEmployeeName(s.userId)}
                      </span>
                    </div>
                    <div
                      className="text-base font-bold tabular-nums"
                      style={{ color: positive ? POS : NEG }}
                    >
                      {formatFull(s.total)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {s.wins}W / {s.losses}L · {s.winRate.toFixed(0)}% win
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Equity Curve */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Equity Curve</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatXAxis}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tickFormatter={formatCurrency}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <Tooltip content={<EquityTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                    {selectedEmployees.map((userId, idx) => (
                      <Line
                        key={userId}
                        type="monotone"
                        dataKey={`${userId}_equity`}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        name={getEmployeeName(userId)}
                        connectNulls
                        isAnimationActive
                        animationDuration={700}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily PnL — bar chart with sign-based color */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Daily PnL</h3>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: POS }} />
                    Profit
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: NEG }} />
                    Loss
                  </span>
                </div>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatXAxis}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tickFormatter={formatCurrency}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip
                      content={<PnlTooltip />}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                    />
                    {selectedEmployees.map((userId) => (
                      <Bar
                        key={userId}
                        dataKey={`${userId}_pnl`}
                        name={getEmployeeName(userId)}
                        radius={[2, 2, 0, 0]}
                        isAnimationActive
                        animationDuration={600}
                      >
                        {comparisonData.map((d, i) => {
                          const v = d[`${userId}_pnl`] as number;
                          return (
                            <Cell key={`c-${userId}-${i}`} fill={v >= 0 ? POS : NEG} />
                          );
                        })}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {selectedEmployees.length > 1 && (
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Bars are colored by profit (green) or loss (red). Use the summary chips above to attribute totals per employee.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeComparison;
