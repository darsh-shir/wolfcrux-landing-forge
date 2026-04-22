import { useEffect, useState } from "react";
import { TrendingUp, CheckCircle, XCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMilestoneLevel, getNextMilestone, MILESTONES } from "@/lib/payoutCalculations";
import { Progress } from "@/components/ui/progress";
import { formatIndian } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface MilestoneAlert {
  milestoneId: string;
  userId: string;
  full_name: string;
  trader_number: string | null;
  currentLevel: number;
  newLevel: number;
  newLabel: string;
  stoPercent: number;
  ltoPercent: number;
  trigger: "time" | "profit" | "both";
  tradingDays: number;
  cumulativeProfit: number;
}

interface UpcomingTrader {
  userId: string;
  full_name: string;
  trader_number: string | null;
  currentLabel: string;
  nextLabel: string;
  tradingDays: number;
  cumulativeProfit: number;
  daysRequired: number;
  profitRequired: number;
  daysProgress: number;
  profitProgress: number;
  bestProgress: number;
  closestBy: "days" | "profit";
}

const MilestoneNotification = () => {
  const { user, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState<MilestoneAlert[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTrader[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isAdmin) return;
    evaluateMilestones();
  }, [user, isAdmin]);

  const fetchAllTradingData = async () => {
    const allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("trading_data")
        .select("user_id, trade_date, trader2_id, trader2_role, net_pnl")
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allData;
  };

  const evaluateMilestones = async () => {
    const [profilesRes, milestonesRes, tradingData] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, trader_number"),
      supabase.from("trader_milestones").select("*"),
      fetchAllTradingData(),
    ]);

    const profiles = profilesRes.data || [];
    const milestones = milestonesRes.data || [];

    // Count distinct trading days per user
    const tradingDaysMap: Record<string, Set<string>> = {};
    const totalPnlMap: Record<string, number> = {};

    tradingData.forEach((t) => {
      if (!tradingDaysMap[t.user_id]) tradingDaysMap[t.user_id] = new Set();
      tradingDaysMap[t.user_id].add(t.trade_date);
      totalPnlMap[t.user_id] = (totalPnlMap[t.user_id] || 0) + Number(t.net_pnl);

      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") {
        if (!tradingDaysMap[t.trader2_id]) tradingDaysMap[t.trader2_id] = new Set();
        tradingDaysMap[t.trader2_id].add(t.trade_date);
        totalPnlMap[t.trader2_id] = (totalPnlMap[t.trader2_id] || 0) + Number(t.net_pnl);
      }
    });

    const newAlerts: MilestoneAlert[] = [];
    const upcomingList: UpcomingTrader[] = [];

    for (const ms of milestones) {
      const profile = profiles.find((p) => p.user_id === ms.user_id);
      if (!profile) continue;

      const tradingDays = tradingDaysMap[ms.user_id]?.size || 0;
      const cumulativeProfit = Number(ms.cumulative_net_profit || 0);
      const computed = getMilestoneLevel(tradingDays, cumulativeProfit);

      if (computed.level > ms.current_level) {
        const target = MILESTONES[computed.level];
        const daysMet = tradingDays >= target.daysRequired;
        const profitMet = cumulativeProfit >= target.profitRequired;

        newAlerts.push({
          milestoneId: ms.id,
          userId: ms.user_id,
          full_name: profile.full_name,
          trader_number: profile.trader_number,
          currentLevel: ms.current_level,
          newLevel: computed.level,
          newLabel: computed.label,
          stoPercent: computed.stoPercent,
          ltoPercent: computed.ltoPercent,
          trigger: daysMet && profitMet ? "both" : daysMet ? "time" : "profit",
          tradingDays,
          cumulativeProfit,
        });
      } else {
        // Build upcoming list — traders close to next level
        const next = getNextMilestone(computed.level);
        if (next) {
          const daysProgress = Math.min(100, (tradingDays / next.daysRequired) * 100);
          const profitProgress = Math.min(100, (cumulativeProfit / next.profitRequired) * 100);
          const bestProgress = Math.max(daysProgress, profitProgress);
          upcomingList.push({
            userId: ms.user_id,
            full_name: profile.full_name,
            trader_number: profile.trader_number,
            currentLabel: computed.label,
            nextLabel: next.label,
            tradingDays,
            cumulativeProfit,
            daysRequired: next.daysRequired,
            profitRequired: next.profitRequired,
            daysProgress,
            profitProgress,
            bestProgress,
            closestBy: daysProgress >= profitProgress ? "days" : "profit",
          });
        }
      }
    }

    upcomingList.sort((a, b) => b.bestProgress - a.bestProgress);
    setAlerts(newAlerts);
    setUpcoming(upcomingList.slice(0, 3));
  };

  const handleUpgrade = async (alert: MilestoneAlert) => {
    setProcessing(alert.milestoneId);
    try {
      // Update milestone record
      await supabase.from("trader_milestones")
        .update({ current_level: alert.newLevel, last_evaluated_at: new Date().toISOString() })
        .eq("id", alert.milestoneId);

      // Update trader_config for next month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      let nextMonth = currentMonth + 1;
      let nextYear = currentYear;
      if (nextMonth > 12) { nextMonth = 1; nextYear++; }

      const newPayload = {
        sto_percentage: alert.stoPercent,
        lto_percentage: alert.ltoPercent,
        payout_percentage: alert.stoPercent + alert.ltoPercent,
        config_mode: "milestone",
      };

      const { data: nextConfig } = await supabase
        .from("trader_config")
        .select("id")
        .eq("user_id", alert.userId)
        .eq("month", nextMonth)
        .eq("year", nextYear)
        .maybeSingle();

      if (nextConfig?.id) {
        await supabase.from("trader_config").update(newPayload).eq("id", nextConfig.id);
      } else {
        const { data: latestCfg } = await supabase
          .from("trader_config")
          .select("*")
          .eq("user_id", alert.userId)
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase.from("trader_config").insert({
          user_id: alert.userId,
          month: nextMonth,
          year: nextYear,
          software_cost: latestCfg?.software_cost ?? 0,
          ...newPayload,
        });
      }

      // Update future milestone configs
      const { data: futureConfigs } = await supabase
        .from("trader_config")
        .select("id")
        .eq("user_id", alert.userId)
        .eq("config_mode", "milestone")
        .or(`year.gt.${nextYear},and(year.eq.${nextYear},month.gt.${nextMonth})`);

      if (futureConfigs) {
        for (const fc of futureConfigs) {
          await supabase.from("trader_config").update({
            sto_percentage: alert.stoPercent,
            lto_percentage: alert.ltoPercent,
            payout_percentage: alert.stoPercent + alert.ltoPercent,
          }).eq("id", fc.id);
        }
      }

      toast.success(`${alert.full_name} upgraded to ${alert.newLabel}!`);
      setAlerts((prev) => prev.filter((a) => a.milestoneId !== alert.milestoneId));
    } catch (err) {
      toast.error("Failed to upgrade milestone");
    } finally {
      setProcessing(null);
    }
  };

  const handleDismiss = (milestoneId: string) => {
    setAlerts((prev) => prev.filter((a) => a.milestoneId !== milestoneId));
  };

  if (!user || !isAdmin || (alerts.length === 0 && upcoming.length === 0)) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <TrendingUp className="h-4 w-4 text-primary" />
          {alerts.length > 0 ? (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold animate-pulse">
              {alerts.length}
            </span>
          ) : (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center font-bold border border-border">
              {upcoming.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {alerts.length > 0 && (
          <div className="p-3 border-b border-border">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Milestone Upgrades Pending 🎯
            </h4>
            <p className="text-xs text-muted-foreground mt-1">Approve or dismiss upgrades</p>
          </div>
        )}
        <div className="max-h-80 overflow-y-auto">
          {alerts.map((a) => (
            <div
              key={a.milestoneId}
              className="px-3 py-3 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">
                  {a.trader_number ? `${a.trader_number} - ` : ""}{a.full_name}
                </p>
                <Badge className="bg-primary/20 text-primary text-[10px]">
                  Level {a.currentLevel} → {a.newLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Triggered by: {a.trigger === "both" ? "days & profit" : a.trigger === "time" ? `${a.tradingDays} trading days` : `$${Math.round(a.cumulativeProfit).toLocaleString()} profit`}
              </p>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="font-medium text-foreground">STO: {a.stoPercent}%</span>
                <span className="font-medium text-foreground">LTO: {a.ltoPercent}%</span>
                <span className="font-bold text-primary">Total: {a.stoPercent + a.ltoPercent}%</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={processing === a.milestoneId}
                  onClick={() => handleUpgrade(a)}
                >
                  <CheckCircle className="h-3 w-3" />
                  {processing === a.milestoneId ? "Upgrading..." : "Upgrade"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={processing === a.milestoneId}
                  onClick={() => handleDismiss(a.milestoneId)}
                >
                  <XCircle className="h-3 w-3" />
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>

        {upcoming.length > 0 && (
          <>
            <div className="p-3 border-b border-t border-border bg-muted/30">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Top 3 Closest to Next Level
              </h4>
              <p className="text-xs text-muted-foreground mt-1">By days or profit — whichever is closer</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {upcoming.map((u, i) => (
                <div key={u.userId} className="px-3 py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      <span className="text-muted-foreground mr-1">#{i + 1}</span>
                      {u.trader_number ? `${u.trader_number} - ` : ""}{u.full_name}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {u.currentLabel} → {u.nextLabel}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>Days: {u.tradingDays} / {u.daysRequired}</span>
                        <span>{u.daysProgress.toFixed(0)}%</span>
                      </div>
                      <Progress value={u.daysProgress} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>Profit: ${formatIndian(Math.max(0, Math.round(u.cumulativeProfit)))} / ${formatIndian(u.profitRequired)}</span>
                        <span>{u.profitProgress.toFixed(0)}%</span>
                      </div>
                      <Progress value={u.profitProgress} className="h-1.5" />
                    </div>
                  </div>
                  <p className="text-[10px] text-primary mt-1.5 font-medium">
                    Closest by {u.closestBy} ({u.bestProgress.toFixed(0)}%)
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MilestoneNotification;
