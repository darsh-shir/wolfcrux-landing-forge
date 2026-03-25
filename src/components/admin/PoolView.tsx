import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Landmark, Users, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_role?: string;
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
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [stoRecords, setStoRecords] = useState<any[]>([]);
  const [poolLedger, setPoolLedger] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);

    const [stoRes, poolRes] = await Promise.all([
      supabase.from("sto_ledger").select("*")
        .eq("month", selectedMonth).eq("year", selectedYear),
      supabase.from("trainee_pool_ledger").select("*")
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
    ]);

    if (stoRes.data) setStoRecords(stoRes.data);
    if (poolRes.data) setPoolLedger(poolRes.data);
    setLoading(false);
  };

  const trainees = users.filter(u => u.employee_role === "trainee");

  const poolData = useMemo(() => {
    // Get all STO records that have trainee_pool_contribution > 0
    const contributions = stoRecords
      .filter(s => Number(s.trainee_pool_contribution) > 0)
      .map(s => {
        const trader = users.find(u => u.user_id === s.user_id);
        return {
          userId: s.user_id,
          traderName: trader?.full_name || "Unknown",
          netProfit: Number(s.net_profit),
          stoAmount: Number(s.sto_amount),
          finalSto: Number(s.final_sto_amount),
          poolContribution: Number(s.trainee_pool_contribution),
        };
      });

    const totalPool = contributions.reduce((sum, c) => sum + c.poolContribution, 0);
    const numTrainees = trainees.length;
    const perTrainee = numTrainees > 0 ? totalPool / numTrainees : 0;

    return { contributions, totalPool, numTrainees, perTrainee };
  }, [stoRecords, users, trainees]);

  const handleSavePoolLedger = async () => {
    const payload = {
      month: selectedMonth,
      year: selectedYear,
      total_pool_amount: poolData.totalPool,
      num_trainees: poolData.numTrainees,
      per_trainee_amount: poolData.perTrainee,
    };

    if (poolLedger?.id) {
      await supabase.from("trainee_pool_ledger").update(payload).eq("id", poolLedger.id);
    } else {
      await supabase.from("trainee_pool_ledger").insert(payload);
    }

    toast({ title: "Saved", description: "Pool ledger saved successfully" });
    fetchData();
  };

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pool</p>
            <p className="text-2xl font-bold text-primary">
              ${poolData.totalPool.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From {poolData.contributions.length} trader(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Trainees</p>
            <p className="text-2xl font-bold">{poolData.numTrainees}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {trainees.map(t => t.full_name).join(", ") || "None"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Per Trainee</p>
            <p className="text-2xl font-bold text-green-600">
              ${poolData.perTrainee.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Equal distribution</p>
          </CardContent>
        </Card>
      </div>

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
                No pool contributions for this month. STO records with trainee pool deductions will appear here.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trader</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">STO Amount</TableHead>
                      <TableHead className="text-right">Pool (25%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolData.contributions.map(c => (
                      <TableRow key={c.userId}>
                        <TableCell className="font-medium">{c.traderName}</TableCell>
                        <TableCell className="text-right">${c.netProfit.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${c.stoAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          ${c.poolContribution.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3} className="text-right">Total Pool</TableCell>
                      <TableCell className="text-right text-primary">
                        ${poolData.totalPool.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
            {poolData.contributions.length > 0 && (
              <Button onClick={handleSavePoolLedger} className="w-full mt-4 gap-2">
                <Save className="h-4 w-4" /> Save Pool Ledger
              </Button>
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

            {/* Trainee List */}
            {trainees.length > 0 && poolData.totalPool > 0 && (
              <div className="mt-4 border rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Distribution to Trainees</p>
                {trainees.map(t => (
                  <div key={t.user_id} className="flex justify-between items-center text-sm">
                    <span>{t.full_name}</span>
                    <span className="font-medium text-green-600">${poolData.perTrainee.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {poolLedger && (
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border text-center">
                <Badge variant={poolLedger.is_distributed ? "default" : "secondary"}>
                  {poolLedger.is_distributed ? "Distributed" : "Pending Distribution"}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PoolView;
