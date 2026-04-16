import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Clock, Lock, Unlock, Target } from "lucide-react";
import { formatIndian, formatCurrencyINR } from "@/lib/utils";
import {
  MILESTONES,
  getMilestoneLevel,
  getNextMilestone,
} from "@/lib/payoutCalculations";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PayoutSummary = () => {
  const { user } = useAuth();
  const [milestoneData, setMilestoneData] = useState<any>(null);
  const [stoHistory, setStoHistory] = useState<any[]>([]);
  const [ltoHistory, setLtoHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [milestoneRes, stoRes, ltoRes] = await Promise.all([
      supabase.from("trader_milestones").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("sto_ledger").select("*").eq("user_id", user.id)
        .order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("lto_ledger").select("*").eq("user_id", user.id)
        .order("year", { ascending: false }).order("month", { ascending: false }),
    ]);

    setMilestoneData(milestoneRes.data);
    setStoHistory(stoRes.data || []);
    setLtoHistory(ltoRes.data || []);
    setLoading(false);
  };

  const [tradingDaysCount, setTradingDaysCount] = useState(0);

  const milestone = useMemo(() => {
    if (!milestoneData) return MILESTONES[0];
    return getMilestoneLevel(tradingDaysCount, Number(milestoneData.cumulative_net_profit || 0));
  }, [milestoneData, tradingDaysCount]);

  const nextMilestone = useMemo(() => getNextMilestone(milestone.level), [milestone]);

  const totalStoPending = stoHistory.filter(s => !s.is_paid).reduce((sum, s) => sum + Number(s.final_sto_amount), 0);
  const totalLtoLocked = ltoHistory.filter(l => !l.is_released).reduce((sum, l) => sum + Number(l.lto_amount), 0);
  const totalLtoUnlocked = ltoHistory.filter(l => !l.is_released && new Date(l.unlock_date) <= new Date())
    .reduce((sum, l) => sum + Number(l.lto_amount), 0);

  const fmt = (val: number) => formatCurrencyINR(val);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Level & Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Level</p>
                <p className="text-xl font-bold text-foreground">{milestone.label}</p>
                <p className="text-xs text-muted-foreground">STO {milestone.stoPercent}% / LTO {milestone.ltoPercent}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">STO Pending</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalStoPending)}</p>
                <p className="text-xs text-muted-foreground">{stoHistory.filter(s => !s.is_paid).length} months pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LTO Locked</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalLtoLocked)}</p>
                {totalLtoUnlocked > 0 && (
                  <p className="text-xs text-green-600 font-medium">{fmt(totalLtoUnlocked)} ready to release</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone Progress */}
      {nextMilestone && milestoneData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Progress to {nextMilestone.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Cumulative Profit</span>
                <span className="font-medium">{fmt(Number(milestoneData.cumulative_net_profit))} / {fmt(nextMilestone.profitRequired)}</span>
              </div>
              <Progress
                value={Math.min(100, (Number(milestoneData.cumulative_net_profit) / nextMilestone.profitRequired) * 100)}
                className="h-2"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Trading Days</span>
                <span className="font-medium">
                  {tradingDaysCount} days / {nextMilestone.daysRequired} days
                </span>
              </div>
              <Progress
                value={Math.min(100, (tradingDaysCount / nextMilestone.daysRequired) * 100)}
                className="h-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Next level unlocks STO {nextMilestone.stoPercent}% / LTO {nextMilestone.ltoPercent}% — whichever milestone is reached first (days or profit)
            </p>
          </CardContent>
        </Card>
      )}

      {/* STO Schedule */}
      {stoHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> STO Payout Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Period</th>
                    <th className="text-right p-3">Net Profit</th>
                    <th className="text-right p-3">STO %</th>
                    <th className="text-right p-3">STO Amount</th>
                    <th className="text-right p-3">Deductions</th>
                    <th className="text-right p-3">Final STO</th>
                    <th className="text-right p-3">Due Date</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stoHistory.map((s: any) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-3 font-medium">{MONTHS[(s.month || 1) - 1]} {s.year}</td>
                      <td className={`p-3 text-right ${Number(s.net_profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(Number(s.net_profit))}
                      </td>
                      <td className="p-3 text-right">{s.sto_percentage}%</td>
                      <td className="p-3 text-right">{fmt(Number(s.sto_amount))}</td>
                      <td className="p-3 text-right text-red-600">
                        {Number(s.leave_deduction_amount) + Number(s.trainee_pool_contribution) > 0
                          ? `-${fmt(Number(s.leave_deduction_amount) + Number(s.trainee_pool_contribution))}`
                          : "-"}
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(Number(s.final_sto_amount))}</td>
                      <td className="p-3 text-right text-muted-foreground">{s.payout_due_date}</td>
                      <td className="p-3 text-center">
                        <Badge variant={s.is_paid ? "default" : "secondary"} className="text-xs">
                          {s.is_paid ? "Paid" : "Pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LTO History */}
      {ltoHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> LTO Lock Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Period</th>
                    <th className="text-right p-3">LTO %</th>
                    <th className="text-right p-3">LTO Amount</th>
                    <th className="text-right p-3">Unlock Date</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ltoHistory.map((l: any) => {
                    const isUnlocked = new Date(l.unlock_date) <= new Date();
                    return (
                      <tr key={l.id} className="border-t">
                        <td className="p-3 font-medium">{MONTHS[(l.month || 1) - 1]} {l.year}</td>
                        <td className="p-3 text-right">{l.lto_percentage}%</td>
                        <td className="p-3 text-right font-medium">{fmt(Number(l.lto_amount))}</td>
                        <td className="p-3 text-right text-muted-foreground">{l.unlock_date}</td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={l.is_released ? "default" : isUnlocked ? "outline" : "secondary"}
                            className="text-xs gap-1"
                          >
                            {l.is_released ? <><Unlock className="h-3 w-3" /> Released</> :
                              isUnlocked ? <><Unlock className="h-3 w-3" /> Unlocked</> :
                                <><Lock className="h-3 w-3" /> Locked</>}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestone History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Percentage Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MILESTONES.map((m) => (
              <div
                key={m.level}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  milestone.level === m.level ? "border-primary bg-primary/5" : "bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {milestone.level === m.level && <Badge variant="default" className="text-xs">Current</Badge>}
                  <span className="font-medium">{m.label}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  STO {m.stoPercent}% / LTO {m.ltoPercent}%
                  {m.level > 0 && (
                    <span className="ml-2">
                      ({m.daysRequired} days or {`$${formatIndian(m.profitRequired)}`})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {stoHistory.length === 0 && ltoHistory.length === 0 && !milestoneData && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No payout data available yet. Your admin will set up your payout structure.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayoutSummary;
