import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/CheckinBadge";
import { ChevronLeft, ChevronRight, Clock, Download, Fingerprint, Inbox, Loader2, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isExEmployee } from "@/lib/employees";
import {
  type CheckinDay, type CheckinRequest, type DayStatus, type Decision, type Shift, decideRequest, loadRequests,
  istTime, loadCheckins, loadHolidays, loadLeaves, loadShifts, monthDates, needsReview, resetCorrection, saveCorrection, saveShift,
  setUsesBiometric, shiftFor, shiftLabel, statusFor, todayIST,
} from "@/lib/checkins";

interface Person {
  user_id: string;
  full_name: string;
  trader_number?: string | null;
  employee_role?: string | null;
  uses_biometric?: boolean | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DECISIONS: { value: Decision; label: string }[] = [
  { value: "ontime", label: "On time" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
];
const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const pretty = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Month-grid cell: short label and colour for a status. */
const cell = (s: DayStatus, day?: CheckinDay) => {
  const t = day?.checkin_at ? istTime(day.checkin_at) : "";
  switch (s.kind) {
    case "ontime": return { label: t || "✓", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
    case "late": return { label: t || "L", tone: "bg-red-500/10 text-red-700 dark:text-red-400" };
    case "half_day": return { label: "½", tone: "bg-orange-500/15 text-orange-700 dark:text-orange-400" };
    case "absent": return { label: "A", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300" };
    case "half_day_review": return { label: `${t}?`, tone: "bg-orange-500/10 text-orange-700 ring-1 ring-orange-400/60" };
    case "missed": return { label: "?", tone: "bg-amber-500/10 text-amber-700 ring-1 ring-amber-400/60" };
    case "leave": return { label: "LV", tone: "text-sky-600" };
    case "none": return { label: "×", tone: "text-amber-600" };
    case "holiday": return { label: "H", tone: "text-muted-foreground/50" };
    default: return { label: "·", tone: "text-muted-foreground/40" };
  }
};

/** Admin: daily check-ins from the fingerprint machine, with review and corrections. */
const CheckIns = ({ users }: { users: Person[] }) => {
  const { toast } = useToast();
  const today = todayIST();
  const [view, setView] = useState<"day" | "month">("day");
  const [date, setDate] = useState(today);
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [days, setDays] = useState<CheckinDay[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [leaves, setLeaves] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Local copy of who uses the machine, so toggles show instantly.
  const [usesFp, setUsesFp] = useState<Record<string, boolean>>({});
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState({ from: today, start: "", grace: "0", halfDay: "120", checkout: "240", notes: "" });
  const [edit, setEdit] = useState<{ person: Person; date: string; day?: CheckinDay; status: DayStatus } | null>(null);
  const [editStatus, setEditStatus] = useState<Decision>("ontime");
  const [editTime, setEditTime] = useState("");
  const [editNote, setEditNote] = useState("");
  const [requests, setRequests] = useState<CheckinRequest[]>([]);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [reqNotes, setReqNotes] = useState<Record<string, string>>({});

  const range = useMemo(() => {
    if (view === "day") return { from: date, to: date };
    const dates = monthDates(ym.y, ym.m);
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [view, date, ym]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s, h, l, rq] = await Promise.all([
        loadCheckins(range.from, range.to), loadShifts(), loadHolidays(range.from, range.to), loadLeaves(range.from, range.to),
        loadRequests({ pendingOnly: true }).catch(() => [] as CheckinRequest[]),
      ]);
      setRequests(rq);
      setDays(d);
      setShifts(s);
      setHolidays(h);
      setLeaves(l);
    } catch (e) {
      toast({ title: "Couldn't load check-ins", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const onFp = useCallback((p: Person) => usesFp[p.user_id] ?? p.uses_biometric !== false, [usesFp]);
  const staff = useMemo(() => {
    const num = (p: Person) => parseInt((p.trader_number || "").replace(/\D/g, "")) || 999999;
    return users
      .filter((u) => ["trader", "trainee"].includes((u.employee_role || "").toLowerCase()) && !isExEmployee(u))
      .sort((a, b) => num(a) - num(b) || a.full_name.localeCompare(b.full_name));
  }, [users]);
  const people = staff.filter(onFp);
  const offFp = staff.filter((p) => !onFp(p));

  const byKey = useMemo(() => new Map(days.map((d) => [`${d.user_id}|${d.punch_date}`, d])), [days]);
  const statusOf = useCallback(
    (p: Person, d: string) => statusFor(d, byKey.get(`${p.user_id}|${d}`), shifts, holidays, leaves.get(`${p.user_id}|${d}`)),
    [byKey, shifts, holidays, leaves]
  );

  const dayRows = useMemo(() => {
    const order = (s: DayStatus) => (needsReview(s) ? 0 : 1);
    return people
      .map((p) => ({ p, day: byKey.get(`${p.user_id}|${date}`), status: statusOf(p, date) }))
      .sort((a, b) => order(a.status) - order(b.status) || (a.day?.checkin_at ?? "9").localeCompare(b.day?.checkin_at ?? "9"));
  }, [people, byKey, date, statusOf]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    dayRows.forEach((r) => {
      const k = needsReview(r.status) ? "review" : r.status.kind === "half_day" ? "half_day" : r.status.kind;
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [dayRows]);

  const decide = async (p: Person, d: string, status: Decision, time: string | null, note: string | null) => {
    setBusy(`${p.user_id}|${d}`);
    try {
      await saveCorrection(p.user_id, d, time, note, status);
      await load();
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const openEdit = (person: Person, d: string, preset?: Decision) => {
    const day = byKey.get(`${person.user_id}|${d}`);
    const status = statusOf(person, d);
    setEdit({ person, date: d, day, status });
    const suggested: Decision =
      day?.decided_status ?? (status.kind === "late" ? "late" : status.kind === "half_day_review" ? "half_day" : status.kind === "none" || status.kind === "missed" ? "absent" : "ontime");
    setEditStatus(preset ?? suggested);
    // Prefill the punch time, or the shift start for a missed check-in.
    setEditTime(day?.checkin_at && status.kind !== "missed" ? istTime(day.checkin_at) : shiftLabel(shiftFor(d, shifts)) ?? "");
    setEditNote(day?.note ?? "");
  };
  const saveEdit = async () => {
    if (!edit) return;
    await decide(edit.person, edit.date, editStatus, editStatus === "absent" ? null : editTime || null, editNote);
    toast({ title: "Saved", description: `${edit.person.full_name} · ${DECISIONS.find((x) => x.value === editStatus)?.label}` });
    setEdit(null);
  };
  const resetEdit = async () => {
    if (!edit) return;
    setBusy("reset");
    try {
      await resetCorrection(edit.person.user_id, edit.date);
      await load();
      setEdit(null);
    } finally {
      setBusy(null);
    }
  };

  const toggleFp = async (p: Person, on: boolean) => {
    setUsesFp((m) => ({ ...m, [p.user_id]: on }));
    try {
      await setUsesBiometric(p.user_id, on);
    } catch (e) {
      setUsesFp((m) => ({ ...m, [p.user_id]: !on }));
      toast({ title: "Couldn't change", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openRules = () => {
    const s = shiftFor(today, shifts);
    setRules({
      from: today,
      start: s ? s.shift_start.slice(0, 5) : "",
      grace: String(s?.grace_minutes ?? 0),
      halfDay: String(s?.half_day_after_minutes ?? 120),
      checkout: String((s?.checkout_after_minutes ?? 240) / 60),
      notes: s?.notes ?? "",
    });
    setRulesOpen(true);
  };
  const saveRules = async () => {
    setBusy("rules");
    try {
      await saveShift({
        effective_from: rules.from,
        shift_start: `${rules.start}:00`,
        grace_minutes: Math.max(0, Number(rules.grace) || 0),
        half_day_after_minutes: Math.max(1, Number(rules.halfDay) || 120),
        checkout_after_minutes: Math.round(Math.max(0.5, Number(rules.checkout) || 4) * 60),
        notes: rules.notes.trim() || null,
      });
      toast({ title: "Shift rules saved", description: `From ${rules.from}` });
      setRulesOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const nameOf = (id: string) => users.find((u) => u.user_id === id)?.full_name ?? "Unknown";
  const pendingFor = (userId: string, d: string) => requests.find((r) => r.user_id === userId && r.punch_date === d);
  const answer = async (r: CheckinRequest, approve: boolean) => {
    setBusy(r.id);
    try {
      await decideRequest(r, approve, reqNotes[r.id] ?? null);
      toast({ title: approve ? "Approved" : "Declined", description: `${nameOf(r.user_id)} · ${r.punch_date}` });
      await load();
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  /** Monthly report: one summary row per person, plus a day-by-day sheet. */
  const downloadReport = async () => {
    setBusy("report");
    try {
      const XLSX = await import("xlsx");
      const monthDays = monthDates(ym.y, ym.m);
      const label = (st: DayStatus, day?: CheckinDay) => {
        const t = day?.checkin_at && st.kind !== "missed" ? istTime(day.checkin_at) : "";
        switch (st.kind) {
          case "ontime": return t ? `${t} on time` : "On time";
          case "late": return `${t} late${st.minutes ? ` ${st.minutes}m` : ""}`.trim();
          case "half_day": return `Half day${t ? ` (${t})` : ""}`;
          case "absent": return "Absent";
          case "half_day_review": return `${t} half day?`;
          case "missed": return "Missed check-in";
          case "leave": return st.label;
          case "holiday": return "Holiday";
          case "weekend": return "";
          case "future": return "";
          default: return "No punch";
        }
      };
      const summary = people.map((p) => {
        let working = 0, ontime = 0, late = 0, half = 0, absent = 0, leave = 0, review = 0, lateMins = 0;
        monthDays.forEach((d) => {
          const st = statusOf(p, d);
          if (["weekend", "holiday", "future"].includes(st.kind)) return;
          working++;
          if (st.kind === "ontime") ontime++;
          else if (st.kind === "late") { late++; lateMins += Math.max(0, st.minutes ?? 0); }
          else if (st.kind === "half_day") half++;
          else if (st.kind === "absent") absent++;
          else if (st.kind === "leave") leave++;
          else review++;
        });
        const attended = ontime + late + half;
        return {
          Employee: p.full_name.trim(),
          ID: p.trader_number ?? "",
          "Working days": working,
          "On time": ontime,
          Late: late,
          "Half day": half,
          Absent: absent,
          Leave: leave,
          "Needs review": review,
          "On-time %": attended ? Math.round((ontime / attended) * 100) : 0,
          "Avg minutes late": late ? Math.round(lateMins / late) : 0,
        };
      });
      const daily = people.map((p) => {
        const row: Record<string, string> = { Employee: p.full_name.trim() };
        monthDays.forEach((d) => {
          // Text keys ("1 Nov") keep the columns in date order.
          row[`${Number(d.slice(8))} ${MONTHS[ym.m - 1].slice(0, 3)}`] = label(statusOf(p, d), byKey.get(`${p.user_id}|${d}`));
        });
        return row;
      });
      const wb = XLSX.utils.book_new();
      const s1 = XLSX.utils.json_to_sheet(summary);
      s1["!cols"] = [{ wch: 24 }, { wch: 8 }, ...Array(9).fill({ wch: 12 })];
      XLSX.utils.book_append_sheet(wb, s1, "Summary");
      const s2 = XLSX.utils.json_to_sheet(daily);
      s2["!cols"] = [{ wch: 24 }, ...monthDays.map(() => ({ wch: 14 }))];
      XLSX.utils.book_append_sheet(wb, s2, "Day by day");
      XLSX.writeFile(wb, `Check-ins ${MONTHS[ym.m - 1]} ${ym.y}.xlsx`);
    } catch (e) {
      toast({ title: "Couldn't create the report", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const dayShift = shiftFor(date, shifts);
  const dates = monthDates(ym.y, ym.m);
  const shownRows = reviewOnly ? dayRows.filter((r) => needsReview(r.status)) : dayRows;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" /> Check-ins
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant={requests.length ? "default" : "outline"} size="sm" className="h-8 gap-1.5" onClick={() => setRequestsOpen(true)}>
              <Inbox className="h-4 w-4" /> Requests
              {requests.length > 0 && <Badge variant="secondary" className="ml-0.5 h-5 px-1.5">{requests.length}</Badge>}
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openRules}>
              <Clock className="h-4 w-4" /> Shift rules
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setPeopleOpen(true)}>
              <Users className="h-4 w-4" /> Who uses fingerprint
            </Button>
            <div className="inline-flex rounded-md border p-0.5">
              {(["day", "month"] as const).map((v) => (
                <Button key={v} size="sm" variant={view === v ? "secondary" : "ghost"} className="h-7" onClick={() => setView(v)}>
                  {v === "day" ? "Day" : "Month"}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {view === "day" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input type="date" className="h-9 w-40" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {date !== today && <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Today</Button>}
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={reviewOnly} onCheckedChange={setReviewOnly} /> Needs review only
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Select value={String(ym.m)} onValueChange={(v) => setYm({ ...ym, m: Number(v) })}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(ym.y)} onValueChange={(v) => setYm({ ...ym, y: Number(v) })}>
              <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[ym.y - 1, ym.y, ym.y + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="ml-auto h-9 gap-1.5" disabled={loading || busy === "report"} onClick={() => void downloadReport()}>
              {busy === "report" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Excel
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : view === "day" ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-medium">{pretty(date)}</span>
                {holidays.has(date) && <span className="text-sm text-muted-foreground">Holiday · {holidays.get(date)}</span>}
                <span className="text-sm text-muted-foreground">
                  Shift {shiftLabel(dayShift) ?? "not set"}
                  {dayShift ? ` · ${dayShift.grace_minutes} min grace` : ""}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                {[
                  ["ontime", "On time", "text-emerald-600"],
                  ["late", "Late", "text-red-600"],
                  ["half_day", "Half day", "text-orange-600"],
                  ["review", "Needs review", "text-amber-600"],
                  ["absent", "Absent / leave", "text-slate-600 dark:text-slate-300"],
                ].map(([k, label, tone]) => (
                  <div key={k} className="rounded-md bg-background px-2 py-2">
                    <p className={`text-xl font-bold tabular-nums ${tone}`}>{(counts[k] ?? 0) + (k === "absent" ? counts.leave ?? 0 : 0)}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {shownRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{reviewOnly ? "Nothing to review for this day." : "No one on fingerprint attendance."}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {shownRows.map(({ p, day, status }) => {
                  const k = `${p.user_id}|${date}`;
                  const review = needsReview(status);
                  return (
                    <li key={p.user_id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${needsReview(status) ? "bg-amber-500/5" : ""}`}>
                      <div className="min-w-[9rem] flex-1">
                        <p className="font-medium leading-tight">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.trader_number || "—"}
                          {day?.edited && <span className="ml-2 text-primary">set by admin{day.note ? ` · ${day.note}` : ""}</span>}
                          {pendingFor(p.user_id, date) && (
                            <button type="button" className="ml-2 text-sky-600 underline" onClick={() => setRequestsOpen(true)}>
                              asked for a change
                            </button>
                          )}
                        </p>
                      </div>
                      <span className={`w-14 text-right text-lg font-semibold tabular-nums ${status.kind === "late" || status.kind === "half_day_review" ? "text-red-600" : status.kind === "ontime" ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {status.kind === "missed" ? "—" : istTime(day?.checkin_at ?? null)}
                      </span>
                      <span className="min-w-[8.5rem]"><StatusBadge status={status} /></span>
                      {review && date <= today && (
                        <span className="flex flex-wrap gap-1">
                          {DECISIONS.map((dcs) => (
                            <Button
                              key={dcs.value}
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={busy === k}
                              onClick={() => (dcs.value === "late" ? openEdit(p, date, "late") : void decide(p, date, dcs.value, null, null))}
                            >
                              {dcs.label}
                            </Button>
                          ))}
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p, date)} aria-label={`Edit check-in for ${p.full_name}`}>
                        {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {offFp.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not on fingerprint ({offFp.length}): {offFp.map((p) => p.full_name.trim()).join(", ")} ·{" "}
                <button type="button" className="text-primary underline" onClick={() => setPeopleOpen(true)}>change</button>
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-10 min-w-[9rem] bg-muted px-3 py-2 text-left font-medium">Employee</th>
                  {dates.map((d) => (
                    <th key={d} className="px-0.5 py-2 text-center font-medium">
                      <span className={statusFor(d, undefined, shifts, holidays).kind === "weekend" || holidays.has(d) ? "text-muted-foreground/50" : ""}>{Number(d.slice(8))}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium text-red-600">Late</th>
                  <th className="px-2 py-2 text-center font-medium text-orange-600">½</th>
                  <th className="px-2 py-2 text-center font-medium text-amber-600">?</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const tally = { late: 0, half: 0, review: 0 };
                  const cells = dates.map((d) => {
                    const day = byKey.get(`${p.user_id}|${d}`);
                    const st = statusOf(p, d);
                    if (st.kind === "late") tally.late++;
                    if (st.kind === "half_day") tally.half++;
                    if (needsReview(st)) tally.review++;
                    const { label, tone } = cell(st, day);
                    return (
                      <td key={d} className="p-0.5 text-center">
                        <button
                          type="button"
                          disabled={st.kind === "future"}
                          onClick={() => openEdit(p, d)}
                          title={`${p.full_name.trim()} · ${d}${day?.note ? ` · ${day.note}` : ""}`}
                          className={`w-full min-w-[2.75rem] whitespace-nowrap rounded px-1 py-1 tabular-nums transition-colors hover:ring-1 hover:ring-primary ${tone} ${day?.edited ? "underline decoration-dotted" : ""}`}
                        >
                          {label}
                        </button>
                      </td>
                    );
                  });
                  return (
                    <tr key={p.user_id} className="border-t">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-1.5 font-medium">{p.full_name}</td>
                      {cells}
                      <td className="px-2 text-center font-semibold tabular-nums text-red-600">{tally.late || ""}</td>
                      <td className="px-2 text-center font-semibold tabular-nums text-orange-600">{tally.half || ""}</td>
                      <td className="px-2 text-center font-semibold tabular-nums text-amber-600">{tally.review || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Green on time · Red late · ½ half day · A absent · LV leave recorded · × no punch · ? needs review (missed check-in or very late) · H holiday ·
              dotted underline = set by admin. Click any cell to decide.
            </p>
          </div>
        )}
      </CardContent>

      {/* Decide / correct one day */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>{edit.person.full_name}</DialogTitle>
                <DialogDescription>
                  {pretty(edit.date)} · first punch {istTime(edit.day?.device_checkin ?? null)}
                  {edit.status.kind === "missed" && " (looks like a check-out)"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Mark as</Label>
                  <div className="grid grid-cols-4 gap-1 rounded-md border p-1">
                    {DECISIONS.map((dcs) => (
                      <Button key={dcs.value} size="sm" variant={editStatus === dcs.value ? "secondary" : "ghost"} className="h-8 px-1 text-xs" onClick={() => setEditStatus(dcs.value)}>
                        {dcs.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {editStatus !== "absent" && (
                  <div className="space-y-1">
                    <Label htmlFor="ci-time">Arrival time (India){editStatus === "late" ? "" : " — optional"}</Label>
                    <Input id="ci-time" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-36" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="ci-note">Note (optional)</Label>
                  <Input id="ci-note" value={editNote} maxLength={500} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. forgot to punch in, came 3:20" />
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                {edit.day?.edited ? (
                  <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void resetEdit()}>
                    Undo — use machine punch
                  </Button>
                ) : <span />}
                <Button disabled={busy !== null || (editStatus === "late" && !/^\d{2}:\d{2}$/.test(editTime))} onClick={() => void saveEdit()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Correction requests from traders */}
      <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check-in change requests</DialogTitle>
            <DialogDescription>Approving saves the requested arrival time for that day (late or on time follows the shift rules).</DialogDescription>
          </DialogHeader>
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open requests.</p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{nameOf(r.user_id)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(`${r.punch_date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  </div>
                  <p>
                    {r.requested_time ? <>Says they arrived at <span className="font-semibold">{r.requested_time.slice(0, 5)}</span>. </> : null}
                    <span className="text-muted-foreground">“{r.reason}”</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Machine: {istTime(byKey.get(`${r.user_id}|${r.punch_date}`)?.device_checkin ?? null)}
                  </p>
                  <Input
                    className="h-8"
                    placeholder="Reply (optional)"
                    value={reqNotes[r.id] ?? ""}
                    onChange={(e) => setReqNotes((m) => ({ ...m, [r.id]: e.target.value }))}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === r.id} onClick={() => void answer(r, false)}>Decline</Button>
                    <Button size="sm" disabled={busy === r.id} onClick={() => void answer(r, true)}>
                      {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Who uses the fingerprint machine */}
      <Dialog open={peopleOpen} onOpenChange={setPeopleOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Who uses fingerprint</DialogTitle>
            <DialogDescription>Turn off for people who don't come to the office — they're left out of check-ins and never show "No punch".</DialogDescription>
          </DialogHeader>
          <ul className="divide-y">
            {staff.map((p) => (
              <li key={p.user_id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{p.full_name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{p.trader_number}</span>
                </span>
                <Switch checked={onFp(p)} onCheckedChange={(v) => void toggleFp(p, v)} aria-label={`Fingerprint for ${p.full_name}`} />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Shift rules */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shift rules</DialogTitle>
            <DialogDescription>Applies from the chosen date; earlier days keep their old rules.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="r-start">Shift starts (India)</Label>
              <Input id="r-start" type="time" value={rules.start} onChange={(e) => setRules({ ...rules, start: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-from">From date</Label>
              <Input id="r-from" type="date" value={rules.from} onChange={(e) => setRules({ ...rules, from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-grace">Grace (minutes)</Label>
              <Input id="r-grace" type="number" min="0" value={rules.grace} onChange={(e) => setRules({ ...rules, grace: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-half">"Half day?" if later than (min)</Label>
              <Input id="r-half" type="number" min="1" value={rules.halfDay} onChange={(e) => setRules({ ...rules, halfDay: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="r-out">A first punch this many hours after start is a check-out</Label>
              <Input id="r-out" type="number" min="0.5" step="0.5" className="w-28" value={rules.checkout} onChange={(e) => setRules({ ...rules, checkout: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="r-notes">Note</Label>
              <Input id="r-notes" value={rules.notes} onChange={(e) => setRules({ ...rules, notes: e.target.value })} placeholder="e.g. US daylight saving" />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={busy !== null || !/^\d{2}:\d{2}$/.test(rules.start) || !rules.from} onClick={() => void saveRules()}>
              {busy === "rules" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CheckIns;
