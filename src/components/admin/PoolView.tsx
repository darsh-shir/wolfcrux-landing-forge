import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
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
    // Find traders with "With Trainee" seat type
    const traineeConfigs = configs.filter(c => c.seat_type === "With Trainee");

    const contributions = traineeConfigs.map(cfg => {
      const traderTrades = tradingData.filter(t => t.user_id === cfg.user_id);
      if (traderTrades.length === 0) return null;

      const totalPnl = traderTrades.reduce((sum: number, t: any) => sum + Number(t.net_pnl), 0);
      const totalShares = traderTrades.reduce((sum: number, t: any) => sum + Number(t.shares_traded), 0);
      const shareCharge = (totalShares / 1000) * 14;
      const softwareCost = Number(cfg.software_cost) || 0;
      const grossAmount = totalPnl - shareCharge - softwareCost;

      const payoutPct = Number(cfg.payout_percentage) / 100;
      const tradersShare = grossAmount * payoutPct;

      // Pool contribution = 25% of payout percentage applied to gross
      // i.e., payout_percentage * 0.25 of gross amount
      const poolPct = Number(cfg.payout_percentage) * 0.25;
      const poolAmount = grossAmount * (poolPct / 100);

      const traderUser = users.find(u => u.user_id === cfg.user_id);
      const partnerUser = users.find(u => u.user_id === cfg.partner_id);

      return {
        userId: cfg.user_id,
        traderName: traderUser?.full_name || "Unknown",
        traineeName: partnerUser?.full_name || "N/A",
        payoutPct: cfg.payout_percentage,
        poolPct: poolPct,
        grossAmount,
        poolAmount: Math.max(0, poolAmount),
      };
    }).filter(Boolean) as {
      userId: string;
      traderName: string;
      traineeName: string;
      payoutPct: number;
      poolPct: number;
      grossAmount: number;
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
      {/* Header */}
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
        {/* Table */}
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
                      <TableHead className="text-right">Pool %</TableHead>
                      <TableHead className="text-right">Gross ($)</TableHead>
                      <TableHead className="text-right">Pool Amount ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolData.contributions.map(c => (
                      <TableRow key={c.userId}>
                        <TableCell className="font-medium">{c.traderName}</TableCell>
                        <TableCell>{c.traineeName}</TableCell>
                        <TableCell className="text-right">{c.payoutPct}%</TableCell>
                        <TableCell className="text-right">{c.poolPct.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">${c.grossAmount.toFixed(2)}</TableCell>
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

        {/* Pie Chart */}
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

            {/* Total summary card */}
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
