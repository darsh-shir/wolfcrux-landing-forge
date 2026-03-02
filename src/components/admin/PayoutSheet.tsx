import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<any>(null);
  const [extraDeduction, setExtraDeduction] = useState(0);
  const [inrRate, setInrRate] = useState(84);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (selectedTrader) fetchPayoutData();
  }, [selectedTrader, selectedMonth, selectedYear]);

  const fetchPayoutData = async () => {
    setLoading(true);

    const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const monthEnd = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-31`;

    const [configRes, tradesRes, attendRes, leaveRes] = await Promise.all([
      supabase.from("trader_config").select("*").eq("user_id", selectedTrader).maybeSingle(),
      supabase.from("trading_data").select("*")
        .eq("user_id", selectedTrader)
        .gte("trade_date", monthStart)
        .lte("trade_date", monthEnd),
      supabase.from("attendance_records").select("*")
        .eq("user_id", selectedTrader)
        .gte("record_date", monthStart)
        .lte("record_date", monthEnd),
      supabase.from("monthly_leave_summary").select("*")
        .eq("user_id", selectedTrader)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle(),
    ]);

    setTraderConfig(configRes.data);
    setTradingData(tradesRes.data || []);
    setAttendanceData(attendRes.data || []);
    setLeaveSummary(leaveRes.data);
    setLoading(false);
  };

  const calculations = useMemo(() => {
    if (!traderConfig) {
      return {
        totalPnl: 0, totalShares: 0, shareCharge: 0, softwareCost: 0,
        grossAmount: 0, payoutPct: 0, tradersShare: 0,
        attendanceDeductionPct: 0, attendanceDeduction: 0,
        totalDeductions: 0, netPayout: 0,
        partnerName: "", partnerPct: 0, partnerGets: 0, traderKeeps: 0,
        tradingDays: 0,
      };
    }

    const totalPnl = tradingData.reduce((sum, t) => sum + Number(t.net_pnl), 0);
    const totalShares = tradingData.reduce((sum, t) => sum + Number(t.shares_traded), 0);
    const shareCharge = (totalShares / 1000) * 14;
    const softwareCost = Number(traderConfig.software_cost) || 0;
    const grossAmount = totalPnl - shareCharge - softwareCost;
    const payoutPct = Number(traderConfig.payout_percentage) / 100;
    const tradersShare = grossAmount * payoutPct;
    const tradingDays = tradingData.filter(t => !t.is_holiday).length;

    // Attendance deduction from leave summary
    let attendanceDeductionPct = 0;
    if (leaveSummary) {
      const usedFull = Number(leaveSummary.used_full_days) || 0;
      const usedHalf = Number(leaveSummary.used_half_days) || 0;
      const lateCount = Number(leaveSummary.late_count) || 0;
      const allowedFull = Number(leaveSummary.allowed_full_days) || 1;
      const allowedHalf = Number(leaveSummary.allowed_half_days) || 1;

      // Convert lates to half days (3 lates = 1 half day)
      const lateHalfDays = Math.floor(lateCount / 3);
      const totalHalfDaysUsed = usedHalf + lateHalfDays;

      // Deductible days (exceeding allowance)
      const excessFull = Math.max(0, usedFull - allowedFull);
      const excessHalf = Math.max(0, totalHalfDaysUsed - allowedHalf);

      attendanceDeductionPct = (excessFull * 4) + (excessHalf * 2);
    } else {
      // Fallback: compute from trading_data attendance fields
      const lates = tradingData.filter(t => t.trader1_attendance === "late").length;
      const halfDays = tradingData.filter(t => t.trader1_attendance === "half_day").length;
      const absents = tradingData.filter(t => t.trader1_attendance === "absent").length;
      const lateHalfDays = Math.floor(lates / 3);
      const totalLeaves = absents + halfDays + lateHalfDays;
      const excessLeaves = Math.max(0, totalLeaves - 1.5);
      // Simplified: treat excess as half days
      attendanceDeductionPct = excessLeaves * 2;
    }

    const attendanceDeduction = tradersShare * (attendanceDeductionPct / 100);
    const totalDeductions = attendanceDeduction + extraDeduction;
    const netPayout = tradersShare - totalDeductions;

    // Partner split
    const partnerPct = Number(traderConfig.partner_percentage) / 100;
    const partnerGets = netPayout * partnerPct;
    const traderKeeps = netPayout - partnerGets;
    const partnerUser = users.find(u => u.user_id === traderConfig.partner_id);
    const partnerName = partnerUser?.full_name || "";

    return {
      totalPnl, totalShares, shareCharge, softwareCost, grossAmount,
      payoutPct: traderConfig.payout_percentage, tradersShare,
      attendanceDeductionPct, attendanceDeduction, totalDeductions,
      netPayout, partnerName, partnerPct: traderConfig.partner_percentage,
      partnerGets, traderKeeps, tradingDays,
    };
  }, [traderConfig, tradingData, leaveSummary, extraDeduction, users]);

  const traderName = users.find(u => u.user_id === selectedTrader)?.full_name || "";

  const handleSavePayout = async () => {
    if (!selectedTrader) return;

    const existing = await supabase.from("payout_records")
      .select("id")
      .eq("user_id", selectedTrader)
      .eq("month", selectedMonth)
      .eq("year", selectedYear)
      .maybeSingle();

    const payload = {
      user_id: selectedTrader,
      month: selectedMonth,
      year: selectedYear,
      salary: calculations.traderKeeps,
      cash_component: calculations.traderKeeps * inrRate,
      bank_transfer: 0,
      advance_cash: 0,
      advance_bank: 0,
      notes: payoutNotes || null,
    };

    if (existing.data?.id) {
      await supabase.from("payout_records").update(payload).eq("id", existing.data.id);
    } else {
      await supabase.from("payout_records").insert(payload);
    }

    toast({ title: "Saved", description: "Payout record saved" });
  };

  return (
    <div className="space-y-6">
      {/* Selection */}
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

      {/* Payout Breakdown */}
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
            ) : (
              <>
                {/* P&L Breakdown */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">P&L Breakdown</h3>
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

                {/* Net Payout */}
                <div className="border rounded-lg p-4 bg-primary/5">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="font-bold text-base">NET PAYOUT (Trader's Final)</span>
                    <span className={`font-bold text-right text-lg ${calculations.netPayout >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ${calculations.netPayout.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Partner Split */}
                {calculations.partnerName && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Partner Split</h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                      <span className="text-muted-foreground">Partner Name</span>
                      <span className="font-medium text-right">{calculations.partnerName}</span>
                      <span className="text-muted-foreground">Partner %</span>
                      <span className="font-medium text-right">{calculations.partnerPct}%</span>
                      <span className="text-muted-foreground">Partner Gets</span>
                      <span className="font-medium text-right">${calculations.partnerGets.toFixed(2)}</span>
                      <span className="text-muted-foreground font-semibold border-t pt-2">Trader Keeps ($)</span>
                      <span className="font-bold text-right border-t pt-2 text-green-600">${calculations.traderKeeps.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* INR + Notes + Save */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>INR Conversion Rate</Label>
                    <Input type="number" step="0.01" value={inrRate}
                      onChange={e => setInrRate(Number(e.target.value))} />
                    <p className="text-sm text-muted-foreground">
                      ₹{((calculations.partnerName ? calculations.traderKeeps : calculations.netPayout) * inrRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)}
                      placeholder="Payout notes..." rows={3} />
                  </div>
                </div>

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
