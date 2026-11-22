import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileText, TrendingUp, Clock, Lock, Unlock, AlertTriangle, Loader2, Users } from "lucide-react";
import { getLeaveBalanceSummary } from "@/lib/payoutCalculations";
import {
  computeHistory,
  nextLevelAfter,
  shareOfRow,
  DEFAULT_SEAT_COST,
  type TradeRow,
  type MonthConfig,
} from "@/lib/payoutEngine";
import { fetchAllRows, localDateKey } from "@/lib/fetchAllRows";
import { mergeAttendance } from "@/lib/attendance";
import { getPersonTradeRows } from "@/lib/tradeCache";
import { loadTransfers, transfersNetByMonth, type PnlTransfer } from "@/lib/pnlTransfers";
import { saveTraderMonth, saveExchangeRate } from "@/lib/payoutSave";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";
import PayoutCalendarHeatmap from "./PayoutCalendarHeatmap";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_role?: string;
}

interface PayoutSheetProps {
  users: Profile[];
  initialTraderId?: string;
  initialMonth?: number;
  initialYear?: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
/** 1st of the month `offset` months after (y, m), as a local date key. */
const firstOfMonthAfter = (y: number, m: number, offset: number) => localDateKey(new Date(y, m - 1 + offset, 1));
const r2 = (n: number) => Math.round(n * 100) / 100;

const PayoutSheet = ({ users, initialTraderId, initialMonth, initialYear }: PayoutSheetProps) => {
  const { toast } = useToast();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [selectedTrader, setSelectedTrader] = useState(initialTraderId || "");
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || currentMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear || currentYear);

  useEffect(() => {
    if (initialTraderId) setSelectedTrader(initialTraderId);
    if (initialMonth) setSelectedMonth(initialMonth);
    if (initialYear) setSelectedYear(initialYear);
  }, [initialTraderId, initialMonth, initialYear]);

  // Loaded data
  const [loading, setLoading] = useState(false);
  // Trader + month the loaded data belongs to (auto-save only saves matching data).
  const [loadedFor, setLoadedFor] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<TradeRow[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [joiningDate, setJoiningDate] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ asOfDate: string; days: number; netProfit: number } | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [carryForwardDays, setCarryForwardDays] = useState(0);
  const [existingSto, setExistingSto] = useState<any>(null);
  const [existingLto, setExistingLto] = useState<any>(null);
  const [ltoHistory, setLtoHistory] = useState<any[]>([]);
  const [existingRecord, setExistingRecord] = useState<any>(null);

  // Editable inputs
  const [seatCostInput, setSeatCostInput] = useState(DEFAULT_SEAT_COST);
  const [leavePctInput, setLeavePctInput] = useState<string>("");
  const [inrRate, setInrRate] = useState(84);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [paidCash, setPaidCash] = useState(false);
  const [paidOnline, setPaidOnline] = useState(false);
  const [monthlySalaryInput, setMonthlySalaryInput] = useState(0);
  const [cashPaidInput, setCashPaidInput] = useState(0);
  const [bankPaidInput, setBankPaidInput] = useState(0);
  const [unlockPaid, setUnlockPaid] = useState(false);
  const [saving, setSaving] = useState<"month" | "payment" | "adjustment" | null>(null);
  // Adjustments
  const [transfers, setTransfers] = useState<PnlTransfer[]>([]);
  const [transfersAvailable, setTransfersAvailable] = useState(true);
  const [adjOther, setAdjOther] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const selectedKey = monthKey(selectedYear, selectedMonth);

