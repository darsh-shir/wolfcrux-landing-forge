import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/ui/save-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmployeePicker from "@/components/admin/EmployeePicker";
import { useSharedEmployee } from "@/hooks/useSharedEmployee";
import { useTraderHistory } from "@/hooks/useTraderHistory";
import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/fetchAllRows";
import { DEFAULT_LEVELS } from "@/lib/payoutEngine";
import { formatCurrencyINR } from "@/lib/utils";
import {
  deleteLevelChange,
  loadLevelHistory,
  loadMilestoneMonths,
  saveLevelChange,
  saveMilestoneMonth,
  type LevelHistoryRow,
  type MilestoneMonthRow,
} from "@/lib/levelHistory";

interface Person {
  user_id: string;
  full_name: string;
  trader_number?: string | null;
  employee_role?: string | null;
}

const usd = (n: number) => formatCurrencyINR(n, "$", 2);
const monthLabel = (key: string) => format(parseISO(`${key.slice(0, 7)}-01`), "MMM yyyy");
const thisMonth = () => format(new Date(), "yyyy-MM");
const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
};
const levelName = (n: number) => DEFAULT_LEVELS.find((l) => l.level === n)?.label ?? `Level ${n}`;

/**
 * Admin: set each person's level and % by month (backdating allowed), and
 * correct the net P&L that counts towards milestones, month by month.
 */
