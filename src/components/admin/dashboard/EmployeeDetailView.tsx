import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { 
  X, TrendingUp, TrendingDown, Target, Activity,
  Calendar, DollarSign, Percent, AlertTriangle
} from "lucide-react";
import { EmployeeStats, DailyPnL } from "./types";
import { format, parseISO } from "date-fns";

interface EmployeeDetailViewProps {
  employee: EmployeeStats;
  dailyPnL: DailyPnL[];
  onClose: () => void;
}

const EmployeeDetailView = ({ employee, dailyPnL, onClose }: EmployeeDetailViewProps) => {
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatXAxis = (value: string) => {
    return format(parseISO(value), "MMM d");
  };

  // Calculate drawdown data
  const drawdownData = (() => {
    let maxEquity = 0;
    return dailyPnL.map((d) => {
      maxEquity = Math.max(maxEquity, d.equity);
      const drawdown = ((maxEquity - d.equity) / maxEquity) * 100;
      return { ...d, drawdown };
    });
  })();

  // Calculate average winning and losing days
  const winningDaysPnL = dailyPnL.filter((d) => d.pnl > 0);
  const losingDaysPnL = dailyPnL.filter((d) => d.pnl < 0);
  const avgWinningDay = winningDaysPnL.length > 0
    ? winningDaysPnL.reduce((sum, d) => sum + d.pnl, 0) / winningDaysPnL.length
    : 0;
  const avgLosingDay = losingDaysPnL.length > 0
    ? losingDaysPnL.reduce((sum, d) => sum + d.pnl, 0) / losingDaysPnL.length
    : 0;

  const stats = [
    { label: "Total PnL", value: formatCurrency(employee.totalPnl), icon: DollarSign, color: employee.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Today PnL", value: formatCurrency(employee.todayPnl), icon: TrendingUp, color: employee.todayPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Win Rate", value: `${employee.winRate.toFixed(1)}%`, icon: Target, color: employee.winRate >= 50 ? "text-emerald-400" : "text-orange-400" },
    { label: "Max Drawdown", value: formatCurrency(employee.maxDrawdown), icon: AlertTriangle, color: "text-orange-400" },
    { label: "Trading Days", value: employee.tradingDays.toString(), icon: Calendar, color: "text-blue-400" },
    { label: "Avg Daily PnL", value: formatCurrency(employee.avgDailyPnl), icon: Activity, color: employee.avgDailyPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Max Profit (Day)", value: formatCurrency(employee.maxProfit), icon: TrendingUp, color: "text-emerald-400" },
    { label: "Max Loss (Day)", value: formatCurrency(employee.maxLoss), icon: TrendingDown, color: "text-red-400" },
    { label: "Avg Winning Day", value: formatCurrency(avgWinningDay), icon: TrendingUp, color: "text-emerald-400" },
    { label: "Avg Losing Day", value: formatCurrency(avgLosingDay), icon: TrendingDown, color: "text-red-400" },
    { label: "Winning Days", value: employee.winningDays.toString(), icon: Percent, color: "text-emerald-400" },
    { label: "Losing Days", value: employee.losingDays.toString(), icon: Percent, color: "text-red-400" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          {format(parseISO(label), "MMM d, yyyy")}
        </p>
        {payload.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className={`font-medium ${
              entry.name === "Drawdown" ? "text-red-400" :
              entry.value >= 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              {entry.name === "Drawdown" ? `${entry.value.toFixed(2)}%` : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CardTitle className="text-xl font-semibold">{employee.name}</CardTitle>
              <Badge 
                variant={employee.status === "Active" ? "default" : "secondary"}
                className={employee.status === "Active" 
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                  : "bg-muted text-muted-foreground"
                }
              >
                {employee.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{employee.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className={`text-lg font-semibold ${stat.color}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equity Curve */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Equity Curve</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyPnL}>
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
                  <Line 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="Equity"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily PnL */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Daily PnL</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyPnL}>
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
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar 
                    dataKey="pnl" 
                    name="PnL"
                    radius={[2, 2, 0, 0]}
                  >
                    {dailyPnL.map((entry, index) => (
                      <rect 
                        key={index} 
                        fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative PnL */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Cumulative PnL</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyPnL}>
                  <defs>
                    <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Area 
                    type="monotone" 
                    dataKey="cumulativePnl" 
                    stroke="#10b981"
                    fill="url(#cumulativeGradient)"
                    strokeWidth={2}
                    name="Cumulative PnL"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Drawdown */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Drawdown</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownData}>
                  <defs>
                    <linearGradient id="drawdownDetailGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area 
                    type="monotone" 
                    dataKey="drawdown" 
                    stroke="#ef4444"
                    fill="url(#drawdownDetailGradient)"
                    strokeWidth={2}
                    name="Drawdown"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeDetailView;
