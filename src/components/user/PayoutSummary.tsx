import { useState, useEffect, useMemo } from "react";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useTraderHistory } from "@/hooks/useTraderHistory";
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

/** Records saved from this date use the new payout engine (own STO per partner). */
const NEW_PAYOUT_RULES_FROM = "2026-11-23";

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

    const [milestoneRes, stoRes, ltoRes, partnerSessionsRes] = await Promise.all([
      supabase.from("trader_milestones").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("sto_ledger").select("*").eq("user_id", user.id)
        .order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("lto_ledger").select("*").eq("user_id", user.id)
        .order("year", { ascending: false }).order("month", { ascending: false }),
      // Sessions where THIS user sat as the partner (trader2) on someone else's account
      fetchAllRows<any>((f, t) =>
        supabase.from("trading_data").select("id, trade_date, user_id, trader2_id, trader2_role")
          .eq("trader2_id", user.id).order("trade_date").order("id").range(f, t))
        .then((data) => ({ data })),
    ]);


    setMilestoneData(milestoneRes.data);
    setStoHistory(stoRes.data || []);
    setLtoHistory(ltoRes.data || []);

    // ---- Build partner shares from actual joint sessions ----
    // Group partner sessions by primary user + month/year, counting days sat together.
    type Bucket = { primaryId: string; month: number; year: number; daysWithPartner: number };
    const bucketMap = new Map<string, Bucket>();
    (partnerSessionsRes.data || []).forEach((t: any) => {
      if ((t.trader2_role || "").toLowerCase() !== "partner") return;
      const d = new Date(t.trade_date);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      const key = `${t.user_id}-${y}-${m}`;
      const b = bucketMap.get(key) || { primaryId: t.user_id, month: m, year: y, daysWithPartner: 0 };
      b.daysWithPartner += 1;
      bucketMap.set(key, b);
    });

    if (bucketMap.size > 0) {
      const buckets = Array.from(bucketMap.values());
      const primaryIds = Array.from(new Set(buckets.map(b => b.primaryId)));
      const monthYearPairs = Array.from(new Set(buckets.map(b => `${b.year}-${b.month}`)));

      // Fetch primary STO ledgers, primary names, primary trading_data counts (to compute day ratio),
      // and the partner's own STO ledger rows (for their leave deduction %).
      const [primaryStoRes, primaryProfilesRes, primaryAllTradesRes] = await Promise.all([
        supabase.from("sto_ledger")
          .select("user_id, month, year, sto_amount, payout_due_date, updated_at")
          .in("user_id", primaryIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", primaryIds),
        supabase.from("trading_data")
          .select("trade_date, user_id, is_holiday")
          .in("user_id", primaryIds),
      ]);

      const primaryStoMap = new Map<string, any>();
      (primaryStoRes.data || []).forEach((s: any) =>
        primaryStoMap.set(`${s.user_id}-${s.year}-${s.month}`, s));
      const nameMap = new Map<string, string>();
      (primaryProfilesRes.data || []).forEach((p: any) => nameMap.set(p.user_id, p.full_name));

      // Count primary's total trading days per month (excluding holidays) for day ratio
      const primaryDaysMap = new Map<string, number>();
      (primaryAllTradesRes.data || []).forEach((t: any) => {
        if (t.is_holiday) return;
        const d = new Date(t.trade_date);
        const k = `${t.user_id}-${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
        primaryDaysMap.set(k, (primaryDaysMap.get(k) || 0) + 1);
      });

      // Partner's own leave deduction % per month (from their own sto_ledger if it exists)
      const ownStoMap = new Map<string, any>();
      (stoRes.data || []).forEach((s: any) => ownStoMap.set(`${s.year}-${s.month}`, s));

      const shares: PartnerShare[] = buckets.map((b) => {
        const primaryKey = `${b.primaryId}-${b.year}-${b.month}`;
        const primaryStoRow = primaryStoMap.get(primaryKey);
        const primarySto = Number(primaryStoRow?.sto_amount || 0);
        const primaryDays = primaryDaysMap.get(primaryKey) || b.daysWithPartner;
        const dayRatio = primaryDays > 0 ? Math.min(1, b.daysWithPartner / primaryDays) : 1;

        // Partner gets 50% of the STO proportional to days sat together
        const proportionalPrimarySto = primarySto * dayRatio;
        const sharePct = 50;
        const shareAmount = proportionalPrimarySto * (sharePct / 100);

        // Partner's own leave deduction %
        const ownStoRow = ownStoMap.get(`${b.year}-${b.month}`);
        const leavePct = Number(ownStoRow?.leave_deduction_percent || 0);
        const leaveAmt = shareAmount * (leavePct / 100);

        return {
          month: b.month,
          year: b.year,
          primary_user_id: b.primaryId,
          primary_name: nameMap.get(b.primaryId) || "Primary Trader",
          primary_sto_amount: proportionalPrimarySto,
          share_percent: sharePct,
          share_amount: shareAmount,
          leave_deduction_percent: leavePct,
          leave_deduction_amount: leaveAmt,
          final_amount: shareAmount - leaveAmt,
          payout_due_date: primaryStoRow?.payout_due_date || null,
        };
      })
      // Under the new rules each partner has their own STO record, so only
      // months last saved with the old formula still need a derived share.
      .filter((s) => {
        const primaryRow = primaryStoMap.get(`${s.primary_user_id}-${s.year}-${s.month}`);
        const ownRow = ownStoMap.get(`${s.year}-${s.month}`);
        const primaryIsOld = primaryRow && String(primaryRow.updated_at) < NEW_PAYOUT_RULES_FROM;
        const ownIsNew = ownRow && String(ownRow.updated_at) >= NEW_PAYOUT_RULES_FROM;
        return s.share_amount > 0 && primaryIsOld && !ownIsNew;
      })
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
      setPartnerShares(shares);
    } else {
      setPartnerShares([]);
    }

    setLoading(false);
  };

  // Level, trading days and cumulative net profit come from the shared payout
  // engine (partner days split 50/50, costs, baseline, days-OR-profit rule).
  const { history } = useTraderHistory(user?.id);
  const tradingDaysCount = history?.totalDays ?? 0;
  const cumulativeProfit = history?.totalProfit ?? 0;

  const milestone = useMemo(() => {
    if (!history) return MILESTONES[0];
    return getMilestoneLevel(history.totalDays, history.totalProfit);
  }, [history]);

  const nextMilestone = useMemo(() => getNextMilestone(milestone.level), [milestone]);

  const partnerSharesPending = partnerShares.reduce((sum, p) => sum + p.final_amount, 0);
  const totalStoPending = stoHistory.filter(s => !s.is_paid).reduce((sum, s) => sum + Number(s.final_sto_amount), 0) + partnerSharesPending;
  const totalLtoLocked = ltoHistory.filter(l => !l.is_released).reduce((sum, l) => sum + Number(l.lto_amount), 0);
  const totalLtoUnlocked = ltoHistory.filter(l => !l.is_released && new Date(l.unlock_date) <= new Date())
    .reduce((sum, l) => sum + Number(l.lto_amount), 0);

  const fmt = (val: number) => formatCurrencyINR(val);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer h-32 rounded-lg" />)}</div>;
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
                  Cumulative Profit: {fmt(cumulativeProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone Progress */}
      {nextMilestone && history && (
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
                <span className="font-medium">{fmt(cumulativeProfit)} / {fmt(nextMilestone.profitRequired)}</span>
              </div>
              <Progress
                value={Math.max(0, Math.min(100, (cumulativeProfit / nextMilestone.profitRequired) * 100))}
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
            <div className="-mx-6 px-6 overflow-x-auto">
              <div className="border rounded-lg overflow-hidden min-w-[820px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 whitespace-nowrap">Period</th>
                      <th className="text-right p-3 whitespace-nowrap">Net Profit</th>
                      <th className="text-right p-3 whitespace-nowrap">STO %</th>
                      <th className="text-right p-3 whitespace-nowrap">STO Amount</th>
                      <th className="text-right p-3 whitespace-nowrap">Partner Share</th>
                      <th className="text-right p-3 whitespace-nowrap">Leave / Pool</th>
                      <th className="text-right p-3 whitespace-nowrap">Final STO</th>
                      <th className="text-right p-3 whitespace-nowrap">Due Date</th>
                      <th className="text-center p-3 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stoHistory.map((s: any) => {
                      const sto = Number(s.sto_amount);
                      const leave = Number(s.leave_deduction_amount);
                      const pool = Number(s.trainee_pool_contribution);
                      const final = Number(s.final_sto_amount);
                      // Partner share is whatever else was subtracted to reach final
                      const partnerShare = Math.max(0, sto - leave - pool - final);
                      const otherDeductions = leave + pool;
                      return (
                      <tr key={s.id} className="border-t">
                        <td className="p-3 font-medium whitespace-nowrap">{MONTHS[(s.month || 1) - 1]} {s.year}</td>
                        <td className={`p-3 text-right whitespace-nowrap ${Number(s.net_profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmt(Number(s.net_profit))}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">{s.sto_percentage}%</td>
                        <td className="p-3 text-right whitespace-nowrap">{fmt(sto)}</td>
                        <td className="p-3 text-right text-red-600 whitespace-nowrap">
                          {partnerShare > 0.01 ? `-${fmt(partnerShare)}` : "-"}
                        </td>
                        <td className="p-3 text-right text-red-600 whitespace-nowrap">
                          {otherDeductions > 0.01 ? `-${fmt(otherDeductions)}` : "-"}
                        </td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">{fmt(final)}</td>
                        <td className="p-3 text-right text-muted-foreground whitespace-nowrap">{s.payout_due_date}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <Badge variant={s.is_paid ? "default" : "secondary"} className="text-xs">
                            {s.is_paid ? "Paid" : "Pending"}
                          </Badge>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
            <div className="-mx-6 px-6 overflow-x-auto">
              <div className="border rounded-lg overflow-hidden min-w-[820px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 whitespace-nowrap">Period</th>
                      <th className="text-left p-3 whitespace-nowrap">Primary Trader</th>
                      <th className="text-right p-3 whitespace-nowrap">Primary STO</th>
                      <th className="text-right p-3 whitespace-nowrap">Your Share %</th>
                      <th className="text-right p-3 whitespace-nowrap">Your Share</th>
                      <th className="text-right p-3 whitespace-nowrap">Leave Deduction</th>
                      <th className="text-right p-3 whitespace-nowrap">Final</th>
                      <th className="text-right p-3 whitespace-nowrap">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerShares.map((p) => (
                      <tr key={`${p.primary_user_id}-${p.year}-${p.month}`} className="border-t">
                        <td className="p-3 font-medium whitespace-nowrap">{MONTHS[(p.month || 1) - 1]} {p.year}</td>
                        <td className="p-3 whitespace-nowrap">{p.primary_name}</td>
                        <td className="p-3 text-right whitespace-nowrap">{fmt(p.primary_sto_amount)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{p.share_percent}%</td>
                        <td className="p-3 text-right whitespace-nowrap">{fmt(p.share_amount)}</td>
                        <td className="p-3 text-right text-red-600 whitespace-nowrap">
                          {p.leave_deduction_amount > 0 ? `-${fmt(p.leave_deduction_amount)} (${p.leave_deduction_percent}%)` : "-"}
                        </td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">{fmt(p.final_amount)}</td>
                        <td className="p-3 text-right text-muted-foreground whitespace-nowrap">{p.payout_due_date || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                <div className="text-sm text-muted-foreground flex items-center gap-3">
                  <span>STO {m.stoPercent}%</span>
                  <span>LTO {m.ltoPercent}%</span>
                  <span className="font-medium text-foreground">Total {m.stoPercent + m.ltoPercent}%</span>
                  {m.level > 0 && (
                    <span>
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
