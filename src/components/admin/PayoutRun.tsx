import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/ui/save-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarCheck, Loader2, RefreshCw } from "lucide-react";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";
import { localDateKey, must } from "@/lib/fetchAllRows";
import { loadPayoutRun, type PayoutRunRow } from "@/lib/payoutRun";
import { invalidateTradeCache } from "@/lib/tradeCache";
import { saveExchangeRate, saveTraderMonth } from "@/lib/payoutSave";
import type { TablesInsert } from "@/integrations/supabase/types";
import { backupUsedFromNote, changeBackup, withBackupNote } from "@/lib/salary";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** STO earned in month M is paid around the 5th–10th of month M+3. */
export const defaultStoMonth = (today = new Date()) => {
  const d = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

interface Props {
  /** Open a trader's month in the Payout Sheet. */
  onOpenSheet?: (traderId: string, month: number, year: number) => void;
}

/**
 * One page for the monthly payout: every employee's final STO for the month
 * that is due now, with save-all and mark-paid, instead of opening each trader.
 */
const PayoutRun = ({ onOpenSheet }: Props) => {
  const { toast } = useToast();
  const initial = defaultStoMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [rows, setRows] = useState<PayoutRunRow[]>([]);
  const [rate, setRate] = useState(84);
  const [rateSaved, setRateSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Money typed per employee before marking paid (₹)
  const [money, setMoney] = useState<Record<string, { salary: string; online: string; cash: string }>>({});
  const [paidOn, setPaidOn] = useState<Record<string, string>>({});
  // Row waiting for the admin to decide whether its shortfall comes from salary backup.
  const [askBackup, setAskBackup] = useState<PayoutRunRow | null>(null);

  const payable = new Date(year, month - 1 + 3, 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadPayoutRun(year, month);
      setRows(data.rows);
      setRateSaved(data.usdToInr);
      if (data.usdToInr) setRate(data.usdToInr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);
  // Typed amounts belong to one month; start fresh when the month changes.
  useEffect(() => {
    setMoney({});
    setPaidOn({});
  }, [year, month]);

  const needsSave = rows.filter((r) => !r.isTrainee && (!r.saved || (r.changedSinceSave && !r.saved?.is_paid)));

  const isPaid = (r: PayoutRunRow) =>
    r.saved ? !!r.saved.is_paid : !!(r.payoutRecord && (r.payoutRecord.paid_cash || r.payoutRecord.paid_online));
  const finalStoUsd = (r: PayoutRunRow) =>
    r.isTrainee || !r.result ? 0 : r.saved ? Number(r.saved.final_sto_amount) : r.result.finalSto;
  const stoInr = (r: PayoutRunRow) => Math.round(finalStoUsd(r) * rate);

  /** Amounts for a row: what was typed, else what's saved, else the default salary. */
  const amounts = (r: PayoutRunRow) => {
    const typed = money[r.userId];
    const rec = r.payoutRecord;
    const salary = Number(typed?.salary ?? (rec ? rec.salary : r.defaultSalary)) || 0;
    const online = Number(typed?.online ?? (rec ? rec.bank_transfer : 0)) || 0;
    const cash = Number(typed?.cash ?? (rec ? rec.advance_cash : 0)) || 0;
    const balance = stoInr(r) - salary - online - cash;
    return { salary, online, cash, balance };
  };
  const setAmount = (r: PayoutRunRow, field: "salary" | "online" | "cash", value: string) => {
    const a = amounts(r);
    setMoney((m) => ({
      ...m,
      [r.userId]: { salary: String(a.salary), online: String(a.online), cash: String(a.cash), ...m[r.userId], [field]: value },
    }));
  };
  const restTo = (r: PayoutRunRow, field: "online" | "cash") => {
    const a = amounts(r);
    const other = field === "online" ? a.cash : a.online;
    setAmount(r, field, String(Math.max(0, stoInr(r) - a.salary - other)));
  };

  const totals = useMemo(() => {
    let sto = 0, salary = 0, online = 0, cash = 0, fromBackup = 0, fromPool = 0, left = 0, paidCount = 0;
    for (const r of rows) {
      const a = amounts(r);
      sto += stoInr(r);
      salary += a.salary;
      online += a.online;
      cash += a.cash;
      if (r.isTrainee) fromPool += a.salary + a.online + a.cash;
      else fromBackup += backupUsedFromNote(r.payoutRecord?.notes);
      if (isPaid(r)) paidCount++;
      else if (!r.isTrainee && a.balance > 0) left += a.balance + a.salary + a.online + a.cash;
      else if (!isPaid(r)) left += a.salary + a.online + a.cash;
    }
    return { sto, salary, online, cash, fromBackup, fromPool, left, paidCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, money, rate]);

  const saveRate = async () => {
    setBusy("rate");
    try {
      await saveExchangeRate(year, month, rate);
      setRateSaved(rate);
      toast({ title: `Rate saved for ${MONTHS[month - 1]} ${year}`, description: `$1 = ₹${rate}` });
    } catch (e) {
      toast({ title: "Couldn't save the rate", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const saveRows = async (targets: PayoutRunRow[]) => {
    setBusy("save");
    let saved = 0;
    try {
      await saveExchangeRate(year, month, rate);
      for (const r of targets) {
        if (r.result) await saveTraderMonth({ userId: r.userId, year, month, result: r.result, seatCost: r.seatCost });
        saved++;
      }
      toast({ title: `Saved ${saved} month${saved === 1 ? "" : "s"}` });
    } catch (e) {
      toast({
        title: `Saved ${saved} of ${targets.length}; the next one failed`,
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      await load();
    }
  };

  /** Tick: a shortfall (salary more than STO) asks about salary backup first. */
  const onPaidClick = (r: PayoutRunRow, paid: boolean) => {
    if (paid && !r.isTrainee && amounts(r).balance < -0.5) {
      setAskBackup(r);
      return;
    }
    void setPaid(r, paid);
  };

  const setPaid = async (r: PayoutRunRow, paid: boolean, takeFromBackup = 0) => {
    setBusy(r.userId);
    const alreadyUsed = backupUsedFromNote(r.payoutRecord?.notes);
    // Backup moves: take when paying (if chosen); give back when un-ticking.
    const backupDelta = paid ? -takeFromBackup : alreadyUsed;
    let backupChanged = false;
    try {
      const date = paidOn[r.userId] ?? localDateKey(new Date());
      const a = amounts(r);
      if (backupDelta !== 0) {
        if (!r.backupRecordId) throw new Error(`${r.name} has no salary backup record.`);
        await changeBackup(r.backupRecordId, backupDelta);
        backupChanged = true;
      }
      if (r.saved) {
        must(
          await supabase
            .from("sto_ledger")
            .update({ is_paid: paid, paid_at: paid ? `${date}T12:00:00+05:30` : null })
            .eq("id", r.saved.id)
        );
      }
      const record: TablesInsert<"payout_records"> = {
        user_id: r.userId,
        month,
        year,
        salary: a.salary,
        bank_transfer: a.online,
        advance_cash: a.cash,
        advance_bank: 0,
        cash_component: stoInr(r),
        // Salary is paid by bank; a payment with no amounts still counts as settled.
        paid_online: paid && (a.online > 0 || a.salary > 0 || a.cash === 0),
        paid_cash: paid && a.cash > 0,
      };
      // Trainees have no STO record, so keep the payment date in the note.
      let note = r.payoutRecord?.notes ?? "";
      if (!r.saved && paid && !note.includes("Paid on")) note = note ? `Paid on ${date} · ${note}` : `Paid on ${date}`;
      note = withBackupNote(note, paid ? takeFromBackup : 0);
      record.notes = note || null;
      const res = await supabase.from("payout_records").upsert(record, { onConflict: "user_id,month,year" });
      if (res.error) {
        // Undo the backup change so the two never disagree.
        if (backupChanged && r.backupRecordId) await changeBackup(r.backupRecordId, -backupDelta).catch(() => {});
        throw new Error(res.error.message);
      }
      if (takeFromBackup > 0) toast({ title: `₹${formatIndian(takeFromBackup, 0)} taken from ${r.name}'s salary backup` });
      if (!paid && alreadyUsed > 0) toast({ title: `₹${formatIndian(alreadyUsed, 0)} returned to ${r.name}'s salary backup` });
      // This row's amounts are now saved; keep what was typed on other rows.
      setMoney((m) => {
        const next = { ...m };
        delete next[r.userId];
        return next;
      });
      await load();
    } catch (e) {
      toast({ title: "Couldn't update payment", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const inr = (v: number) => `₹${formatIndian(Math.round(v), 0)}`;
  const fmt = (v: number) => `${v < 0 ? "-" : ""}${formatCurrencyINR(Math.abs(v), "$")}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Payout Run
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>STO month</Label>
              <div className="flex gap-2">
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="run-rate">USD → INR</Label>
              <div className="flex gap-2">
                <Input id="run-rate" type="number" step="0.01" className="w-28" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
                <SaveButton
                  className="h-10"
                  onClick={() => void saveRate()}
                  saving={busy === "rate"}
                  disabled={busy !== null || !(rate > 0) || rateSaved === rate}
                >
                  {rateSaved === rate ? "Saved" : "Save"}
                </SaveButton>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => { invalidateTradeCache(); void load(); }} disabled={loading} aria-label="Refresh" title="Reload all data">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            STO earned in <strong className="text-foreground">{MONTHS[month - 1]} {year}</strong>, payable around 5–10{" "}
            {MONTHS[payable.getMonth()]} {payable.getFullYear()}.
            {rateSaved === null
              ? " No rate saved for this month yet."
              : rateSaved !== rate && ` Unsaved rate — the saved rate is ${rateSaved}.`}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total STO</p>
              <p className="text-lg font-bold">{inr(totals.sto)}</p>
              <p className="text-xs text-muted-foreground">at ₹{rate} per $</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Salary · Online · Cash</p>
              <p className="text-lg font-bold">{inr(totals.salary + totals.online + totals.cash)}</p>
              <p className="text-xs text-muted-foreground">{inr(totals.salary)} · {inr(totals.online)} · {inr(totals.cash)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">From salary backup · trainee pool</p>
              <p className="text-lg font-bold">{inr(totals.fromBackup)} · {inr(totals.fromPool)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold">{totals.paidCount} of {rows.length}</p>
            </div>
          </div>

          {needsSave.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>{needsSave.length} employee month{needsSave.length === 1 ? " isn't" : "s aren't"} saved with the latest figures. Save before paying.</span>
              <SaveButton className="ml-auto" onClick={() => void saveRows(needsSave)} saving={busy === "save"} disabled={busy !== null}>
                Save all
              </SaveButton>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">Couldn't load payouts: {error}</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No employees to pay for {MONTHS[month - 1]} {year}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3 text-right">Final STO</th>
                    <th className="py-2 pr-3 text-right">STO in ₹</th>
                    <th className="py-2 pr-2 text-right">Salary ₹</th>
                    <th className="py-2 pr-2 text-right">Online ₹</th>
                    <th className="py-2 pr-2 text-right">Cash ₹</th>
                    <th className="py-2 pr-3 text-right">Balance</th>
                    <th className="py-2 pr-3">Paid on</th>
                    <th className="py-2 text-center">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const paid = isPaid(r);
                    const canPay = r.isTrainee || (!!r.saved && !r.changedSinceSave);
                    const a = amounts(r);
                    const paidDate = r.saved?.paid_at
                      ? String(r.saved.paid_at).slice(0, 10)
                      : (r.payoutRecord?.notes || "").match(/Paid on (\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
                    const moneyInput = (field: "salary" | "online" | "cash", value: number) => (
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-24 text-right"
                        value={money[r.userId]?.[field] ?? String(value)}
                        onChange={(e) => setAmount(r, field, e.target.value)}
                        disabled={paid}
                        aria-label={`${field} for ${r.name}`}
                      />
                    );
                    return (
                      <tr key={r.userId} className="border-b last:border-0 align-middle">
                        <td className="py-2 pr-3">
                          {r.isTrainee ? (
                            <span className="font-medium">{r.name}</span>
                          ) : (
                            <button type="button" className="font-medium hover:underline text-left" onClick={() => onOpenSheet?.(r.userId, month, year)} title="Open in Payout Sheet">
                              {r.name}
                            </button>
                          )}
                          <span className="block text-xs text-muted-foreground">
                            {r.isTrainee
                              ? "Trainee · stipend from pool"
                              : `L${r.result?.level.level} · STO ${r.result?.stoPercent}%${r.result?.partnered ? " · partner" : ""}`}
                          </span>
                          {!r.isTrainee && (!r.saved || r.changedSinceSave) && (
                            <Badge variant="outline" className="mt-1 border-amber-500/50 text-amber-700">
                              {!r.saved ? "Not saved" : "Changed since save"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.isTrainee ? "—" : fmt(finalStoUsd(r))}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{r.isTrainee ? "—" : inr(stoInr(r))}</td>
                        <td className="py-2 pr-2">{moneyInput("salary", a.salary)}</td>
                        <td className="py-2 pr-2">
                          {moneyInput("online", a.online)}
                          {!paid && !r.isTrainee && a.balance > 0 && (
                            <button type="button" className="mt-0.5 block text-[11px] text-primary underline" onClick={() => restTo(r, "online")}>rest online</button>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {moneyInput("cash", a.cash)}
                          {!paid && !r.isTrainee && a.balance > 0 && (
                            <button type="button" className="mt-0.5 block text-[11px] text-primary underline" onClick={() => restTo(r, "cash")}>rest cash</button>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right text-xs tabular-nums">
                          {r.isTrainee ? (
                            <span className="text-muted-foreground">from trainee pool</span>
                          ) : a.balance > 0.5 ? (
                            <span className="font-medium text-amber-600">{inr(a.balance)} left</span>
                          ) : a.balance < -0.5 ? (
                            paid ? (
                              backupUsedFromNote(r.payoutRecord?.notes) > 0 ? (
                                <span className="font-medium text-red-600">{inr(backupUsedFromNote(r.payoutRecord?.notes))} from salary backup</span>
                              ) : (
                                <span className="text-muted-foreground">{inr(-a.balance)} over STO · backup not used</span>
                              )
                            ) : (
                              <span className="font-medium text-amber-600">
                                {inr(-a.balance)} short
                                <span className="block font-normal text-muted-foreground">backup {inr(r.backupAvailable)}</span>
                              </span>
                            )
                          ) : (
                            <span className="text-emerald-600">settled</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {paid ? (
                            <span className="tabular-nums">{paidDate ?? "—"}</span>
                          ) : (
                            <Input
                              type="date"
                              className="h-8 w-36"
                              value={paidOn[r.userId] ?? localDateKey(new Date())}
                              onChange={(e) => setPaidOn((p) => ({ ...p, [r.userId]: e.target.value }))}
                              aria-label={`Paid on date for ${r.name}`}
                            />
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {busy === r.userId ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : (
                            <Checkbox
                              checked={paid}
                              disabled={busy !== null || (!paid && !canPay)}
                              onCheckedChange={(v) => onPaidClick(r, !!v)}
                              aria-label={`Mark ${r.name} paid`}
                              title={!canPay && !paid ? "Save this month first" : undefined}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Salary more than STO: ask whether the difference comes from salary backup */}
      <AlertDialog open={!!askBackup} onOpenChange={(o) => !o && setAskBackup(null)}>
        <AlertDialogContent>
          {askBackup && (() => {
            const short = Math.round(-amounts(askBackup).balance);
            const available = Math.max(0, Math.round(askBackup.backupAvailable));
            const take = Math.min(short, available);
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Take {inr(take)} from {askBackup.name}'s salary backup?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-1">
                      <p>
                        Paying {inr(short)} more than their STO this month. Salary backup available: <strong>{inr(available)}</strong>.
                      </p>
                      {available === 0 && <p>There's no backup to take from.</p>}
                      {available > 0 && take < short && <p>Only {inr(take)} is available, so that much will be taken.</p>}
                      <p>Choose "Don't take" if the backup shouldn't be used — nothing is deducted then.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const r = askBackup;
                      setAskBackup(null);
                      void setPaid(r, true, 0);
                    }}
                  >
                    Don't take
                  </Button>
                  <Button
                    disabled={take <= 0}
                    onClick={() => {
                      const r = askBackup;
                      setAskBackup(null);
                      void setPaid(r, true, take);
                    }}
                  >
                    Take {inr(take)} from backup
                  </Button>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayoutRun;
