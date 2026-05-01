import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Calendar, DollarSign, Trophy, Target } from "lucide-react";
import { formatIndian } from "@/lib/utils";
import { MILESTONES, getMilestoneLevel, getNextMilestone } from "@/lib/payoutCalculations";

interface ProgressSnapshot {
  tradingDays: number;
  totalPnl: number;
  baselineDays: number;
  baselineProfit: number;
  storedLevel: number;
  eligibleLevel: number;
}

const DEFAULT_SOFTWARE_COST = 1000;

const MyProgress = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<ProgressSnapshot | null>(null);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [ownTradesRes, partnerTradesRes, baselineRes, milestoneRes, configRes] = await Promise.all([
      supabase
        .from("trading_data")
        .select("trade_date, net_pnl, shares_traded")
        .eq("user_id", user.id),
      supabase
        .from("trading_data")
        .select("trade_date, net_pnl, shares_traded")
        .eq("trader2_id", user.id)
        .eq("trader2_role", "partner"),
      supabase
        .from("trader_baselines" as any)
        .select("baseline_days, baseline_net_profit, baseline_level, as_of_date")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("trader_milestones")
        .select("current_level")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("trader_config")
        .select("month, year, software_cost")
        .eq("user_id", user.id),
    ]);

    const baseline = baselineRes.data as any;
    const asOf: string | null = baseline?.as_of_date || null;
    const baselineDays = Number(baseline?.baseline_days || 0);
    const baselineProfit = Number(baseline?.baseline_net_profit || 0);

    const swCost = new Map<string, number>();
    (configRes.data || []).forEach((c: any) => {
      swCost.set(`${c.year}-${c.month}`, Number(c.software_cost) || 0);
    });

    const allTrades = [...(ownTradesRes.data || []), ...(partnerTradesRes.data || [])]
      .filter((t: any) => !asOf || t.trade_date >= asOf);

    const dayKeys = new Set<string>();
    const monthKeys = new Set<string>();
    let gross = 0;
    let shares = 0;
    allTrades.forEach((t: any) => {
      dayKeys.add(t.trade_date);
      const d = new Date(t.trade_date);
      monthKeys.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
      gross += Number(t.net_pnl || 0);
      shares += Number(t.shares_traded || 0);
    });

    const brokerage = (shares / 1000) * 14;
    let software = 0;
    monthKeys.forEach((k) => {
      software += swCost.has(k) ? (swCost.get(k) as number) : DEFAULT_SOFTWARE_COST;
    });

    const realPnl = gross - brokerage - software;
    const tradingDays = dayKeys.size + baselineDays;
    const totalPnl = realPnl + baselineProfit;

    const eligible = getMilestoneLevel(tradingDays, totalPnl);
    const stored = milestoneRes.data?.current_level ?? baseline?.baseline_level ?? 0;

    setSnap({
      tradingDays,
      totalPnl,
      baselineDays,
      baselineProfit,
      storedLevel: stored,
      eligibleLevel: eligible.level,
    });
    setLoading(false);
  };

  if (loading || !snap) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const current = MILESTONES[snap.storedLevel] || MILESTONES[0];
  const next = getNextMilestone(snap.storedLevel);
  const daysProgress = next ? Math.min(100, (snap.tradingDays / next.daysRequired) * 100) : 100;
  const profitProgress = next
    ? Math.min(100, (Math.max(0, snap.totalPnl) / next.profitRequired) * 100)
    : 100;
  const pendingPromotion = snap.eligibleLevel > snap.storedLevel;

  return (
    <div className="space-y-6">
      {/* Current Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Current Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">You are currently</p>
              <p className="text-2xl font-bold text-foreground">{current.label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Level {current.level} • STO {current.stoPercent}% • LTO {current.ltoPercent}%
              </p>
            </div>
            {pendingPromotion && (
              <Badge variant="default" className="text-xs px-3 py-1">
                Promotion pending admin review
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Trading Days</p>
                <p className="text-2xl font-bold text-foreground">{snap.tradingDays}</p>
                {snap.baselineDays > 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    incl. {snap.baselineDays} historical
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cumulative Net P&L</p>
                <p
                  className={`text-2xl font-bold ${
                    snap.totalPnl >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  ${formatIndian(Math.abs(snap.totalPnl))}
                </p>
                {snap.baselineProfit > 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    incl. ${formatIndian(snap.baselineProfit)} historical
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress to next level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Progress to Next Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          {next ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">Next milestone</p>
                <p className="text-lg font-semibold text-foreground">
                  {next.label}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (STO {next.stoPercent}% • LTO {next.ltoPercent}%)
                  </span>
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Trading Days</span>
                  <span className="font-medium text-foreground">
                    {snap.tradingDays} / {next.daysRequired}
                  </span>
                </div>
                <Progress value={daysProgress} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Cumulative Net Profit</span>
                  <span className="font-medium text-foreground">
                    ${formatIndian(Math.max(0, snap.totalPnl))} / ${formatIndian(next.profitRequired)}
                  </span>
                </div>
                <Progress value={profitProgress} className="h-2" />
              </div>

              <p className="text-xs text-muted-foreground italic">
                Either threshold (days OR profit) qualifies you for promotion.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-foreground">
                You've reached the highest level. Keep crushing it! 🚀
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Levels Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Career Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MILESTONES.map((m) => {
              const isCurrent = m.level === snap.storedLevel;
              const isPassed = m.level < snap.storedLevel;
              return (
                <div
                  key={m.level}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : isPassed
                      ? "border-border bg-muted/30 opacity-70"
                      : "border-border"
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      L{m.level} — {m.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.daysRequired === 0
                        ? "Starting level"
                        : `${m.daysRequired} days OR $${formatIndian(m.profitRequired)} profit`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-foreground">
                      STO {m.stoPercent}%
                    </p>
                    <p className="text-xs text-muted-foreground">LTO {m.ltoPercent}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyProgress;
