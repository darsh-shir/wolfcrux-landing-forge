import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, TrendingDown, Calendar, Target, 
  Award, AlertTriangle, Percent, Activity 
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  Cell
} from "recharts";
import { format, parseISO } from "date-fns";

interface DailySummary {
  date: string;
  combinedPnl: number;
  totalShares: number;
  brokerage: number;
  netAfterBrokerage: number;
}

interface TradingAnalyticsProps {
  dailySummary: DailySummary[];
  totalPnl: number;
  netAfterBrokerage: number;
  tradingDays: number;
}

const TradingAnalytics = ({ dailySummary, totalPnl, netAfterBrokerage, tradingDays }: TradingAnalyticsProps) => {
  const analytics = useMemo(() => {
    if (dailySummary.length === 0) {
      return {
        bestDay: { date: "-", pnl: 0 },
        worstDay: { date: "-", pnl: 0 },
        avgDailyPnl: 0,
        winningDays: 0,
        losingDays: 0,
        winRate: 0,
        avgWinningDay: 0,
        avgLosingDay: 0,
        profitFactor: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
      };
    }

    const sortedByPnl = [...dailySummary].sort((a, b) => b.netAfterBrokerage - a.netAfterBrokerage);
    const bestDay = sortedByPnl[0];
    const worstDay = sortedByPnl[sortedByPnl.length - 1];

    const winningDays = dailySummary.filter(d => d.netAfterBrokerage > 0);
    const losingDays = dailySummary.filter(d => d.netAfterBrokerage < 0);

    const avgDailyPnl = netAfterBrokerage / tradingDays;
    const winRate = (winningDays.length / tradingDays) * 100;
    
    const avgWinningDay = winningDays.length > 0 
      ? winningDays.reduce((sum, d) => sum + d.netAfterBrokerage, 0) / winningDays.length 
      : 0;
    const avgLosingDay = losingDays.length > 0 
      ? losingDays.reduce((sum, d) => sum + d.netAfterBrokerage, 0) / losingDays.length 
      : 0;

    const totalProfit = winningDays.reduce((sum, d) => sum + d.netAfterBrokerage, 0);
    const totalLoss = Math.abs(losingDays.reduce((sum, d) => sum + d.netAfterBrokerage, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // Calculate consecutive wins/losses
    const sortedByDate = [...dailySummary].sort((a, b) => a.date.localeCompare(b.date));
    let maxWins = 0, maxLosses = 0, currentWins = 0, currentLosses = 0;
    
    sortedByDate.forEach(d => {
      if (d.netAfterBrokerage > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (d.netAfterBrokerage < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    });

    return {
      bestDay: { date: bestDay.date, pnl: bestDay.netAfterBrokerage },
      worstDay: { date: worstDay.date, pnl: worstDay.netAfterBrokerage },
      avgDailyPnl,
      winningDays: winningDays.length,
      losingDays: losingDays.length,
      winRate,
      avgWinningDay,
      avgLosingDay,
      profitFactor,
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
    };
  }, [dailySummary, netAfterBrokerage, tradingDays]);

  // Prepare chart data (sorted by date ascending)
  const chartData = useMemo(() => {
    const sorted = [...dailySummary].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    return sorted.map(d => {
      cumulative += d.netAfterBrokerage;
      return {
        date: d.date,
        pnl: d.netAfterBrokerage,
        cumulative,
        displayDate: format(parseISO(d.date), "MMM d"),
      };
    });
  }, [dailySummary]);

  if (dailySummary.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No trading data available for analytics.
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Best Day */}
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Award className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Best Day</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(analytics.bestDay.pnl)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.bestDay.date !== "-" ? format(parseISO(analytics.bestDay.date), "MMM d, yy") : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worst Day */}
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Worst Day</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(analytics.worstDay.pnl)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.worstDay.date !== "-" ? format(parseISO(analytics.worstDay.date), "MMM d, yy") : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Days */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Trading Days</p>
                <p className="text-lg font-bold">{tradingDays}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.winningDays}W / {analytics.losingDays}L
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Percent className="h-4 w-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Win Rate</p>
                <p className="text-lg font-bold">{analytics.winRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  PF: {analytics.profitFactor === Infinity ? "∞" : analytics.profitFactor.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Daily P&L */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${analytics.avgDailyPnl >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                <Activity className="h-4 w-4" style={{ color: analytics.avgDailyPnl >= 0 ? "#16a34a" : "#dc2626" }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Avg Daily P&L</p>
                <p className={`text-lg font-bold ${analytics.avgDailyPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(analytics.avgDailyPnl)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Winning Day */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Avg Winning Day</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(analytics.avgWinningDay)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Losing Day */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Avg Losing Day</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(analytics.avgLosingDay)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consecutive Streaks */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Target className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Max Streak</p>
                <p className="text-lg font-bold">
                  <span className="text-green-600">{analytics.maxConsecutiveWins}W</span>
                  {" / "}
                  <span className="text-red-600">{analytics.maxConsecutiveLosses}L</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative P&L Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Cumulative P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPnlNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg p-3">
                            <p className="text-sm font-medium">{data.displayDate}</p>
                            <p className={`text-sm font-bold ${data.cumulative >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(data.cumulative)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke={netAfterBrokerage >= 0 ? "#22c55e" : "#ef4444"}
                    strokeWidth={2}
                    fill={netAfterBrokerage >= 0 ? "url(#colorPnl)" : "url(#colorPnlNeg)"}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily P&L Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Daily P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v.toLocaleString()}`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg p-3">
                            <p className="text-sm font-medium">{data.displayDate}</p>
                            <p className={`text-sm font-bold ${data.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(data.pnl)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TradingAnalytics;
