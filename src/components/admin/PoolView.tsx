import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Landmark, Users } from "lucide-react";
import { formatIndian } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_role?: string;
  trader_number?: string;
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
  const [tradingData, setTradingData] = useState<any[]>([]);
  const [traderConfigs, setTraderConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Realtime: re-fetch whenever trading_data or trader_config changes
  useEffect(() => {
    const channel = supabase
      .channel('pool-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_data' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trader_config' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);

    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const [tdRes, configRes] = await Promise.all([
      supabase.from("trading_data").select("*")
        .gte("trade_date", startDate)
        .lt("trade_date", endDate),
      supabase.from("trader_config").select("*")
        .eq("month", selectedMonth).eq("year", selectedYear),
    ]);

    if (tdRes.data) setTradingData(tdRes.data);
    
    // If no config for selected month, fallback to most recent config
    if (configRes.data && configRes.data.length > 0) {
      setTraderConfigs(configRes.data);
    } else {
      const { data: fallback } = await supabase.from("trader_config").select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(100);
      // Group by user_id, take latest per user
      const latestPerUser = new Map<string, any>();
      (fallback || []).forEach(c => {
        if (!latestPerUser.has(c.user_id)) latestPerUser.set(c.user_id, c);
      });
      setTraderConfigs([...latestPerUser.values()]);
    }
    setLoading(false);
  };

  const trainees = users.filter(u => u.employee_role === "trainee");

  const poolData = useMemo(() => {
    // Step 1: Find all partner pairs (exempt from pool)
    const partnerExemptSet = new Set<string>();
    tradingData.forEach(td => {
      if (td.trader2_role?.toLowerCase() === "partner") {
        partnerExemptSet.add(td.user_id);
        if (td.trader2_id) partnerExemptSet.add(td.trader2_id);
      }
    });

    // Step 2: Aggregate per trader (non-partner traders only)
    const traderMap = new Map<string, { totalPnl: number; totalShares: number }>();
    
    tradingData.forEach(td => {
      if (partnerExemptSet.has(td.user_id)) return;
      
      const existing = traderMap.get(td.user_id) || { totalPnl: 0, totalShares: 0 };
      existing.totalPnl += Number(td.net_pnl) || 0;
      existing.totalShares += Number(td.shares_traded) || 0;
      traderMap.set(td.user_id, existing);
    });

    // Step 3: Calculate net profit, then STO using payout%, then 25% pool
    const contributions: Array<{
      userId: string;
      traderName: string;
      traderNumber: string;
      grossPnl: number;
      shareCost: number;
      softwareCost: number;
      netProfit: number;
      payoutPercent: number;
      stoAmount: number;
      poolContribution: number;
    }> = [];

    traderMap.forEach((data, userId) => {
      const profile = users.find(u => u.user_id === userId);
      if (!profile) return;

      const config = traderConfigs.find(c => c.user_id === userId);
      const softwareCost = config ? Number(config.software_cost) : 0;
      const payoutPercent = config ? Number(config.payout_percentage) : 0;
      const shareCost = (data.totalShares / 1000) * 14;
      const netProfit = data.totalPnl - shareCost - softwareCost;

      if (netProfit > 0 && payoutPercent > 0) {
        const stoAmount = netProfit * (payoutPercent / 100);
        contributions.push({
          userId,
          traderName: profile.full_name,
          traderNumber: profile.trader_number || "",
          grossPnl: data.totalPnl,
          shareCost,
          softwareCost,
          netProfit,
          payoutPercent,
          stoAmount,
          poolContribution: stoAmount * 0.25,
        });
      }
    });

    // Sort by trader number
    contributions.sort((a, b) => {
      const numA = parseInt(a.traderNumber.replace(/\D/g, "")) || 999;
      const numB = parseInt(b.traderNumber.replace(/\D/g, "")) || 999;
      return numA - numB;
    });

    const totalPool = contributions.reduce((sum, c) => sum + c.poolContribution, 0);

    const exemptTraders = [...partnerExemptSet].map(uid => {
      const p = users.find(u => u.user_id === uid);
      return p?.full_name || "Unknown";
    });

    return { contributions, totalPool, exemptTraders };
  }, [tradingData, traderConfigs, users]);

  // Auto-save pool ledger to DB whenever it recalculates
  const lastSavedRef = useRef("");
  useEffect(() => {
    if (loading) return;
    const key = `${selectedMonth}-${selectedYear}-${poolData.totalPool.toFixed(4)}-${poolData.contributions.length}`;
    if (key === lastSavedRef.current) return;
    lastSavedRef.current = key;

    const savePool = async () => {
      const { data: existing } = await supabase.from("trainee_pool_ledger")
        .select("id, num_trainees, per_trainee_amount")
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();

      if (existing?.id) {
        // Preserve admin-managed num_trainees / per_trainee_amount
        await supabase.from("trainee_pool_ledger")
          .update({ total_pool_amount: poolData.totalPool })
          .eq("id", existing.id);
      } else {
        await supabase.from("trainee_pool_ledger").insert({
          month: selectedMonth,
          year: selectedYear,
          total_pool_amount: poolData.totalPool,
          num_trainees: 0,
          per_trainee_amount: 0,
        });
      }
    };
    savePool();
  }, [poolData, selectedMonth, selectedYear, loading]);

  const chartData = poolData.contributions
    .filter(c => c.poolContribution > 0)
    .map((c, i) => ({
      name: c.traderName,
      value: Number(c.poolContribution.toFixed(2)),
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
              Trainee Pool — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
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

      {/* Summary Card */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pool</p>
            <p className="text-2xl font-bold text-primary">
              ${formatIndian(poolData.totalPool, 2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From {poolData.contributions.length} trader(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Exempt Partners Info */}
      {poolData.exemptTraders.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">Partner Pairs — Exempt from Pool</p>
            <div className="flex flex-wrap gap-2">
              {poolData.exemptTraders.map((name, i) => (
                <Badge key={i} variant="secondary">{name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                No pool contributions for this month.
              </p>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trader</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">Payout %</TableHead>
                      <TableHead className="text-right">STO</TableHead>
                      <TableHead className="text-right">Pool (25%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolData.contributions.map(c => (
                      <TableRow key={c.userId}>
                        <TableCell className="font-medium">{c.traderName}</TableCell>
                        <TableCell className="text-right">${formatIndian(c.netProfit, 2)}</TableCell>
                        <TableCell className="text-right">{c.payoutPercent}%</TableCell>
                        <TableCell className="text-right">${formatIndian(c.stoAmount, 2)}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          ${formatIndian(c.poolContribution, 2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right">Total Pool</TableCell>
                      <TableCell className="text-right text-primary">
                        ${formatIndian(poolData.totalPool, 2)}
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
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
                    label={({ name, value }) => `${name}: $${formatIndian(value, 0)}`}
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

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PoolView;