const LevelsAndMilestones = ({ users }: { users: Person[] }) => {
  const people = users.filter((u) => ["trader", "trainee"].includes((u.employee_role || "").toLowerCase()));
  const [userId, setUserId] = useSharedEmployee();
  const [refresh, setRefresh] = useState(0);
  const { history, loading } = useTraderHistory(userId || null, refresh);
  const [levels, setLevels] = useState<LevelHistoryRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneMonthRow[]>([]);
  const [baseline, setBaseline] = useState<{ id?: string; date: string; days: string; profit: string }>({ date: "", days: "", profit: "" });
  const [savedBaseline, setSavedBaseline] = useState(baseline);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [l, m, b] = await Promise.all([
      loadLevelHistory(userId),
      loadMilestoneMonths(userId),
      supabase.from("trader_baselines").select("id, as_of_date, baseline_days, baseline_net_profit").eq("user_id", userId).maybeSingle(),
    ]);
    setLevels(l);
    setMilestones(m);
    const bb = {
      id: b.data?.id,
      date: b.data?.as_of_date ?? "",
      days: b.data ? String(b.data.baseline_days ?? 0) : "",
      profit: b.data ? String(b.data.baseline_net_profit ?? 0) : "",
    };
    setBaseline(bb);
    setSavedBaseline(bb);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const afterSave = async () => {
    await reload();
    setRefresh((r) => r + 1);
  };

  /* ---------------- level form ---------------- */
  const [form, setForm] = useState({ month: thisMonth(), level: "1", sto: "", lto: "", note: "" });
  const [savingLevel, setSavingLevel] = useState(false);
  const formDefault = DEFAULT_LEVELS.find((l) => l.level === Number(form.level));

  const saveLevel = async () => {
    if (!userId || !/^\d{4}-\d{2}$/.test(form.month)) return;
    setSavingLevel(true);
    try {
      await saveLevelChange({
        userId,
        month: form.month,
        level: Number(form.level),
        stoPercent: form.sto === "" ? null : Number(form.sto),
        ltoPercent: form.lto === "" ? null : Number(form.lto),
        note: form.note.trim() || null,
      });
      toast.success(`${levelName(Number(form.level))} from ${monthLabel(form.month)} saved`);
      setForm((f) => ({ ...f, sto: "", lto: "", note: "" }));
      await afterSave();
    } catch (e) {
      toast.error(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingLevel(false);
    }
  };

  const removeLevel = async (row: LevelHistoryRow) => {
    if (!userId || !window.confirm(`Remove the ${levelName(row.level)} change from ${monthLabel(row.effective_month)}?`)) return;
    try {
      await deleteLevelChange(row.id, userId);
      toast.success("Removed");
      await afterSave();
    } catch (e) {
      toast.error(`Couldn't remove: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /* ---------------- baseline ---------------- */
  const baselineChanged =
    baseline.date !== savedBaseline.date || baseline.days !== savedBaseline.days || baseline.profit !== savedBaseline.profit;
  const [savingBaseline, setSavingBaseline] = useState(false);
  const saveBaseline = async () => {
    if (!userId || !baseline.date) return toast.error("Pick the 'as of' date");
    setSavingBaseline(true);
    try {
      const payload = {
        as_of_date: baseline.date,
        baseline_days: Math.round(Number(baseline.days) || 0),
        baseline_net_profit: Number(baseline.profit) || 0,
        updated_at: new Date().toISOString(),
      };
      if (savedBaseline.id) must(await supabase.from("trader_baselines").update(payload).eq("id", savedBaseline.id));
      else must(await supabase.from("trader_baselines").insert({ user_id: userId, baseline_level: 0, ...payload }));
      toast.success("Starting figures saved");
      await afterSave();
    } catch (e) {
      toast.error(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingBaseline(false);
    }
  };

  /* ---------------- milestone months ---------------- */
  const overrides = useMemo(() => new Map(milestones.map((m) => [m.month.slice(0, 7), m])), [milestones]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingMonth, setSavingMonth] = useState<string | null>(null);
  useEffect(() => setEdits({}), [userId, milestones]);

  const monthRows = useMemo(() => {
    if (!history) return [];
    let running = (history.months[0]?.profitBefore ?? 0);
    return history.months.map((m) => {
      running += m.milestoneNet;
      return { key: m.month, website: m.netProfit, counted: m.milestoneNet, running, days: m.tradingDays };
    });
  }, [history]);

  const saveMonth = async (key: string) => {
    if (!userId) return;
    const raw = (edits[key] ?? "").trim();
    setSavingMonth(key);
    try {
      await saveMilestoneMonth(userId, key, raw === "" ? null : Number(raw), null);
      toast.success(raw === "" ? `${monthLabel(key)} back to the website figure` : `${monthLabel(key)} milestone P&L saved`);
      await afterSave();
    } catch (e) {
      toast.error(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingMonth(null);
    }
  };

  const since = history?.levelSince;
  const nowKey = thisMonth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-['Space_Grotesk']">Levels, % and milestone P&L</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upgrades are set by you. Each one counts for its whole month and every month after; you can backdate it.
          </p>
          <EmployeePicker users={people} value={userId} onValueChange={setUserId} placeholder="Select person" className="mt-2 max-w-sm" />
        </CardHeader>
        {userId && (
          <CardContent>
            {loading || !history ? (
              <div className="skeleton-shimmer h-16 rounded-lg" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Now</p>
                  <p className="font-semibold">{history.currentLevel.label}</p>
                  <p className="text-sm">
                    STO {history.currentStoPercent}% · LTO {history.currentLtoPercent}%
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">On this % since</p>
                  <p className="font-semibold">{since ? monthLabel(since) : "Not set (automatic)"}</p>
                  {since && <p className="text-sm">{monthsBetween(since, nowKey)} months</p>}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Milestone so far</p>
                  <p className="font-semibold">{usd(history.totalProfit)} · {history.totalDays} days</p>
                  <p className="text-sm text-muted-foreground">
                    By days or profit they qualify for {history.eligibleLevel.label}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {userId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Level history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:items-end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">From month</p>
                <Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
              </div>
              <div className="col-span-1 space-y-1 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Level</p>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v, sto: "", lto: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_LEVELS.map((l) => (
                      <SelectItem key={l.level} value={String(l.level)}>
                        {l.level} · {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">STO %</p>
                <Input type="number" inputMode="decimal" value={form.sto} placeholder={`${formDefault?.stoPercent ?? ""} (default)`}
                  onChange={(e) => setForm({ ...form, sto: e.target.value })} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">LTO %</p>
                <Input type="number" inputMode="decimal" value={form.lto} placeholder={`${formDefault?.ltoPercent ?? ""} (default)`}
                  onChange={(e) => setForm({ ...form, lto: e.target.value })} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Note</p>
                <Input value={form.note} placeholder="optional" onChange={(e) => setForm({ ...form, note: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && void saveLevel()} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SaveButton saving={savingLevel} onClick={() => void saveLevel()}>Save level</SaveButton>
              <span className="text-xs text-muted-foreground">Leave STO/LTO empty to use the level's default %. Saving the same month again replaces it.</span>
            </div>

            {levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No levels set yet: the website works the level out from days or profit.</p>
            ) : (
              <div className="-mx-6 overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">STO %</TableHead>
                      <TableHead className="text-right">LTO %</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...levels].reverse().map((r) => {
                      const d = DEFAULT_LEVELS.find((l) => l.level === r.level);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{monthLabel(r.effective_month)}</TableCell>
                          <TableCell>{r.level} · {levelName(r.level)}</TableCell>
                          <TableCell className="text-right">
                            {r.sto_percent ?? d?.stoPercent}%{r.sto_percent != null && <Badge variant="outline" className="ml-1 text-[10px]">custom</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.lto_percent ?? d?.ltoPercent}%{r.lto_percent != null && <Badge variant="outline" className="ml-1 text-[10px]">custom</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.note || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit" onClick={() => setForm({
                              month: r.effective_month.slice(0, 7), level: String(r.level),
                              sto: r.sto_percent != null ? String(r.sto_percent) : "", lto: r.lto_percent != null ? String(r.lto_percent) : "", note: r.note ?? "",
                            })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Remove" onClick={() => void removeLevel(r)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Milestone net P&L</CardTitle>
            <p className="text-sm text-muted-foreground">
              Starting figures as of a date, then month by month. Type your own figure for any month (e.g. profit made in someone
              else's account); clear it to go back to the website's figure. Payouts are not affected.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">As of date</p>
                <Input type="date" value={baseline.date} onChange={(e) => setBaseline({ ...baseline, date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Trading days till then</p>
                <Input type="number" value={baseline.days} onChange={(e) => setBaseline({ ...baseline, days: e.target.value })} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Net P&L till then ($)</p>
                <AmountInput allowNegative value={baseline.profit} onValueChange={(v) => setBaseline({ ...baseline, profit: v })}
                  onKeyDown={(e) => e.key === "Enter" && baselineChanged && void saveBaseline()} />
              </div>
              <div>{baselineChanged && <SaveButton saving={savingBaseline} onClick={() => void saveBaseline()}>Save starting figures</SaveButton>}</div>
            </div>
            <p className="text-xs text-muted-foreground">Trades before the "as of" date are covered by these figures; the months below start after it.</p>

            {monthRows.length > 0 && (
              <div className="-mx-6 overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead className="text-right">Website net P&L</TableHead>
                      <TableHead>Your figure</TableHead>
                      <TableHead className="text-right">Milestone total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...monthRows].reverse().map((r) => {
                      const saved = overrides.get(r.key);
                      const value = edits[r.key] ?? (saved ? String(saved.net_profit) : "");
                      const changed = (edits[r.key] ?? null) !== null && value !== (saved ? String(saved.net_profit) : "");
                      return (
                        <TableRow key={r.key}>
                          <TableCell className="font-medium whitespace-nowrap">{monthLabel(r.key)}</TableCell>
                          <TableCell className="text-right">{r.days}</TableCell>
                          <TableCell className={`text-right ${saved ? "text-muted-foreground line-through" : ""}`}>{usd(r.website)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AmountInput allowNegative
                                className="h-8 w-32"
                                placeholder="same"
                                value={value}
                                onValueChange={(v) => setEdits((x) => ({ ...x, [r.key]: v }))}
                                onKeyDown={(e) => e.key === "Enter" && changed && void saveMonth(r.key)}
                              />
                              {changed && <SaveButton saving={savingMonth === r.key} onClick={() => void saveMonth(r.key)} />}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{usd(r.running)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LevelsAndMilestones;
