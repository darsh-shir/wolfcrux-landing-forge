import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, TrendingUp, Clock, Lock, Unlock } from "lucide-react";
import {
  MILESTONES,
  getMilestoneLevel,
  getNextMilestone,
  calculateShareCost,
  calculateLeaveDeduction,
  getSTOPayoutDate,
  getLTOUnlockDate,
  monthsBetween,
} from "@/lib/payoutCalculations";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_role?: string;
}

interface PayoutSheetProps {
  users: Profile[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PayoutSheet = ({ users }: PayoutSheetProps) => {
  const { toast } = useToast();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [selectedTrader, setSelectedTrader] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [tradingData, setTradingData] = useState<any[]>([]);
  const [trader2TradingData, setTrader2TradingData] = useState<any[]>([]);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState<any[]>([]);
  const [carryForwardDays, setCarryForwardDays] = useState(0);
  const [softwareCostInput, setSoftwareCostInput] = useState(0);
  const [inrRate, setInrRate] = useState(84);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [paidCash, setPaidCash] = useState(false);
  const [paidOnline, setPaidOnline] = useState(false);
  const [monthlySalaryInput, setMonthlySalaryInput] = useState(0);
  const [cashPaidInput, setCashPaidInput] = useState(0);
  const [bankPaidInput, setBankPaidInput] = useState(0);
  const [loading, setLoading] = useState(false);
  const [existingRecord, setExistingRecord] = useState<any>(null);
  const [milestoneData, setMilestoneData] = useState<any>(null);
  const [existingSto, setExistingSto] = useState<any>(null);
  const [existingLto, setExistingLto] = useState<any>(null);
  const [stoHistory, setStoHistory] = useState<any[]>([]);
  const [ltoHistory, setLtoHistory] = useState<any[]>([]);
  const [traderConfig, setTraderConfig] = useState<any>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (selectedTrader) fetchPayoutData();
  }, [selectedTrader, selectedMonth, selectedYear]);

  const fetchPayoutData = async () => {
    setLoading(true);

    const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const monthEnd = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const yearStart = `${selectedYear}-01-01`;

    const [
      tradesRes, tradesAsTrader2Res, attendanceRes, carryRes,
      existingRes, milestoneRes, stoRes, ltoRes, stoHistRes, ltoHistRes,
      configRes, exchangeRateRes
    ] = await Promise.all([
      supabase.from("trading_data").select("*")
        .eq("user_id", selectedTrader).gte("trade_date", monthStart).lte("trade_date", monthEnd),
      supabase.from("trading_data").select("*")
        .eq("trader2_id", selectedTrader).gte("trade_date", monthStart).lte("trade_date", monthEnd),
      supabase.from("attendance_records").select("*")
        .eq("user_id", selectedTrader).gte("record_date", yearStart).lte("record_date", monthEnd),
      supabase.from("leave_carry_forward").select("*")
        .eq("user_id", selectedTrader).eq("year", selectedYear).maybeSingle(),
      supabase.from("payout_records").select("*")
        .eq("user_id", selectedTrader).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
      supabase.from("trader_milestones").select("*")
        .eq("user_id", selectedTrader).maybeSingle(),
      supabase.from("sto_ledger").select("*")
        .eq("user_id", selectedTrader).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
      supabase.from("lto_ledger").select("*")
        .eq("user_id", selectedTrader).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
      supabase.from("sto_ledger").select("*")
        .eq("user_id", selectedTrader).order("year", { ascending: false }).order("month", { ascending: false }).limit(12),
      supabase.from("lto_ledger").select("*")
        .eq("user_id", selectedTrader).order("year", { ascending: false }).order("month", { ascending: false }).limit(12),
      supabase.from("trader_config").select("*")
        .eq("user_id", selectedTrader).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
      supabase.from("monthly_exchange_rates").select("*")
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
    ]);

    setTradingData(tradesRes.data || []);
    setTrader2TradingData(tradesAsTrader2Res.data || []);
    setAllAttendanceRecords(attendanceRes.data || []);
    setCarryForwardDays(carryRes.data?.carry_forward_days ?? 0);
    setMilestoneData(milestoneRes.data);
    setExistingSto(stoRes.data);
    setExistingLto(ltoRes.data);
    setStoHistory(stoHistRes.data || []);
    setLtoHistory(ltoHistRes.data || []);
    setTraderConfig(configRes.data);

    if (exchangeRateRes.data) {
      setInrRate(Number(exchangeRateRes.data.usd_to_inr));
    }

    // Fallback config if no month-specific one
    let config = configRes.data;
    if (!config) {
      const fallback = await supabase.from("trader_config").select("*")
        .eq("user_id", selectedTrader)
        .order("year", { ascending: false }).order("month", { ascending: false })
        .limit(1).maybeSingle();
      config = fallback.data;
      setTraderConfig(config);
    }

    if (config) setSoftwareCostInput(config.software_cost ?? 0);

    if (existingRes.data) {
      setExistingRecord(existingRes.data);
      setPaidCash(existingRes.data.paid_cash || false);
      setPaidOnline(existingRes.data.paid_online || false);
      setPayoutNotes(existingRes.data.notes || "");
      setMonthlySalaryInput(existingRes.data.salary || 0);
      setCashPaidInput(existingRes.data.advance_cash || 0);
      setBankPaidInput(existingRes.data.bank_transfer || 0);
    } else {
      setExistingRecord(null);
      setPaidCash(false);
      setPaidOnline(false);
      setPayoutNotes("");
      setMonthlySalaryInput(0);
      setCashPaidInput(0);
      setBankPaidInput(0);
    }
    setLoading(false);
  };

