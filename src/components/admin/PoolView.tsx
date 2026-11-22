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
import { fetchAllRows } from "@/lib/fetchAllRows";
import { loadAllTraderHistories } from "@/hooks/useTraderHistory";
import type { HistoryMonth } from "@/lib/payoutEngine";

/** STO records saved from this date use the new payout engine. */
const NEW_PAYOUT_RULES_FROM = "2026-11-23";

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
  // Per-trader results for the selected month from the shared payout engine.
  const [monthResults, setMonthResults] = useState<
    { userId: string; result: HistoryMonth; savedPool: number | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Realtime: re-fetch whenever trading_data, trader_config or the STO ledger changes
  useEffect(() => {
    const channel = supabase
      .channel('pool-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_data' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trader_config' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sto_ledger' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedMonth, selectedYear]);

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const startDate = `${monthKey}-01`;
      const endDate = `${monthKey}-${String(new Date(selectedYear, selectedMonth, 0).getDate()).padStart(2, "0")}`;
      const [monthRows, ledgerRes] = await Promise.all([
        fetchAllRows<any>((f, t) =>
          supabase.from("trading_data").select("id, user_id, trader2_id, trader2_role")
            .gte("trade_date", startDate).lte("trade_date", endDate).order("id").range(f, t)),
        supabase.from("sto_ledger").select("user_id, trainee_pool_contribution, updated_at")
          .eq("month", selectedMonth).eq("year", selectedYear),
      ]);
      if (ledgerRes.error) throw ledgerRes.error;
      const ids = new Set<string>();
      monthRows.forEach((r: any) => {
        ids.add(r.user_id);
        if ((r.trader2_role || "").toLowerCase() === "partner" && r.trader2_id) ids.add(r.trader2_id);
      });
      const histories = await loadAllTraderHistories([...ids]);
      const saved = new Map(
        (ledgerRes.data ?? [])
          // Only records saved with the new payout engine carry the new 25% rule.
          .filter((l: any) => String(l.updated_at) >= NEW_PAYOUT_RULES_FROM)
          .map((l: any) => [l.user_id, Number(l.trainee_pool_contribution) || 0])
      );
      setMonthResults(
        [...ids]
          .map((userId) => ({
            userId,
            result: histories.get(userId)?.byMonth.get(monthKey) as HistoryMonth,
            savedPool: saved.has(userId) ? (saved.get(userId) as number) : null,
          }))
          .filter((x) => !!x.result)
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setMonthResults([]);
    } finally {
      setLoading(false);
    }
  };

  const trainees = users.filter(u => u.employee_role === "trainee");

  const poolData = useMemo(() => {
    const contributions = monthResults
      .map(({ userId, result: m, savedPool }) => {
        const profile = users.find(u => u.user_id === userId);
        return {
          userId,
          traderName: profile?.full_name || "Unknown",
          traderNumber: profile?.trader_number || "",
          grossPnl: m.grossPnl,
          shareCost: m.shareCost,
          softwareCost: m.softwareCost,
          netProfit: m.netProfit,
          payoutPercent: m.stoPercent,
          stoAmount: m.sto,
          // Saved month = exactly what the Payout Sheet deducted; otherwise an estimate before leave.
          poolContribution: savedPool ?? m.secondPcShare,
          estimated: savedPool === null,
          partnered: m.partnered,
        };
      })
      .filter(c => c.poolContribution > 0);

    contributions.sort((a, b) => {
      const numA = parseInt(a.traderNumber.replace(/\D/g, "")) || 999;
      const numB = parseInt(b.traderNumber.replace(/\D/g, "")) || 999;
      return numA - numB;
    });

    const totalPool = contributions.reduce((sum, c) => sum + c.poolContribution, 0);
    // Partners pay the 25% on their solo days only.
    const exemptTraders = monthResults
      .filter(({ result }) => result.partnered)
      .map(({ userId }) => users.find(u => u.user_id === userId)?.full_name || "Unknown");

    return { contributions, totalPool, exemptTraders };
  }, [monthResults, users]);

  // Auto-save pool ledger to DB whenever it recalculates
  const lastSavedRef = useRef("");
  useEffect(() => {
    // Never overwrite the saved pool total with figures from a failed load.
    if (loading || loadError) return;
    const key = `${selectedMonth}-${selectedYear}-${poolData.totalPool.toFixed(4)}-${poolData.contributions.length}`;
    if (key === lastSavedRef.current) return;
    lastSavedRef.current = key;

    const savePool = async () => {
      const { data: existing } = await supabase.from("trainee_pool_ledger")
        .select("id, num_trainees, per_trainee_amount")
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();

      if (existing?.id) {
        // Preserve admin-managed num_trainees / per_trainee_amount
        const { error } = await supabase.from("trainee_pool_ledger")
          .update({ total_pool_amount: poolData.totalPool })
          .eq("id", existing.id);
        if (error) console.error("Pool total not saved:", error.message);
      } else {
        const { error } = await supabase.from("trainee_pool_ledger").insert({
          month: selectedMonth,
          year: selectedYear,
          total_pool_amount: poolData.totalPool,
          num_trainees: 0,
          per_trainee_amount: 0,
        });
        if (error) console.error("Pool total not saved:", error.message);
      }
    };
    savePool();
  }, [poolData, selectedMonth, selectedYear, loading, loadError]);

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
            <p className="text-sm font-medium text-muted-foreground mb-2">Sat with a partner this month — 25% applies to their solo days only</p>
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
            ) : loadError ? (
              <p className="text-sm text-red-600 text-center py-8">Couldn't load this month's data: {loadError}</p>
            ) : poolData.contributions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No pool contributions for this month.
              </p>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trader</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">STO %</TableHead>
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
                          {c.estimated && (
                            <span className="block text-[10px] font-normal text-amber-600" title="Month not saved in the Payout Sheet yet; estimate before any leave deduction">
                              estimate
                            </span>
                          )}
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
