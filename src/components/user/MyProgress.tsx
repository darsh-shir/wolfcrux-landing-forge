import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Calendar, DollarSign, Trophy, Target } from "lucide-react";
import { formatIndian } from "@/lib/utils";
import { MILESTONES, getNextMilestone } from "@/lib/payoutCalculations";
import { useTraderHistory } from "@/hooks/useTraderHistory";

/**
 * Trader-facing progress view, calculated with the shared payout engine
 * (src/lib/payoutEngine.ts) so it always matches the admin screens.
 */

interface Snap {
  tradingDays: number;
  totalPnl: number;
  baselineDays: number;
  baselineProfit: number;
  storedLevel: number;          // confirmed level from trader_milestones
  eligibleLevel: number;        // computed from days/profit
  eligibleLabel: string;
  stoPercent: number;
  ltoPercent: number;
  since: string | null;  // YYYY-MM the current level/% started (admin level history)
}

const MyProgress = () => {
  const { user } = useAuth();
  // Same engine as the admin Payout Sheet: partner days split 50/50, share
  // and software costs, baseline, and the days-OR-profit level rule.
  const { history, loading: historyLoading } = useTraderHistory(user?.id);
  const [storedLevel, setStoredLevel] = useState<number | null>(null);
  const [baselineInfo, setBaselineInfo] = useState({ days: 0, profit: 0 });

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      supabase.from("trader_milestones").select("current_level").eq("user_id", user.id).maybeSingle(),
      supabase.from("trader_baselines" as any).select("baseline_days, baseline_net_profit").eq("user_id", user.id).maybeSingle(),
    ]).then(([m, b]) => {
      setStoredLevel(m.data?.current_level ?? null);
      const bd = (b as any).data;
      setBaselineInfo({ days: Number(bd?.baseline_days || 0), profit: Number(bd?.baseline_net_profit || 0) });
    });
  }, [user]);

  const loading = historyLoading;
  const snap: Snap | null = history
    ? {
        tradingDays: history.totalDays,
        totalPnl: history.totalProfit,
        baselineDays: baselineInfo.days,
        baselineProfit: baselineInfo.profit,
        storedLevel: storedLevel ?? history.currentLevel.level,
        eligibleLevel: history.currentLevel.level,
        eligibleLabel: history.currentLevel.label,
        stoPercent: history.currentStoPercent,
        ltoPercent: history.currentLtoPercent,
        since: history.levelSince,
      }
    : null;

  if (loading || !snap) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // The level in force (set by the admin, or worked out from days/profit).
  const currentMilestone = MILESTONES[snap.eligibleLevel] || MILESTONES[0];
  const sinceMonths = snap.since
    ? (() => {
        const [y, m] = snap.since.split("-").map(Number);
        const now = new Date();
        return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1;
      })()
    : null;
  const next = getNextMilestone(snap.eligibleLevel);
  const daysProgress = next ? Math.min(100, (snap.tradingDays / next.daysRequired) * 100) : 100;
  const profitProgress = next
    ? Math.min(100, (Math.max(0, snap.totalPnl) / next.profitRequired) * 100)
    : 100;
  const pendingPromotion = !snap.since && snap.eligibleLevel > snap.storedLevel;
  const storedMilestone = MILESTONES[snap.storedLevel] || MILESTONES[0];

  return (
    <div className="space-y-6">
      {/* Current Level — mirrors admin "Current Level" column */}
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
              <p className="text-sm text-muted-foreground">{snap.since ? "Your level" : "You qualify as"}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={snap.eligibleLevel > 0 ? "default" : "secondary"} className="text-sm px-3 py-1">
                  {currentMilestone.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  STO {snap.stoPercent}% • LTO {snap.ltoPercent}%
                </span>
              </div>
              {snap.since && sinceMonths !== null && (
                <p className="text-xs text-muted-foreground mt-2">
                  On this % since {new Date(`${snap.since}-01T12:00:00`).toLocaleString("en-GB", { month: "long", year: "numeric" })} ({sinceMonths} month{sinceMonths === 1 ? "" : "s"})
                </p>
              )}
              {pendingPromotion && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Promotion pending admin review (currently active: {storedMilestone.label})
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats — mirrors Trading Days + Total P&L columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trading Days</p>
                <p className="text-2xl font-bold text-foreground">{snap.tradingDays}</p>
                {snap.baselineDays > 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    incl. {snap.baselineDays} baseline
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
                <p className="text-sm text-muted-foreground">Total Net P&L</p>
                <p
                  className={`text-2xl font-bold ${
                    snap.totalPnl >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {snap.totalPnl >= 0 ? "+" : "-"}${formatIndian(Math.abs(snap.totalPnl))}
                </p>
                {snap.baselineProfit !== 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    incl. ${formatIndian(snap.baselineProfit)} baseline
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress to next level — mirrors Days/Profit progress columns */}
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

      {/* Milestone Thresholds — same legend as admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Milestone Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {MILESTONES.map((m) => {
              const isCurrent = m.level === snap.eligibleLevel;
              return (
                <div
                  key={m.level}
                  className={`p-3 rounded-lg border ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border bg-muted/30"
                  }`}
                >
                  <p className="font-semibold text-foreground text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    STO {m.stoPercent}% / LTO {m.ltoPercent}%
                  </p>
                  {m.level > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {m.daysRequired} days or ${formatIndian(m.profitRequired)}
                    </p>
                  )}
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
