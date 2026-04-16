import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMilestoneLevel, MILESTONES } from "@/lib/payoutCalculations";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MilestoneAlert {
  full_name: string;
  trader_number: string | null;
  newLevel: number;
  newLabel: string;
  stoPercent: number;
  ltoPercent: number;
  trigger: "time" | "profit" | "both";
}

const MilestoneNotification = () => {
  const { user, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState<MilestoneAlert[]>([]);

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
        .select("user_id, trade_date, trader2_id, trader2_role")
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allData;
  };

  const evaluateMilestones = async () => {
    const [profilesRes, milestonesRes, configsRes, tradingData] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, trader_number, joining_date"),
      supabase.from("trader_milestones").select("*"),
      supabase.from("trader_config").select("*").eq("config_mode", "milestone"),
      fetchAllTradingData(),
    ]);

    const profiles = profilesRes.data || [];
    const milestones = milestonesRes.data || [];
    const milestoneConfigs = configsRes.data || [];
    const tradingData = tradingDataRes.data || [];

    // Count distinct trading days per user (as primary trader or as partner)
    const tradingDaysMap: Record<string, Set<string>> = {};
    tradingData.forEach((t) => {
      // Primary trader always counts
      if (!tradingDaysMap[t.user_id]) tradingDaysMap[t.user_id] = new Set();
      tradingDaysMap[t.user_id].add(t.trade_date);
      // Partner (trader2 with role 'partner') also counts
      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") {
        if (!tradingDaysMap[t.trader2_id]) tradingDaysMap[t.trader2_id] = new Set();
        tradingDaysMap[t.trader2_id].add(t.trade_date);
      }
    });

    const now = new Date();
    const newAlerts: MilestoneAlert[] = [];

    for (const ms of milestones) {
      const profile = profiles.find(p => p.user_id === ms.user_id);
      if (!profile) continue;

      const tradingDays = tradingDaysMap[ms.user_id]?.size || 0;
      const newMilestone = getMilestoneLevel(tradingDays, ms.cumulative_net_profit);

      // Check if trader leveled up beyond what's stored
      if (newMilestone.level > ms.current_level) {
        const daysMet = tradingDays >= MILESTONES[newMilestone.level].daysRequired;
        const profitMet = ms.cumulative_net_profit >= MILESTONES[newMilestone.level].profitRequired;

        newAlerts.push({
          full_name: profile.full_name,
          trader_number: profile.trader_number,
          newLevel: newMilestone.level,
          newLabel: newMilestone.label,
          stoPercent: newMilestone.stoPercent,
          ltoPercent: newMilestone.ltoPercent,
          trigger: daysMet && profitMet ? "both" : daysMet ? "time" : "profit",
        });

        // Auto-update the milestone record
        await supabase.from("trader_milestones")
          .update({ current_level: newMilestone.level, last_evaluated_at: new Date().toISOString() })
          .eq("id", ms.id);

        // Auto-update trader_config for NEXT month onwards (if in milestone mode)
        const isInMilestoneMode = milestoneConfigs.some(c => c.user_id === ms.user_id);
        if (isInMilestoneMode) {
          // Update current month + future configs
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          // Next month
          let nextMonth = currentMonth + 1;
          let nextYear = currentYear;
          if (nextMonth > 12) { nextMonth = 1; nextYear++; }

          // Check if next month config exists
          const { data: nextConfig } = await supabase
            .from("trader_config")
            .select("id")
            .eq("user_id", ms.user_id)
            .eq("month", nextMonth)
            .eq("year", nextYear)
            .maybeSingle();

          const newPayload = {
            sto_percentage: newMilestone.stoPercent,
            lto_percentage: newMilestone.ltoPercent,
            payout_percentage: newMilestone.stoPercent + newMilestone.ltoPercent,
            config_mode: "milestone",
          };

          if (nextConfig?.id) {
            await supabase.from("trader_config").update(newPayload).eq("id", nextConfig.id);
          } else {
            // Get latest config for software_cost etc.
            const { data: latestCfg } = await supabase
              .from("trader_config")
              .select("*")
              .eq("user_id", ms.user_id)
              .order("year", { ascending: false })
              .order("month", { ascending: false })
              .limit(1)
              .maybeSingle();

            await supabase.from("trader_config").insert({
              user_id: ms.user_id,
              month: nextMonth,
              year: nextYear,
              software_cost: latestCfg?.software_cost ?? 0,
              ...newPayload,
            });
          }

          // Also update all future months beyond next month
          const { data: futureConfigs } = await supabase
            .from("trader_config")
            .select("id")
            .eq("user_id", ms.user_id)
            .eq("config_mode", "milestone")
            .or(`year.gt.${nextYear},and(year.eq.${nextYear},month.gt.${nextMonth})`);

          if (futureConfigs) {
            for (const fc of futureConfigs) {
              await supabase.from("trader_config").update({
                sto_percentage: newMilestone.stoPercent,
                lto_percentage: newMilestone.ltoPercent,
                payout_percentage: newMilestone.stoPercent + newMilestone.ltoPercent,
              }).eq("id", fc.id);
            }
          }
        }
      }
    }

    setAlerts(newAlerts);
  };

  if (!user || !isAdmin || alerts.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold animate-pulse">
            {alerts.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Milestone Achievements 🎯
          </h4>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="px-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">
                  {a.trader_number ? `${a.trader_number} - ` : ""}{a.full_name}
                </p>
                <Badge className="bg-primary/20 text-primary text-[10px]">
                  {a.newLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Reached via {a.trigger === "both" ? "days & profit" : a.trigger === "time" ? "trading days" : "profit target"}
              </p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs font-medium text-foreground">STO: {a.stoPercent}%</span>
                <span className="text-xs font-medium text-foreground">LTO: {a.ltoPercent}%</span>
                <span className="text-xs font-bold text-primary">Total: {a.stoPercent + a.ltoPercent}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                New % applies from next month automatically
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MilestoneNotification;
