import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ReferenceLine
} from "recharts";
import { DailyPnL, ChartGranularity } from "./types";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";

interface CompanyChartsProps {
  dailyPnLData: DailyPnL[];
}

const CompanyCharts = ({ dailyPnLData }: CompanyChartsProps) => {
  const [granularity, setGranularity] = useState<ChartGranularity>("daily");

  // Aggregate data based on granularity
  const aggregatedData = (() => {
    if (granularity === "daily") return dailyPnLData;

    const grouped: Record<string, { pnl: number; count: number }> = {};
    
    dailyPnLData.forEach((d) => {
      const date = parseISO(d.date);
      let key: string;
      
      if (granularity === "weekly") {
        key = format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
      } else {
        key = format(startOfMonth(date), "yyyy-MM");
      }
      
      if (!grouped[key]) grouped[key] = { pnl: 0, count: 0 };
      grouped[key].pnl += d.pnl;
      grouped[key].count += 1;
    });

    let cumulativePnl = 0;
    const baseEquity = dailyPnLData[0]?.equity || 100000;
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        cumulativePnl += data.pnl;
        return {
          date,
          pnl: data.pnl,
          cumulativePnl,
          equity: baseEquity + cumulativePnl - dailyPnLData[0]?.cumulativePnl + dailyPnLData[0]?.pnl,
        };
      });
  })();

  // Calculate drawdown data
  const drawdownData = (() => {
    let maxEquity = 0;
    return aggregatedData.map((d) => {
      maxEquity = Math.max(maxEquity, d.equity);
      const drawdown = ((maxEquity - d.equity) / maxEquity) * 100;
      return { ...d, drawdown };
    });
  })();

  const formatXAxis = (value: string) => {
    if (granularity === "monthly") {
      return format(parseISO(value + "-01"), "MMM yy");
    }
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
          {granularity === "monthly" 
            ? format(parseISO(label + "-01"), "MMMM yyyy")
            : format(parseISO(label), "MMM d, yyyy")}
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Company Performance</h2>
        <Tabs value={granularity} onValueChange={(v) => setGranularity(v as ChartGranularity)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily PnL Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Daily PnL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aggregatedData}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="pnl" 
                    stroke="#10b981"
                    fill="url(#pnlGradient)"
                    strokeWidth={2}
                    name="PnL"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Equity Curve */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggregatedData}>
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
          </CardContent>
        </Card>

        {/* Profit vs Loss Bar Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Profit vs Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregatedData}>
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
                    radius={[4, 4, 0, 0]}
                    fill="#10b981"
                  >
                    {aggregatedData.map((entry, index) => (
                      <rect 
                        key={index} 
                        fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Drawdown Curve */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Drawdown Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownData}>
                  <defs>
                    <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#drawdownGradient)"
                    strokeWidth={2}
                    name="Drawdown"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanyCharts;
