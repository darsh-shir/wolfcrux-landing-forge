import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Calendar, DollarSign, Users, ArrowUpCircle } from "lucide-react";
import { formatIndian } from "@/lib/utils";
import { MILESTONES, getMilestoneLevel, getNextMilestone } from "@/lib/payoutCalculations";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  full_name: string;
  trader_number: string | null;
  employee_role: string;
}

interface TraderProgressData {
  userId: string;
  name: string;
  traderNumber: string | null;
  tradingDays: number;
  totalPnl: number;
  milestoneLevel: number;       // computed (eligible) level
  milestoneLabel: string;
  storedLevel: number;          // current confirmed level in DB
  milestoneId: string | null;
  firstTradeDate: string | null;
  nextLevel: typeof MILESTONES[0] | null;
  daysProgress: number;
  profitProgress: number;
  baselineDays: number;
  baselineProfit: number;
}

const TraderProgress = () => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<TraderProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyPnl, setCompanyPnl] = useState(0);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAllTradingData = async () => {
    const allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("trading_data")
        .select("user_id, trade_date, net_pnl, trader2_id, trader2_role, shares_traded")
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allData;
  };

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, milestonesRes, configRes, baselinesRes, tradingData] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, trader_number, employee_role"),
      supabase.from("trader_milestones").select("id, user_id, current_level, cumulative_net_profit"),
      supabase.from("trader_config").select("user_id, month, year, software_cost"),
      supabase.from("trader_baselines" as any).select("user_id, baseline_days, baseline_net_profit, baseline_level"),
      fetchAllTradingData(),
    ]);

    const profiles = profilesRes.data || [];
    const milestones = milestonesRes.data || [];
    const configs = configRes.data || [];
    const baselines = (baselinesRes.data || []) as any[];
    const baselineMap = new Map<string, { days: number; profit: number; level: number }>();
    baselines.forEach((b) => {
      baselineMap.set(b.user_id, {
        days: Number(b.baseline_days || 0),
        profit: Number(b.baseline_net_profit || 0),
        level: Number(b.baseline_level || 0),
      });
    });

    // Brokerage = $14 per 1000 shares; per-trader monthly software cost from trader_config (default $1000)
    const DEFAULT_SOFTWARE_COST = 1000;
    const swCostMap = new Map<string, number>(); // key: userId|year|month
    configs.forEach((c: any) => {
      swCostMap.set(`${c.user_id}|${c.year}|${c.month}`, Number(c.software_cost) || 0);
    });

    // Per-trader aggregates (combined own + partner sessions, mirroring what user sees in Trading Data)
    const tradingDaysMap: Record<string, Set<string>> = {};
    const grossMap: Record<string, number> = {};
    const sharesMap: Record<string, number> = {};
    const monthsActiveMap: Record<string, Set<string>> = {}; // userId -> Set<"YYYY-M">
    const firstTradeDateMap: Record<string, string> = {};

    const addToTrader = (uid: string, t: any) => {
      const shares = Number(t.shares_traded || 0);
      if (!tradingDaysMap[uid]) tradingDaysMap[uid] = new Set();
      tradingDaysMap[uid].add(t.trade_date);
      grossMap[uid] = (grossMap[uid] || 0) + Number(t.net_pnl);
      sharesMap[uid] = (sharesMap[uid] || 0) + shares;
      const d = new Date(t.trade_date);
      const ym = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      if (!monthsActiveMap[uid]) monthsActiveMap[uid] = new Set();
      monthsActiveMap[uid].add(ym);
      if (!firstTradeDateMap[uid] || t.trade_date < firstTradeDateMap[uid]) {
        firstTradeDateMap[uid] = t.trade_date;
      }
    };

    tradingData.forEach((t) => {
      addToTrader(t.user_id, t);
      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") {
        addToTrader(t.trader2_id, t);
      }
    });

    // Net P&L per trader = gross − brokerage − Σ(software_cost for each active month)
    const totalPnlMap: Record<string, number> = {};
    Object.keys(grossMap).forEach((uid) => {
      const brokerage = (sharesMap[uid] / 1000) * 14;
      let softwareTotal = 0;
      monthsActiveMap[uid].forEach((ym) => {
        const [y, m] = ym.split("-");
        const key = `${uid}|${y}|${m}`;
        softwareTotal += swCostMap.has(key) ? (swCostMap.get(key) as number) : DEFAULT_SOFTWARE_COST;
      });
      totalPnlMap[uid] = grossMap[uid] - brokerage - softwareTotal;
    });

    // Company P&L = sum of all PRIMARY trades' net (after brokerage), minus software cost across
    // primary trader-months (no double-counting from partner mirror).
    const companyPrimaryGross = tradingData.reduce((sum, t) => {
      const shares = Number(t.shares_traded || 0);
      return sum + Number(t.net_pnl) - (shares / 1000) * 14;
    }, 0);
    const primaryMonthsMap: Record<string, Set<string>> = {};
    tradingData.forEach((t) => {
      const d = new Date(t.trade_date);
      const ym = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      if (!primaryMonthsMap[t.user_id]) primaryMonthsMap[t.user_id] = new Set();
      primaryMonthsMap[t.user_id].add(ym);
    });
    let companySoftware = 0;
    Object.entries(primaryMonthsMap).forEach(([uid, set]) => {
      set.forEach((ym) => {
        const [y, m] = ym.split("-");
        const key = `${uid}|${y}|${m}`;
        companySoftware += swCostMap.has(key) ? (swCostMap.get(key) as number) : DEFAULT_SOFTWARE_COST;
      });
    });
    setCompanyPnl(companyPrimaryGross - companySoftware);

    // Auto-detect traders: anyone with at least 1 trading day OR a seeded baseline
    const qualifiedUserIds = new Set<string>();
    Object.entries(tradingDaysMap).forEach(([userId, days]) => {
      if (days.size >= 1) qualifiedUserIds.add(userId);
    });
    baselineMap.forEach((_, uid) => qualifiedUserIds.add(uid));

    const traderProfiles = profiles.filter((p) => qualifiedUserIds.has(p.user_id));

    // Auto-promote trainees to trader role when they hit 20+ days
    const toPromote = traderProfiles.filter(
      (p) => p.employee_role !== "trader" && qualifiedUserIds.has(p.user_id)
    );
    if (toPromote.length > 0) {
      await Promise.all(
        toPromote.map((p) =>
          supabase.from("profiles").update({ employee_role: "trader" }).eq("user_id", p.user_id)
        )
      );
    }

    const result: TraderProgressData[] = traderProfiles.map((p) => {
      const baseline = baselineMap.get(p.user_id);
      const actualDays = tradingDaysMap[p.user_id]?.size || 0;
      const tradingDays = actualDays + (baseline?.days || 0);
      const ms = milestones.find((m) => m.user_id === p.user_id);
      const actualPnl = totalPnlMap[p.user_id] || 0;
      const totalPnl = actualPnl + (baseline?.profit || 0);
      // Use baseline+actual for level eligibility
      const milestone = getMilestoneLevel(tradingDays, totalPnl);
      const next = getNextMilestone(milestone.level);

      return {
        userId: p.user_id,
        name: p.full_name,
        traderNumber: p.trader_number,
        tradingDays,
        totalPnl,
        milestoneLevel: milestone.level,
        milestoneLabel: milestone.label,
        storedLevel: ms?.current_level ?? (baseline?.level ?? 0),
        milestoneId: ms?.id ?? null,
        firstTradeDate: firstTradeDateMap[p.user_id] || null,
        nextLevel: next,
        daysProgress: next ? Math.min(100, (tradingDays / next.daysRequired) * 100) : 100,
        profitProgress: next ? Math.min(100, (Math.max(0, totalPnl) / next.profitRequired) * 100) : 100,
      };
    });

    // Sort by trader number
    result.sort((a, b) => {
      if (a.traderNumber && b.traderNumber) return a.traderNumber.localeCompare(b.traderNumber);
      if (a.traderNumber) return -1;
      if (b.traderNumber) return 1;
      return a.name.localeCompare(b.name);
    });

    setData(result);
    setLoading(false);
  };

  const handleUpgrade = async (trader: TraderProgressData) => {
    if (trader.milestoneLevel <= trader.storedLevel) return;
    const targetLevel = trader.milestoneLevel;
    const target = MILESTONES[targetLevel];
    setUpgrading(trader.userId);
    try {
      // 1. Upsert milestone record
      if (trader.milestoneId) {
        await supabase
          .from("trader_milestones")
          .update({
            current_level: targetLevel,
            cumulative_net_profit: trader.totalPnl,
            last_evaluated_at: new Date().toISOString(),
          })
          .eq("id", trader.milestoneId);
      } else {
        await supabase.from("trader_milestones").insert({
          user_id: trader.userId,
          account_start_date: trader.firstTradeDate || new Date().toISOString().slice(0, 10),
          current_level: targetLevel,
          cumulative_net_profit: trader.totalPnl,
        });
      }

      // 2. Apply new STO/LTO % from NEXT month onward
      const now = new Date();
      let nextMonth = now.getMonth() + 2; // current month is +1, next is +2
      let nextYear = now.getFullYear();
      if (nextMonth > 12) { nextMonth -= 12; nextYear++; }

      const newPayload = {
        sto_percentage: target.stoPercent,
        lto_percentage: target.ltoPercent,
        payout_percentage: target.stoPercent + target.ltoPercent,
        config_mode: "milestone",
      };

      const { data: nextConfig } = await supabase
        .from("trader_config")
        .select("id")
        .eq("user_id", trader.userId)
        .eq("month", nextMonth)
        .eq("year", nextYear)
        .maybeSingle();

      if (nextConfig?.id) {
        await supabase.from("trader_config").update(newPayload).eq("id", nextConfig.id);
      } else {
        const { data: latestCfg } = await supabase
          .from("trader_config")
          .select("software_cost, seat_type")
          .eq("user_id", trader.userId)
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase.from("trader_config").insert({
          user_id: trader.userId,
          month: nextMonth,
          year: nextYear,
          software_cost: latestCfg?.software_cost ?? 0,
          seat_type: latestCfg?.seat_type ?? "Alone",
          ...newPayload,
        });
      }

      // 3. Cascade to any future milestone-mode configs already created
      const { data: futureConfigs } = await supabase
        .from("trader_config")
        .select("id")
        .eq("user_id", trader.userId)
        .eq("config_mode", "milestone")
        .or(`year.gt.${nextYear},and(year.eq.${nextYear},month.gt.${nextMonth})`);

      if (futureConfigs && futureConfigs.length > 0) {
        await Promise.all(
          futureConfigs.map((fc) =>
            supabase.from("trader_config").update(newPayload).eq("id", fc.id)
          )
        );
      }

      toast.success(
        `${trader.name} upgraded to ${target.label}. New % apply from ${nextMonth}/${nextYear}.`
      );
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upgrade trader");
    } finally {
      setUpgrading(null);
    }
  };

  const totalTraders = data.length;
  const totalTradingDays = data.reduce((s, d) => s + d.tradingDays, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Traders</p>
                <p className="text-2xl font-bold text-foreground">{totalTraders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Trading Days</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalTraders > 0 ? Math.round(totalTradingDays / totalTraders) : 0}
                </p>
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
                <p className="text-sm text-muted-foreground">Total Company P&L</p>
                <p className={`text-2xl font-bold ${companyPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  ${formatIndian(Math.abs(companyPnl))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Highest Level</p>
                <p className="text-2xl font-bold text-foreground">
                  {data.length > 0 ? MILESTONES[Math.max(...data.map(d => d.milestoneLevel))].label : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trader Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Trader</TableHead>
                  <TableHead className="text-center">Trading Days</TableHead>
                  <TableHead className="text-right">Total P&L</TableHead>
                  <TableHead className="text-center">Current Level</TableHead>
                  <TableHead>Days Progress</TableHead>
                  <TableHead>Profit Progress</TableHead>
                  <TableHead className="text-center">Next Level</TableHead>
                  {isAdmin && <TableHead className="text-center">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((trader, i) => (
                  <TableRow key={trader.userId}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">
                          {trader.traderNumber ? `${trader.traderNumber} — ` : ""}{trader.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-foreground">{trader.tradingDays}</span>
                      <span className="text-xs text-muted-foreground ml-1">days</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${trader.totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {trader.totalPnl >= 0 ? "+" : "-"}${formatIndian(Math.abs(trader.totalPnl))}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={trader.milestoneLevel > 0 ? "default" : "secondary"} className="text-xs">
                        {trader.milestoneLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {trader.nextLevel ? (
                        <div className="space-y-1 min-w-[140px]">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{trader.tradingDays}</span>
                            <span>{trader.nextLevel.daysRequired} days</span>
                          </div>
                          <Progress value={trader.daysProgress} className="h-2" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Max level</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {trader.nextLevel ? (
                        <div className="space-y-1 min-w-[140px]">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>${formatIndian(trader.totalPnl > 0 ? trader.totalPnl : 0)}</span>
                            <span>${formatIndian(trader.nextLevel.profitRequired)}</span>
                          </div>
                          <Progress value={trader.profitProgress} className="h-2" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Max level</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {trader.nextLevel ? (
                        <span className="text-xs text-muted-foreground">
                          {trader.nextLevel.label} — STO {trader.nextLevel.stoPercent}% / LTO {trader.nextLevel.ltoPercent}%
                        </span>
                      ) : (
                        <Badge className="bg-primary/20 text-primary text-xs">MAX</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        {trader.milestoneLevel > trader.storedLevel ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={upgrading === trader.userId}
                            onClick={() => handleUpgrade(trader)}
                          >
                            <ArrowUpCircle className="h-3 w-3" />
                            {upgrading === trader.userId
                              ? "Upgrading..."
                              : `Upgrade → ${MILESTONES[trader.milestoneLevel].label}`}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Milestone Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {MILESTONES.map((m) => (
              <div key={m.level} className="p-3 rounded-lg border border-border bg-muted/30">
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TraderProgress;