  // Determine milestone level
  const milestone = useMemo(() => {
    if (!milestoneData) return MILESTONES[0];
    const accountStart = new Date(milestoneData.account_start_date);
    const currentDate = new Date(selectedYear, selectedMonth - 1, 28);
    const months = monthsBetween(accountStart, currentDate);
    const cumProfit = Number(milestoneData.cumulative_net_profit || 0);
    return getMilestoneLevel(months, cumProfit);
  }, [milestoneData, selectedMonth, selectedYear]);

  const nextMilestone = useMemo(() => getNextMilestone(milestone.level), [milestone]);

  const calculations = useMemo(() => {
    const result = {
      totalPnl: 0, totalShares: 0, shareCost: 0, softwareCost: 0,
      netProfit: 0, stoPercent: milestone.stoPercent, ltoPercent: milestone.ltoPercent,
      stoAmount: 0, ltoAmount: 0,
      leaveDeductionPct: 0, leaveDeductionAmount: 0,
      traineePoolContribution: 0, finalStoAmount: 0,
      stoPayoutDate: getSTOPayoutDate(selectedMonth, selectedYear),
      ltoUnlockDate: getLTOUnlockDate(selectedMonth, selectedYear),
      tradingDays: 0,
      // Partner earnings
      partnerDeductions: [] as { name: string; role: string; splitPct: number; amount: number }[],
      totalPartnerDeduction: 0,
      traderKeepsFromPrimary: 0,
      trader2Earnings: [] as { primaryTraderName: string; pnl: number; role: string; splitPct: number; earnings: number }[],
      trader2Total: 0,
      combinedFinalSto: 0,
    };

    if (tradingData.length === 0) return result;

    const totalPnl = tradingData.reduce((sum: number, t: any) => sum + Number(t.net_pnl), 0);
    const totalShares = tradingData.reduce((sum: number, t: any) => sum + Number(t.shares_traded), 0);
    const shareCost = calculateShareCost(totalShares);
    const softwareCost = Number(softwareCostInput) || 0;
    const netProfit = totalPnl - shareCost - softwareCost;
    const tradingDays = tradingData.filter((t: any) => !t.is_holiday).length;

    // STO and LTO amounts (only on positive net profit)
    const stoAmount = netProfit > 0 ? netProfit * (milestone.stoPercent / 100) : 0;
    const ltoAmount = netProfit > 0 ? netProfit * (milestone.ltoPercent / 100) : 0;

    // Leave deductions
    const leaveResult = calculateLeaveDeduction(
      allAttendanceRecords, selectedMonth, selectedYear, carryForwardDays
    );
    const leaveDeductionPct = leaveResult.deductionPercent;
    const leaveDeductionAmount = stoAmount * (leaveDeductionPct / 100);
    const stoAfterLeave = stoAmount - leaveDeductionAmount;

    // Trainee pool: only traders WITHOUT a partner pay 25% pool
    const hasPartner = tradingData.some((t: any) =>
      t.trader2_role?.toLowerCase() === "partner"
    );
    const traineePoolContribution = !hasPartner && stoAfterLeave > 0 ? stoAfterLeave * 0.25 : 0;
    const finalStoAmount = stoAfterLeave - traineePoolContribution;

    // Partner deductions (for partner role - 50% of gross)
    const partnerDeductionMap: Record<string, { name: string; role: string; totalPnl: number; totalShares: number; days: number }> = {};

    tradingData.forEach((trade: any) => {
      if (trade.trader2_id && trade.trader2_role) {
        const key = trade.trader2_id;
        if (!partnerDeductionMap[key]) {
          const trader2User = users.find(u => u.user_id === trade.trader2_id);
          partnerDeductionMap[key] = {
            name: trader2User?.full_name || "Unknown",
            role: trade.trader2_role,
            totalPnl: 0, totalShares: 0, days: 0,
          };
        }
        partnerDeductionMap[key].totalPnl += Number(trade.net_pnl);
        partnerDeductionMap[key].totalShares += Number(trade.shares_traded);
        partnerDeductionMap[key].days += 1;
      }
    });

    const partnerDeductions: typeof result.partnerDeductions = [];
    let totalPartnerDeduction = 0;

    for (const [, info] of Object.entries(partnerDeductionMap)) {
      const roleLower = info.role.toLowerCase();
      if (roleLower === "partner") {
        const dayRatio = info.days / tradingDays;
        const proportionalGross = netProfit * dayRatio;
        const deduction = proportionalGross * 0.50;
        partnerDeductions.push({ name: info.name, role: info.role, splitPct: 50, amount: deduction });
        totalPartnerDeduction += deduction;
      }
      // Trainee deductions are handled via traineePoolContribution above
    }

    const traderKeepsFromPrimary = finalStoAmount - totalPartnerDeduction;

    // Trader2 earnings (where this trader is partner on someone else's account)
    const trader2Earnings: typeof result.trader2Earnings = [];
    if (trader2TradingData.length > 0) {
      const byPrimary: Record<string, any[]> = {};
      trader2TradingData.forEach((t: any) => {
        if (!byPrimary[t.user_id]) byPrimary[t.user_id] = [];
        byPrimary[t.user_id].push(t);
      });

      for (const [primaryUserId, trades] of Object.entries(byPrimary)) {
        const totalPnl2 = trades.reduce((sum: number, t: any) => sum + Number(t.net_pnl), 0);
        const totalShares2 = trades.reduce((sum: number, t: any) => sum + Number(t.shares_traded), 0);
        const shareCost2 = calculateShareCost(totalShares2);
        const netProfit2 = totalPnl2 - shareCost2;

        const role = trades[0]?.trader2_role || "partner";
        const roleLower = role.toLowerCase();

        let earnings = 0;
        if (roleLower === "partner") {
          earnings = netProfit2 * 0.50;
        }
        // Trainees receive from pool, not direct earnings

        const primaryUser = users.find(u => u.user_id === primaryUserId);
        trader2Earnings.push({
          primaryTraderName: primaryUser?.full_name || "Unknown",
          pnl: totalPnl2, role, splitPct: roleLower === "partner" ? 50 : 25, earnings,
        });
      }
    }

    const trader2Total = trader2Earnings.reduce((sum, e) => sum + e.earnings, 0);

    Object.assign(result, {
      totalPnl, totalShares, shareCost, softwareCost, netProfit,
      stoAmount, ltoAmount, leaveDeductionPct, leaveDeductionAmount,
      traineePoolContribution, finalStoAmount, tradingDays,
      partnerDeductions, totalPartnerDeduction, traderKeepsFromPrimary,
      trader2Earnings, trader2Total,
      combinedFinalSto: traderKeepsFromPrimary + trader2Total,
    });

    return result;
  }, [tradingData, trader2TradingData, allAttendanceRecords, carryForwardDays,
    selectedMonth, selectedYear, users, softwareCostInput, milestone]);