  const fetchPayoutData = useCallback(async () => {
    if (!selectedTrader) return;
    setLoading(true);
    setLoadError(null);
    setUnlockPaid(false);
    const id = selectedTrader;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const monthEnd = `${selectedKey}-${String(lastDay).padStart(2, "0")}`;

    try {
      // One round trip: the trade history comes from the shared cache (the Admin
      // page has usually loaded it already), everything else is fetched together.
      const [personRows, transferRes, profileRes, baselineRes, configRes, attendanceRes, carryRes, stoRes, ltoRes, ltoHistRes, recordRes, rateRes] =
        await Promise.all([
          getPersonTradeRows(id),
          loadTransfers(id),
          supabase.from("profiles").select("joining_date").eq("user_id", id).maybeSingle(),
          supabase.from("trader_baselines").select("as_of_date, baseline_days, baseline_net_profit").eq("user_id", id).maybeSingle(),
          supabase.from("trader_config").select("*").eq("user_id", id),
          supabase.from("attendance_records").select("id, record_date, status, is_deductible, notes").eq("user_id", id)
            .gte("record_date", `${selectedYear}-01-01`).lte("record_date", monthEnd),
          supabase.from("leave_carry_forward").select("carry_forward_days").eq("user_id", id).eq("year", selectedYear).maybeSingle(),
          supabase.from("sto_ledger").select("*").eq("user_id", id).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
          supabase.from("lto_ledger").select("*").eq("user_id", id).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
          supabase.from("lto_ledger").select("*").eq("user_id", id)
            .order("year", { ascending: false }).order("month", { ascending: false }).limit(24),
          supabase.from("payout_records").select("*").eq("user_id", id).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
          supabase.from("monthly_exchange_rates").select("usd_to_inr").eq("month", selectedMonth).eq("year", selectedYear).maybeSingle(),
        ]);
      if (transferRes.error) throw new Error(transferRes.error);
      setTransfers(transferRes.rows);
      setTransfersAvailable(transferRes.available);
      const failed = [profileRes, baselineRes, configRes, attendanceRes, carryRes, stoRes, ltoRes, ltoHistRes, recordRes, rateRes].find(
        (r) => r.error
      );
      if (failed?.error) throw new Error(failed.error.message);

      // A row can appear in both lists if the trader is somehow both; de-duplicate by id.
      setAllRows(personRows);
      setJoiningDate(profileRes.data?.joining_date ?? null);
      setBaseline(
        baselineRes.data
          ? {
              asOfDate: baselineRes.data.as_of_date,
              days: Number(baselineRes.data.baseline_days) || 0,
              netProfit: Number(baselineRes.data.baseline_net_profit) || 0,
            }
          : null
      );
      setConfigs(configRes.data ?? []);
      setAttendance(attendanceRes.data ?? []);
      setCarryForwardDays(Number(carryRes.data?.carry_forward_days) || 0);
      setExistingSto(stoRes.data);
      setExistingLto(ltoRes.data);
      setLtoHistory(ltoHistRes.data ?? []);

      const cfg = (configRes.data ?? []).find((c: any) => c.month === selectedMonth && c.year === selectedYear);
      setSeatCostInput(cfg?.software_cost != null ? Number(cfg.software_cost) : DEFAULT_SEAT_COST);
      // A saved month keeps the leave % the admin chose; otherwise use the calculated one.
      setLeavePctInput(stoRes.data ? String(Number(stoRes.data.leave_deduction_percent) || 0) : "");
      if (rateRes.data?.usd_to_inr) setInrRate(Number(rateRes.data.usd_to_inr));

      const rec = recordRes.data;
      setExistingRecord(rec);
      setPaidCash(!!rec?.paid_cash);
      setPaidOnline(!!rec?.paid_online);
      setPayoutNotes(rec?.notes || "");
      setMonthlySalaryInput(Number(rec?.salary) || 0);
      setCashPaidInput(Number(rec?.advance_cash) || 0);
      setBankPaidInput(Number(rec?.bank_transfer) || 0);
      setLoadedFor(`${id}|${selectedKey}`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedTrader, selectedMonth, selectedYear, selectedKey]);

  useEffect(() => {
    void fetchPayoutData();
  }, [fetchPayoutData]);

  // Leave deduction suggested by the leave rules for this month. Uses attendance
  // records plus the attendance chosen on trade entries (same as admin Leaves).
  const calculatedLeavePct = useMemo(() => {
    const yearRows = allRows.filter((r) => r.trade_date.startsWith(`${selectedYear}-`)) as any[];
    const merged = mergeAttendance(
      attendance.map((a: any) => ({ ...a, user_id: selectedTrader })),
      yearRows
    ).filter((a) => a.user_id === selectedTrader);
    // Same calculation as the trader's leave tab and admin Leaves (accrues from the joining month).
    return getLeaveBalanceSummary(merged, selectedMonth, selectedYear, carryForwardDays, joiningDate).deductionPercent;
  }, [attendance, allRows, selectedTrader, selectedMonth, selectedYear, carryForwardDays, joiningDate]);
  const leavePct = leavePctInput === "" ? calculatedLeavePct : Math.max(0, Number(leavePctInput) || 0);

  // Full history through the selected month, using the shared payout engine.
  const history = useMemo(() => {
    if (!selectedTrader) return null;
    const cfgByKey = new Map(configs.map((c: any) => [monthKey(c.year, c.month), c]));
    const transferNet = transfersNetByMonth(selectedTrader, transfers);
    return computeHistory({
      personId: selectedTrader,
      rows: allRows,
      throughMonth: selectedKey,
      startMonth: joiningDate ? joiningDate.slice(0, 7) : null,
      baseline,
      configFor: (key): MonthConfig => {
        const c = cfgByKey.get(key);
        return {
          seatCost: key === selectedKey ? seatCostInput : c?.software_cost != null ? Number(c.software_cost) : DEFAULT_SEAT_COST,
          mode: c?.config_mode,
          stoPercent: c?.sto_percentage != null ? Number(c.sto_percentage) : undefined,
          ltoPercent: c?.lto_percentage != null ? Number(c.lto_percentage) : undefined,
          leavePct: key === selectedKey ? leavePct : 0,
          transfersNet: transferNet.get(key) ?? 0,
        };
      },
    });
  }, [selectedTrader, allRows, selectedKey, joiningDate, baseline, configs, seatCostInput, leavePct, transfers]);

  const monthTransfers = transfers.filter(
    (t) =>
      t.month === selectedMonth &&
      t.year === selectedYear &&
      (t.from_user_id === selectedTrader || t.to_user_id === selectedTrader)
  );
  const nameOf = (uid: string) => users.find((u) => u.user_id === uid)?.full_name || "Unknown";
  const selectedTraderName = nameOf(selectedTrader);

  const month = history?.byMonth.get(selectedKey) ?? null;

  // Rows of the selected month (for the calendar and partner list)
  const monthRows = useMemo(() => allRows.filter((r) => r.trade_date.startsWith(selectedKey)), [allRows, selectedKey]);
  const primaryRows = monthRows.filter((r) => r.user_id === selectedTrader);
  const partnerRows = monthRows.filter((r) => r.user_id !== selectedTrader);

  const partners = useMemo(() => {
    const days = new Map<string, Set<string>>();
    monthRows.forEach((r) => {
      const s = shareOfRow(selectedTrader, r);
      if (s?.together && s.partnerId) {
        if (!days.has(s.partnerId)) days.set(s.partnerId, new Set());
        days.get(s.partnerId)!.add(s.date);
      }
    });
    return [...days.entries()].map(([pid, set]) => ({
      name: users.find((u) => u.user_id === pid)?.full_name || "Unknown",
      days: set.size,
    }));
  }, [monthRows, selectedTrader, users]);

  const traderName = users.find((u) => u.user_id === selectedTrader)?.full_name || "";
  const isPaid = !!existingSto?.is_paid;
  const ltoReleased = !!existingLto?.is_released;
  const savedCfg = configs.find((c: any) => c.month === selectedMonth && c.year === selectedYear);
  const manualMode = savedCfg?.config_mode === "manual" && Number(savedCfg?.sto_percentage) > 0;

  // Has anything changed since the month was last saved?
  const unsaved = useMemo(() => {
    if (!month) return false;
    if (!existingSto) return month.tradingDays > 0 || month.netProfit !== 0;
    return (
      Math.abs(Number(existingSto.final_sto_amount) - r2(month.finalSto)) > 0.01 ||
      Math.abs(Number(existingSto.net_profit) - r2(month.netProfit)) > 0.01 ||
      Math.abs(Number(existingLto?.lto_amount ?? 0) - r2(month.finalLto)) > 0.01
    );
  }, [month, existingSto, existingLto]);

  const saveMonth = async (auto = false) => {
    if (!month || !selectedTrader) return;
    if (isPaid && !unlockPaid) return;
    setSaving("month");
    try {
      await saveExchangeRate(selectedYear, selectedMonth, inrRate);
      await saveTraderMonth({ userId: selectedTrader, year: selectedYear, month: selectedMonth, result: month, seatCost: seatCostInput });
      if (!auto) toast({ title: "Month saved", description: `${traderName} — ${MONTHS[selectedMonth - 1]} ${selectedYear}` });
      await fetchPayoutData();
    } catch (e: any) {
      toast({ title: "Couldn't save the month", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  // Saves by itself a moment after the figures change. Paid months are left
  // alone, and a month with adjustments from other traders waits for Save.
  const hasAdjustments = monthTransfers.length > 0;
  const autoSavedRef = React.useRef("");
  const currentFor = `${selectedTrader}|${selectedKey}`;
  useEffect(() => {
    if (!unsaved || loading || saving !== null || loadError || hasAdjustments) return;
    if (loadedFor !== currentFor || (isPaid && !unlockPaid)) return;
    // Never retry the same figures (e.g. a released LTO that can't change).
    const signature = `${currentFor}|${month?.finalSto}|${month?.netProfit}|${month?.finalLto}|${seatCostInput}|${inrRate}`;
    if (autoSavedRef.current === signature) return;
    const timer = setTimeout(() => {
      autoSavedRef.current = signature;
      void saveMonth(true);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsaved, loading, saving, loadError, hasAdjustments, loadedFor, currentFor, isPaid, unlockPaid, month, seatCostInput, inrRate]);

  // ---------- Adjustments (P&L moved between traders) ----------
  // "+500" = this trader gets $500 from the chosen trader; "-500" = this trader gives $500 to them.
  const adjValue = (() => {
    const t = adjAmount.replace(/[\s,$]/g, "").replace("\u2212", "-");
    if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return 0;
    return Math.round(Number(t) * 100) / 100;
  })();
  const adjReady = adjValue !== 0 && !!adjOther;

  const addAdjustment = async () => {
    if (!adjReady || saving !== null) return;
    const amount = Math.abs(adjValue);
    setSaving("adjustment");
    const give = adjValue < 0;
    const { error } = await supabase.from("pnl_transfers").insert({
      month: selectedMonth,
      year: selectedYear,
      from_user_id: give ? selectedTrader : adjOther,
      to_user_id: give ? adjOther : selectedTrader,
      amount,
      note: adjNote.trim() || null,
    });
    setSaving(null);
    if (error) {
      toast({ title: "Couldn't add the adjustment", description: error.message, variant: "destructive" });
      return;
    }
    setAdjAmount("");
    setAdjNote("");
    toast({ title: "Adjustment added", description: "It also appears on the other trader's sheet. Save both months." });
    await fetchPayoutData();
  };

  const removeAdjustment = async (id: string) => {
    setSaving("adjustment");
    const { error } = await supabase.from("pnl_transfers").delete().eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Couldn't remove the adjustment", description: error.message, variant: "destructive" });
      return;
    }
    await fetchPayoutData();
  };

  const savePayment = async () => {
    if (!month) return;
    setSaving("payment");
    try {
      const totalInr = month.finalSto * inrRate;
      const res = await supabase.from("payout_records").upsert(
        {
          user_id: selectedTrader,
          month: selectedMonth,
          year: selectedYear,
          salary: monthlySalaryInput,
          cash_component: r2(totalInr),
          bank_transfer: bankPaidInput,
          advance_cash: cashPaidInput,
          advance_bank: 0,
          notes: payoutNotes || null,
          paid_cash: paidCash,
          paid_online: paidOnline,
        },
        { onConflict: "user_id,month,year" }
      );
      if (res.error) throw res.error;
      toast({ title: "Payment record saved" });
      await fetchPayoutData();
    } catch (e: any) {
      toast({ title: "Couldn't save the payment record", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const fmt = (val: number) => `${val < 0 ? "-" : ""}${formatCurrencyINR(Math.abs(val), "$")}`;
  const neg = (val: number) => `-${formatCurrencyINR(Math.abs(val), "$")}`;
  const Row = ({ label, value, tone, strong }: { label: React.ReactNode; value: React.ReactNode; tone?: string; strong?: boolean }) => (
    <>
      <span className={`text-muted-foreground ${strong ? "font-semibold border-t pt-2" : ""}`}>{label}</span>
      <span className={`text-right ${strong ? "font-bold border-t pt-2" : "font-medium"} ${tone ?? ""}`}>{value}</span>
    </>
  );

  const endDays = month ? month.daysBefore + month.tradingDays : 0;
  const endProfit = month ? month.profitBefore + month.netProfit : 0;
  const next = month ? nextLevelAfter(month.level.level) : null;

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
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTrader && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex flex-wrap items-center justify-between gap-2">
              <span>{traderName} — {MONTHS[selectedMonth - 1]} {selectedYear}</span>
              {month && (
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {manualMode ? "Manual" : `L${month.level.level} ${month.level.label}`} · STO {month.stoPercent}% / LTO {month.ltoPercent}%
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : loadError ? (
              <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-4 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium">Couldn't load this trader's data, so nothing is calculated.</p>
                  <p className="text-muted-foreground">{loadError}</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => void fetchPayoutData()}>Try again</Button>
                </div>
              </div>
            ) : !month ? (
              <div className="text-center py-8 text-muted-foreground">No data for this month.</div>
            ) : (
              <>
                {isPaid && (
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <span>This month's STO is marked <strong>paid</strong>, so it isn't updated automatically.</span>
                    <label className="ml-auto flex items-center gap-2">
                      <Checkbox checked={unlockPaid} onCheckedChange={(v) => setUnlockPaid(!!v)} />
                      Allow changes
                    </label>
                  </div>
                )}

                {/* Level */}
                {next && (
                  <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Progress to L{next.level} {next.label} (days OR profit)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Net profit: {fmt(endProfit)} / {fmt(next.profitRequired)}
                        </p>
                        <Progress value={Math.max(0, Math.min(100, (endProfit / next.profitRequired) * 100))} className="h-2" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Trading days: {endDays} / {next.daysRequired}
                        </p>
                        <Progress value={Math.min(100, (endDays / next.daysRequired) * 100)} className="h-2" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This month is paid at the level reached by its first day. Totals above include this month.
                    </p>
                  </div>
                )}

                {/* Seating */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {partners.length === 0 ? (
                    <span>Sat alone all month · {month.tradingDays} trading days</span>
                  ) : (
                    <span>
                      {partners.map((p) => `With ${p.name}: ${p.days} day${p.days === 1 ? "" : "s"}`).join(" · ")}
                      {" · "}Solo: {month.soloDays} day{month.soloDays === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {/* P&L */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Net profit</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                    <Row
                      label={month.partnered ? "Your P&L (together days split 50/50)" : "Gross P&L"}
                      value={fmt(month.grossPnl)}
                      tone={month.grossPnl >= 0 ? "text-green-600" : "text-red-600"}
                    />
                    <Row label={`Share cost (${formatIndian(Math.round(month.shares))} shares × $14/1000)`} value={neg(month.shareCost)} tone="text-orange-600" />
                    <span className="text-muted-foreground">
                      Software cost{month.partnered ? " (seat cost ÷ 2, sat with a partner)" : ""}
                    </span>
                    <span className="flex items-center justify-end gap-2 font-medium text-orange-600">
                      <span className="text-xs text-muted-foreground">Seat $</span>
                      <Input
                        type="number"
                        className="w-24 text-right"
                        value={seatCostInput}
                        onChange={(e) => setSeatCostInput(Math.max(0, Number(e.target.value) || 0))}
                        aria-label="Seat software cost"
                      />
                      {neg(month.softwareCost)}
                    </span>
                    {(transfersAvailable || monthTransfers.length > 0) && (
                      <Row label="Net profit before adjustments" value={fmt(month.netProfit - month.transfersNet)} strong />
                    )}
                    {monthTransfers.length > 0 && (
                      <>
                        {monthTransfers.map((t) => {
                          const incoming = t.to_user_id === selectedTrader;
                          return (
                            <React.Fragment key={t.id}>
                              <span className="text-muted-foreground">
                                {incoming ? `From ${nameOf(t.from_user_id)}` : `To ${nameOf(t.to_user_id)}`}
                                {t.note && <span className="block text-xs">{t.note}</span>}
                              </span>
                              <span className={`flex items-center justify-end gap-2 font-medium ${incoming ? "text-green-600" : "text-red-600"}`}>
                                {incoming ? "+" : "−"}{formatCurrencyINR(t.amount, "$")}
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground underline hover:text-red-600"
                                  onClick={() => void removeAdjustment(t.id)}
                                  disabled={saving !== null}
                                  aria-label="Remove adjustment"
                                >
                                  remove
                                </button>
                              </span>
                            </React.Fragment>
                          );
                        })}
                      </>
                    )}
                    {/* Move net profit to / from another trader (hidden until the database supports it) */}
                    {transfersAvailable && (
                    <div className="col-span-2 rounded-md border border-dashed bg-background p-2">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              inputMode="decimal"
                              className="h-8 w-40 text-right"
                              placeholder="+ or − amount ($)"
                              aria-label="Adjustment amount, + or −"
                              value={adjAmount}
                              onChange={(e) => setAdjAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void addAdjustment();
                                }
                              }}
                            />
                            {adjValue !== 0 && (
                              <>
                                <span className="text-sm text-muted-foreground">{adjValue > 0 ? "from" : "to"}</span>
                                <Select value={adjOther} onValueChange={setAdjOther}>
                                  <SelectTrigger className="h-8 w-[180px]" aria-label="Other trader"><SelectValue placeholder="Select trader" /></SelectTrigger>
                                  <SelectContent>
                                    {users.filter((u) => u.user_id !== selectedTrader).map((u) => (
                                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  className="h-8 min-w-[120px] flex-1"
                                  maxLength={500}
                                  placeholder="Note (optional)"
                                  aria-label="Adjustment note"
                                  value={adjNote}
                                  onChange={(e) => setAdjNote(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void addAdjustment();
                                    }
                                  }}
                                />
                                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void addAdjustment()} disabled={saving !== null || !adjReady}>
                                  {saving === "adjustment" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                </Button>
                              </>
                            )}
                          </div>
                          {adjValue === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Type +500 to add $500 from another trader, or −500 to move $500 to another trader.
                            </p>
                          ) : adjOther ? (
                            <p className="text-xs text-muted-foreground">
                              {adjValue > 0
                                ? `${selectedTraderName} +${formatCurrencyINR(Math.abs(adjValue), "$")} · ${nameOf(adjOther)} −${formatCurrencyINR(Math.abs(adjValue), "$")} (shows on their sheet as "To ${selectedTraderName}")`
                                : `${selectedTraderName} −${formatCurrencyINR(Math.abs(adjValue), "$")} · ${nameOf(adjOther)} +${formatCurrencyINR(Math.abs(adjValue), "$")} (shows on their sheet as "From ${selectedTraderName}")`}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Choose the trader {adjValue > 0 ? "it comes from" : "it goes to"}.</p>
                          )}
                        </div>
                    </div>
                    )}
                    <Row label={transfersAvailable || monthTransfers.length > 0 ? "Final net profit" : "Net profit"} value={fmt(month.netProfit)} tone={month.netProfit >= 0 ? "text-green-600" : "text-red-600"} strong />
                    {month.priorDeficit > 0 && (
                      <>
                        <Row label="Earlier losses still to recover" value={neg(month.priorDeficit)} tone="text-red-600" />
                        <Row label="Profit STO is paid on" value={fmt(month.stoBase)} strong />
                      </>
                    )}
                    {month.deficitAfter > 0 && (
                      <Row label="Loss carried to next month" value={fmt(month.deficitAfter)} tone="text-red-600" />
                    )}
                  </div>
                </div>

                {/* STO */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> STO — {month.stoPercent}%
                  </h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                    <Row label={`STO (${month.stoPercent}%)`} value={fmt(month.sto)} tone="text-green-600" />
                    <span className="text-muted-foreground">
                      Leave deduction
                      <span className="block text-xs">
                        Rules suggest {calculatedLeavePct.toFixed(1)}%
                        {leavePctInput !== "" && Number(leavePctInput) !== calculatedLeavePct && (
                          <button type="button" className="ml-2 underline" onClick={() => setLeavePctInput("")}>use suggested</button>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center justify-end gap-2 font-medium text-red-600">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        className="w-20 text-right"
                        value={leavePctInput === "" ? String(calculatedLeavePct) : leavePctInput}
                        onChange={(e) => setLeavePctInput(e.target.value)}
                        aria-label="Leave deduction percent"
                      />
                      % {neg(month.leaveDeductionSto)}
                    </span>
                    <Row
                      label={month.partnered ? "Second-PC 25% (solo days only)" : "Second-PC 25%"}
                      value={neg(month.secondPcShare)}
                      tone="text-blue-600"
                    />
                    <Row label="Final STO" value={fmt(month.finalSto)} tone="text-green-600" strong />
                    <Row
                      label={<span className="text-xs italic">Payable</span>}
                      value={<span className="text-xs italic text-primary">around 5–10 {MONTHS[(selectedMonth + 2) % 12]} {selectedMonth + 3 > 12 ? selectedYear + 1 : selectedYear}</span>}
                    />
                  </div>
                </div>

                {/* LTO */}
                {month.ltoPercent > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" /> LTO — {month.ltoPercent}%
                    </h3>
                    <div className="grid grid-cols-2 gap-y-2 text-sm border rounded-lg p-4 bg-muted/20">
                      <Row label={`LTO (${month.ltoPercent}% of net profit)`} value={fmt(month.lto)} tone={month.lto >= 0 ? "text-green-600" : "text-red-600"} />
                      {month.leaveDeductionLto > 0 && <Row label={`Leave deduction (${month.leavePct}%)`} value={neg(month.leaveDeductionLto)} tone="text-red-600" />}
                      <Row label="Final LTO" value={fmt(month.finalLto)} tone={month.finalLto >= 0 ? "text-green-600" : "text-red-600"} strong />
                      <Row
                        label={<span className="text-xs italic">Unlocks</span>}
                        value={<span className="text-xs italic text-primary">{MONTHS[selectedMonth - 1]} {selectedYear + 1}, once the LTO pool reaches {fmt(month.level.ltoReleaseMin)}</span>}
                      />
                    </div>
                    {ltoReleased && <p className="text-xs text-amber-600">This month's LTO was already released, so saving won't change it.</p>}
                  </div>
                )}

                {/* Save status: saves by itself; Save only when other traders' amounts are involved */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {hasAdjustments && unsaved && !(isPaid && !unlockPaid) ? (
                    <>
                      <SaveButton onClick={() => void saveMonth()} saving={saving === "month"} disabled={saving !== null} />
                      <span className="text-amber-600">Includes amounts from other traders — press Save to confirm.</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {saving === "month"
                        ? "Saving…"
                        : isPaid && !unlockPaid
                          ? "Paid — not updated automatically."
                          : unsaved
                            ? "Saving shortly…"
                            : "Saved automatically."}
                    </span>
                  )}
                </div>

                {/* LTO history */}
                {ltoHistory.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" /> LTO lock schedule
                    </h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">Period</th>
                            <th className="text-right p-2">LTO amount</th>
                            <th className="text-right p-2">Unlock date</th>
                            <th className="text-center p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ltoHistory.map((l: any) => {
                            const isUnlocked = l.unlock_date <= localDateKey(new Date());
                            return (
                              <tr key={l.id} className="border-t">
                                <td className="p-2">{MONTHS[(l.month || 1) - 1]} {l.year}</td>
                                <td className={`p-2 text-right font-medium ${Number(l.lto_amount) < 0 ? "text-red-600" : ""}`}>{fmt(Number(l.lto_amount))}</td>
                                <td className="p-2 text-right text-muted-foreground">{l.unlock_date}</td>
                                <td className="p-2 text-center">
                                  <Badge variant={l.is_released ? "default" : isUnlocked ? "outline" : "secondary"} className="text-xs gap-1">
                                    {l.is_released ? <><Unlock className="h-3 w-3" /> Released</> : isUnlocked ? <><Unlock className="h-3 w-3" /> Unlocked</> : <><Lock className="h-3 w-3" /> Locked</>}
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

                {/* INR settlement */}
                {(() => {
                  const totalInr = month.finalSto * inrRate;
                  const outstanding = totalInr - monthlySalaryInput - cashPaidInput - bankPaidInput;
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="inr-rate">USD → INR rate</Label>
                          <Input id="inr-rate" type="number" step="0.01" value={inrRate} onChange={(e) => setInrRate(Number(e.target.value) || 0)} />
                          <p className="text-xs text-muted-foreground">Saved with the month.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payout-notes">Notes</Label>
                          <Textarea id="payout-notes" value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} placeholder="Payout notes..." rows={3} />
                        </div>
                      </div>

                      <div className="border rounded-lg p-5 bg-primary/5 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground font-medium">Final STO in INR</span>
                          <span className={`text-2xl font-bold ${totalInr >= 0 ? "text-green-600" : "text-red-600"}`}>₹{formatIndian(totalInr, 2)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-6 border-t pt-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={paidCash} onCheckedChange={(v) => setPaidCash(!!v)} />
                            <span className="text-sm font-medium">Cash paid</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={paidOnline} onCheckedChange={(v) => setPaidOnline(!!v)} />
                            <span className="text-sm font-medium">Online paid</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-sm border-t pt-3 items-center">
                          <Label htmlFor="pay-salary" className="text-muted-foreground font-normal">(−) Monthly salary</Label>
                          <Input id="pay-salary" type="number" className="w-28 justify-self-end text-right" value={monthlySalaryInput || ""} onChange={(e) => setMonthlySalaryInput(Number(e.target.value) || 0)} placeholder="0" />
                          <Label htmlFor="pay-cash" className="text-muted-foreground font-normal">(−) Cash paid</Label>
                          <Input id="pay-cash" type="number" className="w-28 justify-self-end text-right" value={cashPaidInput || ""} onChange={(e) => setCashPaidInput(Number(e.target.value) || 0)} placeholder="0" />
                          <Label htmlFor="pay-bank" className="text-muted-foreground font-normal">(−) Bank transfer</Label>
                          <Input id="pay-bank" type="number" className="w-28 justify-self-end text-right" value={bankPaidInput || ""} onChange={(e) => setBankPaidInput(Number(e.target.value) || 0)} placeholder="0" />
                        </div>
                        <div className="flex justify-between items-center border-t pt-3">
                          <span className="font-bold text-base">Outstanding</span>
                          <span className={`text-xl font-bold ${outstanding >= 0 ? "text-green-600" : "text-red-600"}`}>₹{formatIndian(outstanding, 2)}</span>
                        </div>
                        <SaveButton onClick={savePayment} saving={saving === "payment"} disabled={saving !== null} className="w-full">
                          Save payment record
                        </SaveButton>
                        {existingRecord && <p className="text-xs text-muted-foreground text-center">A payment record exists for this month.</p>}
                      </div>
                    </div>
                  );
                })()}

                <PayoutCalendarHeatmap primaryTrades={primaryRows} partnerTrades={partnerRows} month={selectedMonth} year={selectedYear} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayoutSheet;
