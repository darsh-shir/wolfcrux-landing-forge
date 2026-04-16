import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Calendar, DollarSign, Users } from "lucide-react";
import { formatIndian } from "@/lib/utils";
import { MILESTONES, getMilestoneLevel, getNextMilestone } from "@/lib/payoutCalculations";

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
  milestoneLevel: number;
  milestoneLabel: string;
  nextLevel: typeof MILESTONES[0] | null;
  daysProgress: number;
  profitProgress: number;
}

const TraderProgress = () => {
  const [data, setData] = useState<TraderProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyPnl, setCompanyPnl] = useState(0);

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
    const [profilesRes, milestonesRes, tradingData] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, trader_number, employee_role"),
      supabase.from("trader_milestones").select("user_id, cumulative_net_profit"),
      fetchAllTradingData(),
    ]);

    const profiles = profilesRes.data || [];
    const milestones = milestonesRes.data || [];

    // Count distinct trading days and total PnL per user
    const tradingDaysMap: Record<string, Set<string>> = {};
    const totalPnlMap: Record<string, number> = {};

    tradingData.forEach((t) => {
      // Primary trader
      if (!tradingDaysMap[t.user_id]) tradingDaysMap[t.user_id] = new Set();
      tradingDaysMap[t.user_id].add(t.trade_date);
      totalPnlMap[t.user_id] = (totalPnlMap[t.user_id] || 0) + Number(t.net_pnl);

      // Partner gets mirrored P&L and trading day count
      if (t.trader2_id && t.trader2_role?.toLowerCase() === "partner") {
        if (!tradingDaysMap[t.trader2_id]) tradingDaysMap[t.trader2_id] = new Set();
        tradingDaysMap[t.trader2_id].add(t.trade_date);
        totalPnlMap[t.trader2_id] = (totalPnlMap[t.trader2_id] || 0) + Number(t.net_pnl);
      }
    });

    // Company P&L = sum of all primary trader net_pnl (no double counting)
    const companyTotal = tradingData.reduce((sum, t) => sum + Number(t.net_pnl), 0);
    setCompanyPnl(companyTotal);

    // Auto-detect traders: anyone with 20+ primary trading days (as user_id or as partner)
    const qualifiedUserIds = new Set<string>();
    Object.entries(tradingDaysMap).forEach(([userId, days]) => {
      if (days.size >= 20) qualifiedUserIds.add(userId);
    });

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
      const tradingDays = tradingDaysMap[p.user_id]?.size || 0;
      const ms = milestones.find((m) => m.user_id === p.user_id);
      const cumProfit = Number(ms?.cumulative_net_profit || 0);
      const totalPnl = totalPnlMap[p.user_id] || 0;
      const milestone = getMilestoneLevel(tradingDays, cumProfit);
      const next = getNextMilestone(milestone.level);

      return {
        userId: p.user_id,
        name: p.full_name,
        traderNumber: p.trader_number,
        tradingDays,
        totalPnl,
        milestoneLevel: milestone.level,
        milestoneLabel: milestone.label,
        nextLevel: next,
        daysProgress: next ? Math.min(100, (tradingDays / next.daysRequired) * 100) : 100,
        profitProgress: next ? Math.min(100, (cumProfit / next.profitRequired) * 100) : 100,
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
            <Table>
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
