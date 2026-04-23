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

interface PartnerShare {
  month: number;
  year: number;
  primary_user_id: string;
  primary_name: string;
  primary_sto_amount: number;
  share_percent: number;     // typically 50
  share_amount: number;      // primary_sto_amount * share_percent/100
  leave_deduction_percent: number; // partner's own
  leave_deduction_amount: number;
  final_amount: number;      // share_amount - leave_deduction_amount
  payout_due_date: string | null;
}

const PayoutSummary = () => {
  const { user } = useAuth();
  const [milestoneData, setMilestoneData] = useState<any>(null);
  const [stoHistory, setStoHistory] = useState<any[]>([]);
  const [ltoHistory, setLtoHistory] = useState<any[]>([]);
  const [partnerShares, setPartnerShares] = useState<PartnerShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [milestoneRes, stoRes, ltoRes, tradingDaysRes, partnerConfigsRes, ownConfigsRes] = await Promise.all([
      supabase.from("trader_milestones").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("sto_ledger").select("*").eq("user_id", user.id)
        .order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("lto_ledger").select("*").eq("user_id", user.id)
        .order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("trading_data").select("trade_date, user_id, trader2_id, trader2_role"),
      // Months where this user was the partner of some primary trader
      supabase.from("trader_config")
        .select("user_id, month, year, partner_percentage")
        .eq("partner_id", user.id),
      // This user's own configs (to read their leave_deduction via sto_ledger by month)
      supabase.from("trader_config").select("month, year").eq("user_id", user.id),
    ]);

    setMilestoneData(milestoneRes.data);
    setStoHistory(stoRes.data || []);
    setLtoHistory(ltoRes.data || []);
    // Count distinct trading days: as primary trader OR as partner
    const uniqueDays = new Set<string>();
    (tradingDaysRes.data || []).forEach((t: any) => {
      if (t.user_id === user.id) uniqueDays.add(t.trade_date);
      if (t.trader2_id === user.id && t.trader2_role?.toLowerCase() === "partner") uniqueDays.add(t.trade_date);
    });
    setTradingDaysCount(uniqueDays.size);

    // Build partner shares
    const partnerCfgs = partnerConfigsRes.data || [];
    if (partnerCfgs.length > 0) {
      const primaryIds = Array.from(new Set(partnerCfgs.map((c: any) => c.user_id)));
      const [primaryStoRes, primaryProfilesRes] = await Promise.all([
        supabase.from("sto_ledger")
          .select("user_id, month, year, sto_amount, payout_due_date")
          .in("user_id", primaryIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", primaryIds),
      ]);
      const ownStoMap = new Map<string, any>();
      (stoRes.data || []).forEach((s: any) => ownStoMap.set(`${s.year}-${s.month}`, s));
      const primaryStoMap = new Map<string, any>();
      (primaryStoRes.data || []).forEach((s: any) => primaryStoMap.set(`${s.user_id}-${s.year}-${s.month}`, s));
      const nameMap = new Map<string, string>();
      (primaryProfilesRes.data || []).forEach((p: any) => nameMap.set(p.user_id, p.full_name));

      const shares: PartnerShare[] = partnerCfgs.map((c: any) => {
        const primaryKey = `${c.user_id}-${c.year}-${c.month}`;
        const primaryStoRow = primaryStoMap.get(primaryKey);
        const primarySto = Number(primaryStoRow?.sto_amount || 0);
        const sharePct = Number(c.partner_percentage) > 0 ? Number(c.partner_percentage) : 50;
        const shareAmount = primarySto * (sharePct / 100);
        // Partner's own leave deduction % comes from their own sto_ledger row that month (if any)
        const ownStoRow = ownStoMap.get(`${c.year}-${c.month}`);
        const leavePct = Number(ownStoRow?.leave_deduction_percent || 0);
        const leaveAmt = shareAmount * (leavePct / 100);
        return {
          month: c.month,
          year: c.year,
          primary_user_id: c.user_id,
          primary_name: nameMap.get(c.user_id) || "Primary Trader",
          primary_sto_amount: primarySto,
          share_percent: sharePct,
          share_amount: shareAmount,
          leave_deduction_percent: leavePct,
          leave_deduction_amount: leaveAmt,
          final_amount: shareAmount - leaveAmt,
          payout_due_date: primaryStoRow?.payout_due_date || null,
        };
      }).filter(s => s.primary_sto_amount > 0)
        .sort((a, b) => (b.year - a.year) || (b.month - a.month));
      setPartnerShares(shares);
    } else {
      setPartnerShares([]);
    }

    setLoading(false);
  };

  const [tradingDaysCount, setTradingDaysCount] = useState(0);

  const milestone = useMemo(() => {
    if (!milestoneData) return MILESTONES[0];
    return getMilestoneLevel(tradingDaysCount, Number(milestoneData.cumulative_net_profit || 0));
  }, [milestoneData, tradingDaysCount]);

  const nextMilestone = useMemo(() => getNextMilestone(milestone.level), [milestone]);

  const partnerSharesPending = partnerShares.reduce((sum, p) => sum + p.final_amount, 0);
  const totalStoPending = stoHistory.filter(s => !s.is_paid).reduce((sum, s) => sum + Number(s.final_sto_amount), 0) + partnerSharesPending;
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
                <p className="text-xs text-muted-foreground">STO {milestone.stoPercent}%</p>
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
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Worked</p>
                <p className="text-xl font-bold text-foreground">{tradingDaysCount} days</p>
                <p className="text-xs text-muted-foreground">
                  Cumulative Profit: {fmt(Number(milestoneData?.cumulative_net_profit || 0))}
                </p>
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
              Next level unlocks STO {nextMilestone.stoPercent}% — whichever milestone is reached first (days or profit)
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

      {/* Partner Shares (joint-session payouts) */}
      {partnerShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Partner Share Payouts
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Your share from joint sessions where you partnered with another trader. You receive {partnerShares[0]?.share_percent || 50}% of their STO, with your own leave deductions applied.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Period</th>
                    <th className="text-left p-3">Primary Trader</th>
                    <th className="text-right p-3">Primary STO</th>
                    <th className="text-right p-3">Your Share %</th>
                    <th className="text-right p-3">Your Share</th>
                    <th className="text-right p-3">Leave Deduction</th>
                    <th className="text-right p-3">Final</th>
                    <th className="text-right p-3">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerShares.map((p) => (
                    <tr key={`${p.primary_user_id}-${p.year}-${p.month}`} className="border-t">
                      <td className="p-3 font-medium">{MONTHS[(p.month || 1) - 1]} {p.year}</td>
                      <td className="p-3">{p.primary_name}</td>
                      <td className="p-3 text-right">{fmt(p.primary_sto_amount)}</td>
                      <td className="p-3 text-right">{p.share_percent}%</td>
                      <td className="p-3 text-right">{fmt(p.share_amount)}</td>
                      <td className="p-3 text-right text-red-600">
                        {p.leave_deduction_amount > 0 ? `-${fmt(p.leave_deduction_amount)} (${p.leave_deduction_percent}%)` : "-"}
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(p.final_amount)}</td>
                      <td className="p-3 text-right text-muted-foreground">{p.payout_due_date || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LTO History moved to its own "LTO" tab */}

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

      {stoHistory.length === 0 && ltoHistory.length === 0 && partnerShares.length === 0 && !milestoneData && (
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