  const traderName = users.find(u => u.user_id === selectedTrader)?.full_name || "";

  const handleSaveSoftwareCost = async () => {
    if (!selectedTrader || !traderConfig?.id) {
      toast({ title: "Error", description: "No trader config found.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("trader_config").update({ software_cost: softwareCostInput }).eq("id", traderConfig.id);
    if (!error) toast({ title: "Saved", description: `Software cost updated to $${softwareCostInput}` });
  };

  const handleSaveAll = async () => {
    if (!selectedTrader) return;

    const finalUsd = calculations.combinedFinalSto;
    const totalInr = finalUsd * inrRate;

    // Save exchange rate
    const { data: existingRate } = await supabase.from("monthly_exchange_rates")
      .select("id").eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();

    if (existingRate) {
      await supabase.from("monthly_exchange_rates").update({ usd_to_inr: inrRate }).eq("id", existingRate.id);
    } else {
      await supabase.from("monthly_exchange_rates").insert({ month: selectedMonth, year: selectedYear, usd_to_inr: inrRate });
    }

    // Save STO ledger
    const stoPayload = {
      user_id: selectedTrader,
      month: selectedMonth,
      year: selectedYear,
      gross_profit: calculations.totalPnl,
      shares_traded: calculations.totalShares,
      share_cost: calculations.shareCost,
      software_cost: calculations.softwareCost,
      net_profit: calculations.netProfit,
      sto_percentage: calculations.stoPercent,
      sto_amount: calculations.stoAmount,
      leave_deduction_percent: calculations.leaveDeductionPct,
      leave_deduction_amount: calculations.leaveDeductionAmount,
      trainee_pool_contribution: calculations.traineePoolContribution,
      final_sto_amount: calculations.finalStoAmount,
      payout_due_date: calculations.stoPayoutDate.toISOString().split("T")[0],
    };

    if (existingSto?.id) {
      await supabase.from("sto_ledger").update(stoPayload).eq("id", existingSto.id);
    } else {
      await supabase.from("sto_ledger").insert(stoPayload);
    }

    // Save LTO ledger
    if (calculations.ltoAmount > 0) {
      const ltoPayload = {
        user_id: selectedTrader,
        month: selectedMonth,
        year: selectedYear,
        net_profit: calculations.netProfit,
        lto_percentage: calculations.ltoPercent,
        lto_amount: calculations.ltoAmount,
        unlock_date: calculations.ltoUnlockDate.toISOString().split("T")[0],
      };

      if (existingLto?.id) {
        await supabase.from("lto_ledger").update(ltoPayload).eq("id", existingLto.id);
      } else {
        await supabase.from("lto_ledger").insert(ltoPayload);
      }
    }

    // Update milestone cumulative profit (avoid double-counting on re-save)
    if (milestoneData) {
      const previousNetProfit = existingSto ? Number(existingSto.net_profit) : 0;
      const delta = calculations.netProfit - previousNetProfit;
      const newCumulative = Number(milestoneData.cumulative_net_profit) + delta;
      await supabase.from("trader_milestones")
        .update({ cumulative_net_profit: newCumulative, current_level: milestone.level })
        .eq("id", milestoneData.id);
    }

    // Save payout record
    const payoutPayload = {
      user_id: selectedTrader,
      month: selectedMonth,
      year: selectedYear,
      salary: monthlySalaryInput,
      cash_component: totalInr,
      bank_transfer: bankPaidInput,
      advance_cash: cashPaidInput,
      advance_bank: 0,
      notes: payoutNotes || null,
      paid_cash: paidCash,
      paid_online: paidOnline,
    };

    if (existingRecord?.id) {
      await supabase.from("payout_records").update(payoutPayload).eq("id", existingRecord.id);
    } else {
      await supabase.from("payout_records").insert(payoutPayload);
    }

    toast({ title: "Saved", description: "All payout records saved successfully" });
    fetchPayoutData();
  };

  const formatCurrency = (val: number, prefix = "$") =>
    formatCurrencyINR(val, prefix);

  return (
    <div className="space-y-6">
      {/* Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Monthly Payout Sheet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Select Trader</Label>
              <Select value={selectedTrader} onValueChange={setSelectedTrader}>
                <SelectTrigger><SelectValue placeholder="Select trader" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTrader && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{traderName} — {MONTHS[selectedMonth - 1]} {selectedYear}</span>
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {milestone.label} — STO {milestone.stoPercent}% / LTO {milestone.ltoPercent}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : tradingData.length === 0 && trader2TradingData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No trading data found for {MONTHS[selectedMonth - 1]} {selectedYear}.
              </div>
            ) : (
              <>
                {/* Milestone Progress */}
                {nextMilestone && milestoneData && (
                  <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Milestone Progress → {nextMilestone.label}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Profit: {formatCurrency(Number(milestoneData.cumulative_net_profit))} / {formatCurrency(nextMilestone.profitRequired)}
                        </p>
                        <Progress
                          value={Math.min(100, (Number(milestoneData.cumulative_net_profit) / nextMilestone.profitRequired) * 100)}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Time: {monthsBetween(new Date(milestoneData.account_start_date), new Date())}mo / {nextMilestone.monthsRequired}mo
                        </p>
                        <Progress
                          value={Math.min(100, (monthsBetween(new Date(milestoneData.account_start_date), new Date()) / nextMilestone.monthsRequired) * 100)}
                          className="h-2"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Next level: STO {nextMilestone.stoPercent}% / LTO {nextMilestone.ltoPercent}%
                    </p>
                  </div>
                )}

                {/* P&L Breakdown */}
                {tradingData.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">P&L Breakdown</h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                      <span className="text-muted-foreground">Gross Profit (Total P&L)</span>
                      <span className={`font-medium text-right ${calculations.totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {calculations.totalPnl >= 0 ? "" : "-"}{formatCurrency(calculations.totalPnl)}
                      </span>
                      <span className="text-muted-foreground">Share Cost ({formatIndian(calculations.totalShares)} shares × $14/1000)</span>
                      <span className="font-medium text-right text-orange-600">-{formatCurrency(calculations.shareCost)}</span>
                      <span className="text-muted-foreground">Software Cost</span>
                      <span className="font-medium text-right text-orange-600 flex items-center justify-end gap-2">
                        <Input type="number" className="w-24 text-right" step="0.01" value={softwareCostInput || ""}
                          onChange={e => setSoftwareCostInput(Number(e.target.value))} placeholder="0" />
                        <Button size="sm" variant="outline" onClick={handleSaveSoftwareCost} title="Save">
                          <Save className="h-3 w-3" />
                        </Button>
                      </span>
                      <span className="text-muted-foreground font-semibold border-t pt-2">Net Trading Profit</span>
                      <span className={`font-bold text-right border-t pt-2 ${calculations.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {calculations.netProfit >= 0 ? "" : "-"}{formatCurrency(calculations.netProfit)}
                      </span>
                    </div>
                  </div>
                )}

                {/* STO Calculation */}
                {tradingData.length > 0 && calculations.netProfit > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> STO (Short Term Output) — {calculations.stoPercent}%
                    </h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                      <span className="text-muted-foreground">STO Amount ({calculations.stoPercent}% of Net Profit)</span>
                      <span className="font-medium text-right text-green-600">{formatCurrency(calculations.stoAmount)}</span>
                      <span className="text-muted-foreground">Leave Deduction ({calculations.leaveDeductionPct.toFixed(1)}%)</span>
                      <span className="font-medium text-right text-red-600">-{formatCurrency(calculations.leaveDeductionAmount)}</span>
                      {calculations.traineePoolContribution > 0 && (
                        <>
                          <span className="text-muted-foreground">Trainee Pool (25% contribution)</span>
                          <span className="font-medium text-right text-blue-600">-{formatCurrency(calculations.traineePoolContribution)}</span>
                        </>
                      )}
                      {calculations.partnerDeductions.length > 0 && calculations.partnerDeductions.map((d, idx) => (
                        <React.Fragment key={idx}>
                          <span className="text-muted-foreground">Partner Share 50% — {d.name}</span>
                          <span className="font-medium text-right text-orange-600">-{formatCurrency(d.amount)}</span>
                        </React.Fragment>
                      ))}
                      <span className="text-muted-foreground font-semibold border-t pt-2">Final STO</span>
                      <span className="font-bold text-right text-green-600 border-t pt-2">
                        {formatCurrency(calculations.traderKeepsFromPrimary)}
                      </span>
                      <span className="text-muted-foreground text-xs italic">Payout Date</span>
                      <span className="text-right text-xs italic text-primary">
                        {calculations.stoPayoutDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}

                {/* LTO Calculation */}
                {tradingData.length > 0 && calculations.ltoAmount > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" /> LTO (Long Term Output) — {calculations.ltoPercent}%
                    </h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                      <span className="text-muted-foreground">LTO Amount ({calculations.ltoPercent}% of Net Profit)</span>
                      <span className="font-medium text-right text-green-600">{formatCurrency(calculations.ltoAmount)}</span>
                      <span className="text-muted-foreground text-xs italic">Unlock Date (12 months lock)</span>
                      <span className="text-right text-xs italic text-primary">
                        {calculations.ltoUnlockDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Partner Earnings */}
                {calculations.trader2Earnings.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Earnings as Partner
                    </h3>
                    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                      {calculations.trader2Earnings.map((earning, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-y-1 text-sm">
                          <span className="text-muted-foreground">From: {earning.primaryTraderName}</span>
                          <span className={`font-medium text-right ${earning.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            P&L: {formatCurrency(earning.pnl)}
                          </span>
                          <span className="text-muted-foreground">Role: {earning.role} ({earning.splitPct}%)</span>
                          <span className={`font-bold text-right ${earning.earnings >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(earning.earnings)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-bold">Total Partner Earnings</span>
                        <span className={`font-bold ${calculations.trader2Total >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(calculations.trader2Total)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Combined Total */}
                <div className="border-2 border-primary rounded-lg p-4 bg-primary/10">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="font-bold text-base">COMBINED STO PAYOUT (USD)</span>
                    <span className={`font-bold text-right text-xl ${calculations.combinedFinalSto >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(calculations.combinedFinalSto)}
                    </span>
                  </div>
                </div>

                {/* STO History */}
                {stoHistory.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> STO Payout Schedule
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">Period</th>
                            <th className="text-right p-2">STO Amount</th>
                            <th className="text-right p-2">Due Date</th>
                            <th className="text-center p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stoHistory.map((s: any) => (
                            <tr key={s.id} className="border-t">
                              <td className="p-2">{MONTHS[(s.month || 1) - 1]} {s.year}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(Number(s.final_sto_amount))}</td>
                              <td className="p-2 text-right text-muted-foreground">{s.payout_due_date}</td>
                              <td className="p-2 text-center">
                                <Badge variant={s.is_paid ? "default" : "secondary"} className="text-xs">
                                  {s.is_paid ? "Paid" : "Pending"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* LTO History */}
                {ltoHistory.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" /> LTO Lock Schedule
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">Period</th>
                            <th className="text-right p-2">LTO Amount</th>
                            <th className="text-right p-2">Unlock Date</th>
                            <th className="text-center p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ltoHistory.map((l: any) => {
                            const isUnlocked = new Date(l.unlock_date) <= new Date();
                            return (
                              <tr key={l.id} className="border-t">
                                <td className="p-2">{MONTHS[(l.month || 1) - 1]} {l.year}</td>
                                <td className="p-2 text-right font-medium">{formatCurrency(Number(l.lto_amount))}</td>
                                <td className="p-2 text-right text-muted-foreground">{l.unlock_date}</td>
                                <td className="p-2 text-center">
                                  <Badge variant={l.is_released ? "default" : isUnlocked ? "outline" : "secondary"} className="text-xs gap-1">
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
                  </div>
                )}

                {/* INR Conversion & Settlement */}
                {(() => {
                  const finalUsd = calculations.combinedFinalSto;
                  const totalInr = finalUsd * inrRate;
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>USD → INR Rate</Label>
                          <Input type="number" step="0.01" value={inrRate}
                            onChange={e => setInrRate(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)}
                            placeholder="Payout notes..." rows={3} />
                        </div>
                      </div>

                      <div className="border rounded-lg p-5 bg-primary/5 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground font-medium">STO Payout (INR)</span>
                          <span className={`text-2xl font-bold ${totalInr >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₹{formatIndian(totalInr, 2)}
                          </span>
                        </div>

                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox checked={paidCash} onCheckedChange={(v) => setPaidCash(!!v)} />
                              <span className="text-sm font-medium">Cash Paid</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox checked={paidOnline} onCheckedChange={(v) => setPaidOnline(!!v)} />
                              <span className="text-sm font-medium">Online Paid</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 text-sm border-t pt-3">
                          <span className="text-muted-foreground">(-) Monthly Salary</span>
                          <span className="font-medium text-right">
                            <Input type="number" className="w-28 inline text-right" value={monthlySalaryInput || ""}
                              onChange={e => setMonthlySalaryInput(Number(e.target.value))} placeholder="0" />
                          </span>
                          <span className="text-muted-foreground">(-) Cash Paid</span>
                          <span className="text-right">
                            <Input type="number" className="w-28 inline text-right" value={cashPaidInput || ""}
                              onChange={e => setCashPaidInput(Number(e.target.value))} placeholder="0" />
                          </span>
                          <span className="text-muted-foreground">(-) Bank Transfer</span>
                          <span className="text-right">
                            <Input type="number" className="w-28 inline text-right" value={bankPaidInput || ""}
                              onChange={e => setBankPaidInput(Number(e.target.value))} placeholder="0" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-3">
                          <span className="font-bold text-base">Outstanding Amount</span>
                          <span className={`text-xl font-bold ${(totalInr - monthlySalaryInput - cashPaidInput - bankPaidInput) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₹{formatIndian(totalInr - monthlySalaryInput - cashPaidInput - bankPaidInput, 2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Trading Days: {calculations.tradingDays}</span>
                </div>

                <Button onClick={handleSaveAll} className="w-full gap-2">
                  <Save className="h-4 w-4" /> Save Payout Record
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayoutSheet;
