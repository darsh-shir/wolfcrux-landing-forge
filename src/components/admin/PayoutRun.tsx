import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarCheck, Loader2, RefreshCw, Save } from "lucide-react";
import { formatCurrencyINR, formatIndian } from "@/lib/utils";
import { localDateKey, must } from "@/lib/fetchAllRows";
import { loadPayoutRun, type PayoutRunRow } from "@/lib/payoutRun";
import { saveExchangeRate, saveTraderMonth } from "@/lib/payoutSave";
import type { TablesInsert } from "@/integrations/supabase/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** STO earned in month M is paid around the 5th–10th of month M+3. */
export const defaultStoMonth = (today = new Date()) => {
  const d = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

type Method = "bank" | "cash";

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
  const [methods, setMethods] = useState<Record<string, Method>>({});
  const [paidOn, setPaidOn] = useState<Record<string, string>>({});

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

  const needsSave = rows.filter((r) => !r.saved || (r.changedSinceSave && !r.saved?.is_paid));
  const totals = useMemo(() => {
    const finalUsd = rows.reduce((s, r) => s + (r.saved ? Number(r.saved.final_sto_amount) : r.result.finalSto), 0);
    const paid = rows.filter((r) => r.saved?.is_paid);
    const paidUsd = paid.reduce((s, r) => s + Number(r.saved.final_sto_amount), 0);
    return { finalUsd, paidCount: paid.length, unpaidUsd: finalUsd - paidUsd };
  }, [rows]);

  const saveRows = async (targets: PayoutRunRow[]) => {
    setBusy("save");
    let saved = 0;
    try {
      await saveExchangeRate(year, month, rate);
      for (const r of targets) {
        await saveTraderMonth({ userId: r.userId, year, month, result: r.result, seatCost: r.seatCost });
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

  const setPaid = async (r: PayoutRunRow, paid: boolean) => {
    if (!r.saved) return;
    setBusy(r.userId);
    try {
      const method = methods[r.userId] ?? "bank";
      const date = paidOn[r.userId] ?? localDateKey(new Date());
      const inr = Math.round(Number(r.saved.final_sto_amount) * rate * 100) / 100;
      must(
        await supabase
          .from("sto_ledger")
          .update({ is_paid: paid, paid_at: paid ? `${date}T12:00:00+05:30` : null })
          .eq("id", r.saved.id)
      );
      const record: TablesInsert<"payout_records"> = {
        user_id: r.userId,
        month,
        year,
        paid_cash: paid && method === "cash",
        paid_online: paid && method === "bank",
        cash_component: inr,
      };
      // Only fill the paid amount when there's no record yet (keeps any amounts typed on the Payout Sheet).
      if (!r.payoutRecord && paid) {
        if (method === "cash") record.advance_cash = inr;
        else record.bank_transfer = inr;
      }
      must(await supabase.from("payout_records").upsert(record, { onConflict: "user_id,month,year" }));
      await load();
    } catch (e) {
      toast({ title: "Couldn't update payment", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

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
              <Input id="run-rate" type="number" step="0.01" className="w-28" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
            </div>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            STO earned in <strong className="text-foreground">{MONTHS[month - 1]} {year}</strong>, payable around 5–10{" "}
            {MONTHS[payable.getMonth()]} {payable.getFullYear()}.
            {rateSaved !== null && rateSaved !== rate && " The rate changed — it's saved when you save months."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total final STO</p>
              <p className="text-lg font-bold">{fmt(totals.finalUsd)}</p>
              <p className="text-xs text-muted-foreground">₹{formatIndian(totals.finalUsd * rate, 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold">{totals.paidCount} of {rows.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Still to pay</p>
              <p className="text-lg font-bold text-amber-600">₹{formatIndian(totals.unpaidUsd * rate, 0)}</p>
              <p className="text-xs text-muted-foreground">{fmt(totals.unpaidUsd)}</p>
            </div>
          </div>

          {needsSave.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>{needsSave.length} employee month{needsSave.length === 1 ? " isn't" : "s aren't"} saved with the latest figures. Save before paying.</span>
              <Button size="sm" className="ml-auto gap-2" onClick={() => void saveRows(needsSave)} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save all
              </Button>
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
            <p className="py-8 text-center text-sm text-muted-foreground">No trading activity in {MONTHS[month - 1]} {year}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3 text-right">Net profit</th>
                    <th className="py-2 pr-3 text-right">Final STO</th>
                    <th className="py-2 pr-3 text-right">INR</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Paid by</th>
                    <th className="py-2 pr-3">Paid on</th>
                    <th className="py-2 text-center">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const finalUsd = r.saved ? Number(r.saved.final_sto_amount) : r.result.finalSto;
                    const isPaid = !!r.saved?.is_paid;
                    const canPay = !!r.saved && !r.changedSinceSave;
                    const paidDate = r.saved?.paid_at ? String(r.saved.paid_at).slice(0, 10) : null;
                    const method: Method =
                      methods[r.userId] ?? (r.payoutRecord?.paid_cash && !r.payoutRecord?.paid_online ? "cash" : "bank");
                    return (
                      <tr key={r.userId} className="border-b last:border-0 align-middle">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="font-medium hover:underline text-left"
                            onClick={() => onOpenSheet?.(r.userId, month, year)}
                            title="Open in Payout Sheet"
                          >
                            {r.name}
                          </button>
                          <span className="block text-xs text-muted-foreground">
                            L{r.result.level.level} · STO {r.result.stoPercent}%{r.result.partnered ? " · partner" : ""}
                          </span>
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${r.result.netProfit < 0 ? "text-red-600" : ""}`}>{fmt(r.result.netProfit)}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmt(finalUsd)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">₹{formatIndian(finalUsd * rate, 0)}</td>
                        <td className="py-2 pr-3">
                          {!r.saved ? (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-700">Not saved</Badge>
                          ) : r.changedSinceSave ? (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-700" title={`Now ${fmt(r.result.finalSto)}`}>
                              Changed since save
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Saved</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Select
                            value={method}
                            onValueChange={(v) => setMethods((m) => ({ ...m, [r.userId]: v as Method }))}
                            disabled={isPaid}
                          >
                            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bank">Bank</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 pr-3">
                          {isPaid ? (
                            <span className="tabular-nums">{paidDate}</span>
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
                              checked={isPaid}
                              disabled={busy !== null || (!isPaid && !canPay)}
                              onCheckedChange={(v) => void setPaid(r, !!v)}
                              aria-label={`Mark ${r.name} paid`}
                              title={!canPay && !isPaid ? "Save this month first" : undefined}
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
    </div>
  );
};

export default PayoutRun;
