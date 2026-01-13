import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { X } from "lucide-react";
import { EmployeeStats, DailyPnL } from "./types";
import { format, parseISO } from "date-fns";

interface EmployeeComparisonProps {
  employees: EmployeeStats[];
  getEmployeeDailyPnL: (userId: string) => DailyPnL[];
}

const COLORS = [
  "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", 
  "#06b6d4", "#ec4899", "#84cc16", "#6366f1"
];

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

  const getEmployeeName = (userId: string) => {
    return employees.find((e) => e.userId === userId)?.name || "Unknown";
  };

  const comparisonData = useMemo(() => {
    if (selectedEmployees.length === 0) return [];

    // Get all unique dates
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

    // Build combined data
    const sortedDates = Array.from(allDates).sort();
    return sortedDates.map((date) => {
      const point: Record<string, any> = { date };
      selectedEmployees.forEach((userId) => {
        const data = employeeData[userId][date];
        point[`${userId}_pnl`] = data?.pnl || 0;
        point[`${userId}_equity`] = data?.equity || null;
        point[`${userId}_cumulative`] = data?.cumulativePnl || null;
      });
      return point;
    });
  }, [selectedEmployees, getEmployeeDailyPnL]);

  // Calculate drawdown data
  const drawdownData = useMemo(() => {
    return comparisonData.map((point) => {
      const newPoint: Record<string, any> = { date: point.date };
      selectedEmployees.forEach((userId) => {
        const equity = point[`${userId}_equity`];
        if (equity !== null) {
          // Simple drawdown calculation based on equity
          const maxEquity = 25000 + Math.max(0, point[`${userId}_cumulative`] || 0);
          const drawdown = ((maxEquity - equity) / maxEquity) * 100;
          newPoint[`${userId}_drawdown`] = Math.max(0, drawdown);
        }
      });
      return newPoint;
    });
  }, [comparisonData, selectedEmployees]);

  const formatXAxis = (value: string) => {
    return format(parseISO(value), "MMM d");
  };

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          {format(parseISO(label), "MMM d, yyyy")}
        </p>
        {payload.map((entry: any, idx: number) => {
          const userId = entry.dataKey.split("_")[0];
          const name = getEmployeeName(userId);
          return (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{name}:</span>
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.dataKey.includes("drawdown") 
                  ? `${entry.value?.toFixed(2)}%` 
                  : formatCurrency(entry.value || 0)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle className="text-lg font-semibold">Employee Comparison</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={addEmployee}>
              <SelectTrigger className="w-48 bg-background/50">
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
                className="flex items-center gap-1 pr-1"
                style={{ borderColor: COLORS[idx % COLORS.length] }}
              >
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                {getEmployeeName(userId)}
                <button 
                  onClick={() => removeEmployee(userId)}
                  className="ml-1 hover:bg-muted rounded p-0.5"
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
          <div className="text-center py-16 text-muted-foreground">
            Select employees to compare their performance
          </div>
        ) : (
          <div className="space-y-6">
            {/* Equity Curve Comparison */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Equity Curve</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonData}>
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
                    <Tooltip content={<CustomTooltip />} />
                    {selectedEmployees.map((userId, idx) => (
                      <Line
                        key={userId}
                        type="monotone"
                        dataKey={`${userId}_equity`}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        name={getEmployeeName(userId)}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily PnL Comparison */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Daily PnL</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={comparisonData}>
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
                    <Tooltip content={<CustomTooltip />} />
                    {selectedEmployees.map((userId, idx) => (
                      <Area
                        key={userId}
                        type="monotone"
                        dataKey={`${userId}_pnl`}
                        stroke={COLORS[idx % COLORS.length]}
                        fill={COLORS[idx % COLORS.length]}
                        fillOpacity={0.1}
                        strokeWidth={2}
                        name={getEmployeeName(userId)}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Drawdown Comparison */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Drawdown</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={drawdownData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatXAxis}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis 
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      reversed
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {selectedEmployees.map((userId, idx) => (
                      <Area
                        key={userId}
                        type="monotone"
                        dataKey={`${userId}_drawdown`}
                        stroke={COLORS[idx % COLORS.length]}
                        fill={COLORS[idx % COLORS.length]}
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name={getEmployeeName(userId)}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeComparison;
