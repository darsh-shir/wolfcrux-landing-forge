import { useEffect, useState } from "react";
import { TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMilestoneLevel, getNextMilestone, MILESTONES } from "@/lib/payoutCalculations";
import { loadAllTraderHistories } from "@/hooks/useTraderHistory";
import { getAllTradeRows } from "@/lib/tradeCache";
import { Progress } from "@/components/ui/progress";
import { formatIndian, fmtAmt } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


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

// Module-level cache prevents the icon from disappearing/reappearing
// when Navigation unmounts/remounts during route changes.
let cachedAlerts: MilestoneAlert[] | null = null;
let cachedUpcoming: UpcomingTrader[] | null = null;
let cachedForUserId: string | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// The bell is mounted twice (desktop and mobile menus); share one check between them.
let evaluating: Promise<void> | null = null;
const listeners = new Set<() => void>();

const MilestoneNotification = () => {
  const { user, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState<MilestoneAlert[]>(
    () => (cachedForUserId === (user?.id ?? null) && cachedAlerts) || []
  );
  const [upcoming, setUpcoming] = useState<UpcomingTrader[]>(
    () => (cachedForUserId === (user?.id ?? null) && cachedUpcoming) || []
  );


  useEffect(() => {
    if (!user || !isAdmin) return;

    // Hydrate instantly from cache when the user matches
    if (cachedForUserId === user.id && cachedAlerts && cachedUpcoming) {
      setAlerts(cachedAlerts);
      setUpcoming(cachedUpcoming);
      if (Date.now() - lastFetchedAt < CACHE_TTL_MS) return;
    }

    const sync = () => {
      if (cachedAlerts) setAlerts(cachedAlerts);
      if (cachedUpcoming) setUpcoming(cachedUpcoming);
    };
    listeners.add(sync);
    if (!evaluating) {
      evaluating = evaluateMilestones().finally(() => {
        evaluating = null;
        listeners.forEach((l) => l());
      });
    }
    return () => {
      listeners.delete(sync);
    };
  }, [user, isAdmin]);

  // Shared, cached copy of the trade history (downloads once per page).
  const fetchAllTradingData = () => getAllTradeRows();

  const evaluateMilestones = async () => {
    const [profilesRes, milestonesRes, tradingData] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, trader_number"),
      supabase.from("trader_milestones").select("*"),
      fetchAllTradingData(),
    ]);

    const profiles = profilesRes.data || [];
    const milestones = milestonesRes.data || [];

    // Trading days, first trade and net profit from the shared payout engine
    // (partner days split 50/50, monthly software cost, baseline, days-OR-profit).
    const activeIds = new Set<string>();
    const firstTradeDateMap: Record<string, string> = {};
    tradingData.forEach((t) => {
      const ids = [t.user_id];
      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") ids.push(t.trader2_id);
      ids.forEach((uid) => {
        activeIds.add(uid);
        if (!firstTradeDateMap[uid] || t.trade_date < firstTradeDateMap[uid]) firstTradeDateMap[uid] = t.trade_date;
      });
    });
    let histories: Awaited<ReturnType<typeof loadAllTraderHistories>>;
    try {
      histories = await loadAllTraderHistories([...activeIds]);
    } catch {
      return; // don't show level alerts from incomplete data
    }
    const tradingDaysMap: Record<string, { size: number }> = {};
    const totalPnlMap: Record<string, number> = {};
    histories.forEach((h, uid) => {
      tradingDaysMap[uid] = { size: h.totalDays };
      totalPnlMap[uid] = h.totalProfit;
    });

    // Auto-create missing milestone rows for any trader with activity
    const existingMilestoneUserIds = new Set(milestones.map((m) => m.user_id));
    const missingTraderIds = Object.keys(tradingDaysMap).filter(
      (uid) => !existingMilestoneUserIds.has(uid) && profiles.some((p) => p.user_id === uid)
    );

    if (missingTraderIds.length > 0) {
      const inserts = missingTraderIds.map((uid) => ({
        user_id: uid,
        account_start_date: firstTradeDateMap[uid] || new Date().toISOString().slice(0, 10),
        current_level: 0,
        cumulative_net_profit: 0,
      }));
      const { data: inserted } = await supabase
        .from("trader_milestones")
        .insert(inserts)
        .select("*");
      if (inserted) milestones.push(...inserted);
    }

    const newAlerts: MilestoneAlert[] = [];
    const upcomingList: UpcomingTrader[] = [];

    for (const ms of milestones) {
      const profile = profiles.find((p) => p.user_id === ms.user_id);
      if (!profile) continue;

      const tradingDays = tradingDaysMap[ms.user_id]?.size || 0;
      // Use actual computed net P&L (not stale stored value) for level evaluation
      const cumulativeProfit = totalPnlMap[ms.user_id] ?? Number(ms.cumulative_net_profit || 0);
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
    const trimmedUpcoming = upcomingList.slice(0, 3);

    cachedAlerts = newAlerts;
    cachedUpcoming = trimmedUpcoming;
    cachedForUserId = user?.id ?? null;
    lastFetchedAt = Date.now();

    setAlerts(newAlerts);
    setUpcoming(trimmedUpcoming);
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
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="w-[calc(100vw-1.5rem)] sm:w-96 p-0">
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
                Triggered by: {a.trigger === "both" ? "days & profit" : a.trigger === "time" ? `${a.tradingDays} trading days` : `$${fmtAmt(Math.round(a.cumulativeProfit), 0)} profit`}
              </p>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="font-medium text-foreground">STO: {a.stoPercent}%</span>
                <span className="font-medium text-foreground">LTO: {a.ltoPercent}%</span>
                <span className="font-bold text-primary">Total: {a.stoPercent + a.ltoPercent}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                Upgrade from the Trader Progress tab.
              </p>
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
