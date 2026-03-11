import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Landmark, Users } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface PoolViewProps {
  users: Profile[];
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16"];

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const PoolView = ({ users }: PoolViewProps) => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [configs, setConfigs] = useState<any[]>([]);
  const [tradingData, setTradingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const monthEnd = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [configRes, tradesRes] = await Promise.all([
      supabase.from("trader_config").select("*").eq("month", selectedMonth).eq("year", selectedYear),
      supabase.from("trading_data").select("*").gte("trade_date", monthStart).lte("trade_date", monthEnd),
    ]);

    if (configRes.data) setConfigs(configRes.data);
    if (tradesRes.data) setTradingData(tradesRes.data);
    setLoading(false);
  };

  const poolData = useMemo(() => {
    // Find all trading_data rows where trader2_role is 'trainee' (case-insensitive)
    const traineeEntries = tradingData.filter(
      t => t.trader2_role && t.trader2_role.toLowerCase() === "trainee"
    );

    // Group by primary trader (user_id)
    const traderMap: Record<string, any[]> = {};
    for (const entry of traineeEntries) {
      if (!traderMap[entry.user_id]) traderMap[entry.user_id] = [];
      traderMap[entry.user_id].push(entry);
    }

    // We also need all trading data for each trader to calculate total trading days
    const allTradesMap: Record<string, any[]> = {};
    for (const entry of tradingData) {
      if (!allTradesMap[entry.user_id]) allTradesMap[entry.user_id] = [];
      allTradesMap[entry.user_id].push(entry);
    }

    const contributions = Object.entries(traderMap).map(([userId, traineeTrades]) => {
      // Get trader config for payout percentage
      const cfg = configs.find(c => c.user_id === userId);
      if (!cfg) return null;

      // Use ALL trades for this trader (not just trainee ones) for full P&L calculation
      const allTrades = allTradesMap[userId] || traineeTrades;
      const totalPnl = allTrades.reduce((sum: number, t: any) => sum + Number(t.net_pnl), 0);
      const totalShares = allTrades.reduce((sum: number, t: any) => sum + Number(t.shares_traded), 0);
      const shareCharge = (totalShares / 1000) * 14;
      const softwareCost = Number(cfg.software_cost) || 0;
      const grossAmount = totalPnl - shareCharge - softwareCost;

      const payoutPct = Number(cfg.payout_percentage) / 100;
      const tradersShare = grossAmount * payoutPct;
      // Net payout = trader's share (simplified, without attendance deductions here)
      const netPayout = tradersShare;

      // Calculate days with trainee vs total trading days
      const tradingDays = allTrades.filter((t: any) => !t.is_holiday).length;
      const traineeDays = traineeTrades.length;
      const dayRatio = tradingDays > 0 ? traineeDays / tradingDays : 0;

      // Pool contribution = 25% of net payout, proportional to days with trainee
      const poolAmount = netPayout * dayRatio * 0.25;

      const traderUser = users.find(u => u.user_id === userId);
      // Find trainee name from the trades (trader2_id)
      const traineeIds = [...new Set(traineeTrades.map(t => t.trader2_id).filter(Boolean))];
      const traineeNames = traineeIds.map(id => {
        const u = users.find(u => u.user_id === id);
        return u?.full_name || "Unknown";
      });

      return {
        userId,
        traderName: traderUser?.full_name || "Unknown",
        traineeName: traineeNames.join(", ") || "N/A",
        payoutPct: cfg.payout_percentage,
        grossAmount,
        tradersShare,
        poolAmount: Math.max(0, poolAmount),
      };
    }).filter(Boolean) as {
      userId: string;
      traderName: string;
      traineeName: string;
      payoutPct: number;
      grossAmount: number;
      tradersShare: number;
      poolAmount: number;
    }[];

    const totalPool = contributions.reduce((sum, c) => sum + c.poolAmount, 0);

    return { contributions, totalPool };
  }, [configs, tradingData, users]);

  const chartData = poolData.contributions
    .filter(c => c.poolAmount > 0)
    .map((c, i) => ({
      name: c.traderName,
      value: Number(c.poolAmount.toFixed(2)),
      fill: COLORS[i % COLORS.length],
    }));

  const chartConfig = Object.fromEntries(
    chartData.map(d => [d.name, { label: d.name, color: d.fill }])
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Pool Contributions
            </CardTitle>
            <div className="flex gap-2">
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contributions Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : poolData.contributions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No traders with trainees found for this month.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trader</TableHead>
                      <TableHead>Trainee</TableHead>
                      <TableHead className="text-right">Payout %</TableHead>
                      <TableHead className="text-right">Gross ($)</TableHead>
                      <TableHead className="text-right">Trader's Share ($)</TableHead>
                      <TableHead className="text-right">Pool 25% ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolData.contributions.map(c => (
                      <TableRow key={c.userId}>
                        <TableCell className="font-medium">{c.traderName}</TableCell>
                        <TableCell>{c.traineeName}</TableCell>
                        <TableCell className="text-right">{c.payoutPct}%</TableCell>
                        <TableCell className="text-right">${c.grossAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${c.tradersShare.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          ${c.poolAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={5} className="text-right">Total Pool</TableCell>
                      <TableCell className="text-right text-primary">
                        ${poolData.totalPool.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pool Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data to display.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: $${value}`}
                    labelLine
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}

            <div className="mt-4 p-4 rounded-lg bg-muted/30 border text-center">
              <p className="text-sm text-muted-foreground">Total Pool for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              <p className="text-3xl font-bold text-primary mt-1">
                ${poolData.totalPool.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                From {poolData.contributions.length} trader{poolData.contributions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PoolView;
