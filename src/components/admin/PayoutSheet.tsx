import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
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
  const [traderConfig, setTraderConfig] = useState<any>(null);
  const [tradingData, setTradingData] = useState<any[]>([]);
  const [trader2TradingData, setTrader2TradingData] = useState<any[]>([]);
  const [partnerOfConfigs, setPartnerOfConfigs] = useState<any[]>([]);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState<any[]>([]);
  const [carryForwardDays, setCarryForwardDays] = useState(0);
  const [extraDeduction, setExtraDeduction] = useState(0);
  const [inrRate, setInrRate] = useState(84);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [paidCash, setPaidCash] = useState(false);
  const [paidOnline, setPaidOnline] = useState(false);
  const [monthlySalaryInput, setMonthlySalaryInput] = useState(0);
  const [cashPaidInput, setCashPaidInput] = useState(0);
  const [bankPaidInput, setBankPaidInput] = useState(0);
  const [loading, setLoading] = useState(false);
  const [existingRecord, setExistingRecord] = useState<any>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (selectedTrader) fetchPayoutData();
  }, [selectedTrader, selectedMonth, selectedYear]);

  const fetchPayoutData = async () => {
    setLoading(true);

    const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const monthEnd = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Fetch all attendance records for the year (for cumulative calculation)
    const yearStart = `${selectedYear}-01-01`;

    const [configRes, tradesRes, tradesAsTrader2Res, allTrader2ConfigsRes, attendanceRes, carryRes, existingRes] = await Promise.all([
      supabase.from("trader_config").select("*")
        .eq("user_id", selectedTrader)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle(),
      supabase.from("trading_data").select("*")
        .eq("user_id", selectedTrader)
        .gte("trade_date", monthStart)
        .lte("trade_date", monthEnd),
      supabase.from("trading_data").select("*")
        .eq("trader2_id", selectedTrader)
        .gte("trade_date", monthStart)
        .lte("trade_date", monthEnd),
      // Fetch configs for all primary traders whose accounts this trader worked on as trader2
      supabase.from("trader_config").select("*")
        .eq("month", selectedMonth)
        .eq("year", selectedYear),
      supabase.from("attendance_records").select("*")
        .eq("user_id", selectedTrader)
        .gte("record_date", yearStart)
        .lte("record_date", monthEnd),
      supabase.from("leave_carry_forward").select("*")
        .eq("user_id", selectedTrader)
        .eq("year", selectedYear)
        .maybeSingle(),
      supabase.from("payout_records").select("*")
        .eq("user_id", selectedTrader)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle(),
    ]);

    // Fallback: if no month-specific config, try without month/year filter
    let config = configRes.data;
    if (!config) {
      const fallback = await supabase.from("trader_config").select("*")
        .eq("user_id", selectedTrader)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1)
        .maybeSingle();
      config = fallback.data;
    }

    setTraderConfig(config);
    setTradingData(tradesRes.data || []);
    setTrader2TradingData(tradesAsTrader2Res.data || []);
    setPartnerOfConfigs(allTrader2ConfigsRes.data || []);
    setAllAttendanceRecords(attendanceRes.data || []);
    setCarryForwardDays(carryRes.data?.carry_forward_days ?? 0);
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

  const calculations = useMemo(() => {
    const result = {
      totalPnl: 0, totalShares: 0, shareCharge: 0, softwareCost: 0,
      grossAmount: 0, payoutPct: 0, tradersShare: 0,
      attendanceDeductionPct: 0, attendanceDeduction: 0,
      totalDeductions: 0, netPayout: 0,
      // Partner/trainee deductions from primary account
      partnerDeductions: [] as { name: string; role: string; splitPct: number; amount: number }[],
      totalPartnerDeduction: 0,
      traderKeepsFromPrimary: 0,
      tradingDays: 0,
      // Trader2 earnings from other accounts (where this trader sits as partner/trainee)
      trader2Earnings: [] as { primaryTraderName: string; pnl: number; role: string; splitPct: number; earnings: number }[],
      trader2Total: 0,
      combinedNetPayout: 0,
      poolContribution: 0,
    };

    // === PRIMARY ACCOUNT CALCULATION ===
    const hasPrimaryData = tradingData.length > 0 && traderConfig;
    let primaryNetPayout = 0;

    if (hasPrimaryData) {
      const totalPnl = tradingData.reduce((sum, t) => sum + Number(t.net_pnl), 0);
      const totalShares = tradingData.reduce((sum, t) => sum + Number(t.shares_traded), 0);
      const shareCharge = (totalShares / 1000) * 14;
      const softwareCost = Number(traderConfig.software_cost) || 0;
      const grossAmount = totalPnl - shareCharge - softwareCost;
      const payoutPct = Number(traderConfig.payout_percentage) / 100;
      const tradersShare = grossAmount * payoutPct;
      const tradingDays = tradingData.filter(t => !t.is_holiday).length;

      // Cumulative leave balance calculation
      let attendanceDeductionPct = 0;
      {
        let runningBalance = carryForwardDays;
        for (let m = 1; m <= selectedMonth; m++) {
          runningBalance += 1.5;
          const monthRecords = allAttendanceRecords.filter((r: any) => {
            const d = new Date(r.record_date);
            return d.getFullYear() === selectedYear && d.getMonth() + 1 === m;
          });
          const fullDays = monthRecords.filter((r: any) => r.status === "absent").length;
          const halfDays = monthRecords.filter((r: any) => r.status === "half_day").length;
          const lateCount = monthRecords.filter((r: any) => r.status === "late").length;
          const lateConverted = Math.floor(lateCount / 3) * 0.5;
          const totalUsed = fullDays + halfDays * 0.5 + lateConverted;

          if (m < selectedMonth) {
            runningBalance = Math.max(0, runningBalance - totalUsed);
          } else {
            const excess = Math.max(0, totalUsed - runningBalance);
            attendanceDeductionPct = excess * 4;
          }
        }
      }

      const attendanceDeduction = tradersShare * (attendanceDeductionPct / 100);
      const totalDeductions = attendanceDeduction + extraDeduction;
      const netPayout = tradersShare - totalDeductions;

      // Calculate per-day partner/trainee deductions based on trader2_role
      const partnerDeductionMap: Record<string, { name: string; role: string; totalPnl: number; totalShares: number; days: number }> = {};
      let totalPoolContribution = 0;

      tradingData.forEach(trade => {
        if (trade.trader2_id && trade.trader2_role) {
          const key = trade.trader2_id;
          if (!partnerDeductionMap[key]) {
            const trader2User = users.find(u => u.user_id === trade.trader2_id);
            partnerDeductionMap[key] = {
              name: trader2User?.full_name || "Unknown",
              role: trade.trader2_role,
              totalPnl: 0,
              totalShares: 0,
              days: 0,
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
        const splitPct = roleLower === "partner" ? 50 : 25;
        const dayRatio = info.days / tradingDays;

        let deductionAmount: number;
        if (roleLower === "partner") {
          // Partner gets 50% of GROSS (proportional to days worked together)
          const proportionalGross = grossAmount * dayRatio;
          deductionAmount = proportionalGross * 0.50;
        } else {
          // Trainee: 25% of TRADER'S SHARE (proportional to days worked together)
          const proportionalShare = tradersShare * dayRatio;
          deductionAmount = proportionalShare * 0.25;
        }

        partnerDeductions.push({
          name: info.name,
          role: info.role,
          splitPct,
          amount: deductionAmount,
        });
        totalPartnerDeduction += deductionAmount;

        if (roleLower === "trainee") {
          totalPoolContribution += deductionAmount;
        }
      }

      const traderKeepsFromPrimary = netPayout - totalPartnerDeduction;

      Object.assign(result, {
        totalPnl, totalShares, shareCharge, softwareCost, grossAmount,
        payoutPct: traderConfig.payout_percentage, tradersShare,
        attendanceDeductionPct, attendanceDeduction, totalDeductions,
        netPayout, tradingDays,
        partnerDeductions, totalPartnerDeduction, traderKeepsFromPrimary,
        poolContribution: totalPoolContribution,
      });

      primaryNetPayout = traderKeepsFromPrimary;
    }

    // === TRADER2 EARNINGS (where this trader is trader2 on someone else's account) ===
    const trader2Earnings: typeof result.trader2Earnings = [];

    if (trader2TradingData.length > 0) {
      // Group by primary trader
      const byPrimary: Record<string, any[]> = {};
      trader2TradingData.forEach(t => {
        if (!byPrimary[t.user_id]) byPrimary[t.user_id] = [];
        byPrimary[t.user_id].push(t);
      });

      for (const [primaryUserId, trades] of Object.entries(byPrimary)) {
        const primaryConfig = partnerOfConfigs.find((c: any) => c.user_id === primaryUserId);
        if (!primaryConfig) continue;

        const totalPnl = trades.reduce((sum: number, t: any) => sum + Number(t.net_pnl), 0);
        const totalShares = trades.reduce((sum: number, t: any) => sum + Number(t.shares_traded), 0);
        const shareCharge = (totalShares / 1000) * 14;
        const softwareCost = Number(primaryConfig.software_cost) || 0;
        const grossAmount = totalPnl - shareCharge - softwareCost;
        const primaryPayoutPct = Number(primaryConfig.payout_percentage) / 100;
        const primaryShare = grossAmount * primaryPayoutPct;

        // Determine role from the trading data entries
        const role = trades[0]?.trader2_role || "partner";
        const roleLower = role.toLowerCase();
        const splitPct = roleLower === "partner" ? 50 : 25;

        let earnings: number;
        if (roleLower === "partner") {
          // Partner gets 50% of GROSS
          earnings = grossAmount * 0.50;
        } else {
          // Trainee: their 25% goes to pool, not direct earnings
          // Show as 0 here - they receive from pool distribution
          earnings = 0;
        }

        const primaryUser = users.find(u => u.user_id === primaryUserId);
        trader2Earnings.push({
          primaryTraderName: primaryUser?.full_name || "Unknown",
          pnl: totalPnl,
          role,
          splitPct,
          earnings,
        });
      }
    }

    const trader2Total = trader2Earnings.reduce((sum, e) => sum + e.earnings, 0);
    result.trader2Earnings = trader2Earnings;
    result.trader2Total = trader2Total;
    result.combinedNetPayout = primaryNetPayout + trader2Total;

    return result;
  }, [traderConfig, tradingData, trader2TradingData, partnerOfConfigs, allAttendanceRecords, carryForwardDays, selectedMonth, selectedYear, extraDeduction, users]);

  const traderName = users.find(u => u.user_id === selectedTrader)?.full_name || "";

  const handleSavePayout = async () => {
    if (!selectedTrader) return;

    const finalUsd = calculations.combinedNetPayout;
    const totalInr = finalUsd * inrRate;

    const payload = {
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
      await supabase.from("payout_records").update(payload).eq("id", existingRecord.id);
    } else {
      await supabase.from("payout_records").insert(payload);
    }

    toast({ title: "Saved", description: "Payout record saved" });
    fetchPayoutData();
  };

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-lg">
              {traderName} — {MONTHS[selectedMonth - 1]} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : !traderConfig && trader2TradingData.length === 0 ? (
              <div className="text-center py-8 text-destructive font-medium">
                No Trader Config found for {traderName}. Please set up their payout percentage, software cost, and seat type in the <strong>Trader Config</strong> tab first.
              </div>
            ) : tradingData.length === 0 && trader2TradingData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No trading data found for {MONTHS[selectedMonth - 1]} {selectedYear}.
              </div>
            ) : (
              <>
                {/* P&L Breakdown - only show if trader has primary trading data */}
                {tradingData.length > 0 && traderConfig && (
                  <>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">P&L Breakdown (Primary Account)</h3>
                      <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                        <span className="text-muted-foreground">Total P&L</span>
                        <span className={`font-medium text-right ${calculations.totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${calculations.totalPnl.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">Share Charge ({calculations.totalShares.toLocaleString()} shares)</span>
                        <span className="font-medium text-right text-orange-600">-${calculations.shareCharge.toFixed(2)}</span>
                        <span className="text-muted-foreground">Software Cost</span>
                        <span className="font-medium text-right text-orange-600">-${calculations.softwareCost.toFixed(2)}</span>
                        <span className="text-muted-foreground font-semibold border-t pt-2">Gross Amount (Company)</span>
                        <span className={`font-bold text-right border-t pt-2 ${calculations.grossAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${calculations.grossAmount.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">Trader Payout %</span>
                        <span className="font-medium text-right">{calculations.payoutPct}%</span>
                        <span className="text-muted-foreground font-semibold">Trader's Share</span>
                        <span className={`font-bold text-right ${calculations.tradersShare >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${calculations.tradersShare.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Deductions</h3>
                      <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                        <span className="text-muted-foreground">Attendance Deduction %</span>
                        <span className="font-medium text-right text-red-600">{calculations.attendanceDeductionPct.toFixed(2)}%</span>
                        <span className="text-muted-foreground">Attendance Deduction $</span>
                        <span className="font-medium text-right text-red-600">-${calculations.attendanceDeduction.toFixed(2)}</span>
                        <span className="text-muted-foreground">Extra Deduction</span>
                        <span className="text-right">
                          <Input type="number" className="w-24 inline text-right" value={extraDeduction || ""}
                            onChange={e => setExtraDeduction(Number(e.target.value))} placeholder="0" />
                        </span>
                        <span className="text-muted-foreground font-semibold border-t pt-2">Total Deductions</span>
                        <span className="font-bold text-right text-red-600 border-t pt-2">-${calculations.totalDeductions.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Net Payout from primary */}
                    <div className="border rounded-lg p-4 bg-primary/5">
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <span className="font-bold text-base">NET PAYOUT (Primary Account)</span>
                        <span className={`font-bold text-right text-lg ${calculations.netPayout >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${calculations.netPayout.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Partner/Trainee Deductions from Primary Account */}
                    {calculations.partnerDeductions.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                          {calculations.partnerDeductions.some(d => d.role.toLowerCase() === "partner") ? "Partner Share" : "Trainee Share"} Deductions
                        </h3>
                        <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                          {calculations.partnerDeductions.map((d, idx) => (
                            <React.Fragment key={idx}>
                              <span className="text-muted-foreground">
                                {d.role.toLowerCase() === "partner" ? `Partner Share 50%` : `Trainee Share 25%`} — {d.name}
                              </span>
                              <span className="font-medium text-right text-orange-600">-${d.amount.toFixed(2)}</span>
                            </React.Fragment>
                          ))}
                          <span className="text-muted-foreground font-semibold border-t pt-2">Total Deducted</span>
                          <span className="font-bold text-right text-orange-600 border-t pt-2">-${calculations.totalPartnerDeduction.toFixed(2)}</span>
                          <span className="text-muted-foreground font-semibold">Trader Keeps</span>
                          <span className="font-bold text-right text-green-600">${calculations.traderKeepsFromPrimary.toFixed(2)}</span>
                          {calculations.poolContribution > 0 && (
                            <>
                              <span className="text-muted-foreground text-xs italic">→ Trainee share added to Pool</span>
                              <span className="text-right text-xs italic text-blue-600">${calculations.poolContribution.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Trader2/Trainee Earnings from other accounts */}
                {calculations.trader2Earnings.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Earnings as Partner/Trainee
                    </h3>
                    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                      {calculations.trader2Earnings.map((earning, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-y-1 text-sm">
                          <span className="text-muted-foreground">From Account of</span>
                          <span className="font-medium text-right">{earning.primaryTraderName}</span>
                          <span className="text-muted-foreground">Account P&L</span>
                          <span className={`font-medium text-right ${earning.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ${earning.pnl.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">Role ({earning.role} — {earning.splitPct}%)</span>
                          <span className="font-medium text-right">{earning.splitPct}%</span>
                          <span className="text-muted-foreground font-semibold border-t pt-1">Earnings</span>
                          <span className={`font-bold text-right border-t pt-1 ${earning.earnings >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ${earning.earnings.toFixed(2)}
                          </span>
                          {idx < calculations.trader2Earnings.length - 1 && <div className="col-span-2 border-b my-1" />}
                        </div>
                      ))}
                      {calculations.trader2Earnings.length > 0 && (
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="font-bold">Total Partner/Trainee Earnings</span>
                          <span className={`font-bold ${calculations.trader2Total >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ${calculations.trader2Total.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Combined Net Payout */}
                {(calculations.trader2Earnings.length > 0 || (tradingData.length > 0 && traderConfig)) && (
                  <div className="border-2 border-primary rounded-lg p-4 bg-primary/10">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="font-bold text-base">COMBINED NET PAYOUT</span>
                      <span className={`font-bold text-right text-xl ${calculations.combinedNetPayout >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${calculations.combinedNetPayout.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* INR Conversion & Settlement */}
                {(() => {
                  const finalUsd = calculations.combinedNetPayout;
                  const totalInr = finalUsd * inrRate;
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>INR Conversion Rate</Label>
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
                          <span className="text-muted-foreground font-medium">Total Payout (INR)</span>
                          <span className={`text-2xl font-bold ${totalInr >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₹{totalInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Payment Status */}
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
                          <p className="text-xs text-muted-foreground">
                            {paidCash || paidOnline ? "✅ Marked as paid" : "⏳ Unpaid — check when payment is completed"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 text-sm border-t pt-3">
                          <span className="text-muted-foreground">(-) Monthly Salary</span>
                          <span className="font-medium text-right text-orange-600">
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
                            ₹{(totalInr - monthlySalaryInput - cashPaidInput - bankPaidInput).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Trading Days: {calculations.tradingDays}</span>
                </div>

                <Button onClick={handleSavePayout} className="w-full gap-2">
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
