import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/CheckinBadge";
import { ChevronLeft, ChevronRight, Fingerprint, Loader2, Pencil } from "lucide-react";
import { isExEmployee } from "@/lib/employees";
import {
  type CheckinDay, type Shift,
  istTime, loadCheckins, loadHolidays, loadShifts, monthDates, resetCorrection, saveCorrection, shiftFor, shiftLabel, statusFor, todayIST,
} from "@/lib/checkins";

interface Person {
  user_id: string;
  full_name: string;
  trader_number?: string | null;
  employee_role?: string | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const pretty = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Admin: who checked in when (first punch of the day), with corrections. */
const CheckIns = ({ users }: { users: Person[] }) => {
  const { toast } = useToast();
  const today = todayIST();
  const [view, setView] = useState<"day" | "month">("day");
  const [date, setDate] = useState(today);
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [days, setDays] = useState<CheckinDay[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ person: Person; date: string; day?: CheckinDay } | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    if (view === "day") return { from: date, to: date };
    const dates = monthDates(ym.y, ym.m);
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [view, date, ym]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s, h] = await Promise.all([loadCheckins(range.from, range.to), loadShifts(), loadHolidays(range.from, range.to)]);
      setDays(d);
      setShifts(s);
      setHolidays(h);
    } catch (e) {
      toast({ title: "Couldn't load check-ins", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const byKey = useMemo(() => new Map(days.map((d) => [`${d.user_id}|${d.punch_date}`, d])), [days]);
  const people = useMemo(() => {
    const withData = new Set(days.map((d) => d.user_id));
    const num = (p: Person) => parseInt((p.trader_number || "").replace(/\D/g, "")) || 999999;
    return users
      .filter((u) => (["trader", "trainee"].includes((u.employee_role || "").toLowerCase()) && !isExEmployee(u)) || withData.has(u.user_id))
      .sort((a, b) => num(a) - num(b) || a.full_name.localeCompare(b.full_name));
  }, [users, days]);

  const openEdit = (person: Person, d: string) => {
    const day = byKey.get(`${person.user_id}|${d}`);
    setEdit({ person, date: d, day });
    setEditTime(day?.checkin_at ? istTime(day.checkin_at) : shiftLabel(shiftFor(d, shifts)) ?? "");
    setEditNote(day?.note ?? "");
  };
  const run = async (fn: () => Promise<void>, done: string) => {
    setSaving(true);
    try {
      await fn();
      toast({ title: done });
      setEdit(null);
      await load();
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Day view rows: earliest first, no punch last
  const dayRows = useMemo(
    () =>
      people
        .map((p) => {
          const day = byKey.get(`${p.user_id}|${date}`);
          return { p, day, status: statusFor(date, day, shifts, holidays) };
        })
        .sort((a, b) => (a.day?.checkin_at ?? "9") .localeCompare(b.day?.checkin_at ?? "9")),
    [people, byKey, date, shifts, holidays]
  );
  const counts = useMemo(() => {
    const c = { ontime: 0, late: 0, none: 0 };
    dayRows.forEach((r) => {
      if (r.status.kind === "ontime") c.ontime++;
      else if (r.status.kind === "late") c.late++;
      else if (r.status.kind === "none") c.none++;
    });
    return c;
  }, [dayRows]);
  const dayShift = shiftFor(date, shifts);
  const dates = monthDates(ym.y, ym.m);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" /> Check-ins
          </CardTitle>
          <div className="inline-flex rounded-md border p-1">
            {(["day", "month"] as const).map((v) => (
              <Button key={v} size="sm" variant={view === v ? "secondary" : "ghost"} className="h-8" onClick={() => setView(v)}>
                {v === "day" ? "Day" : "Month"}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          The first fingerprint of each day counts as the check-in; later punches are ignored. Click any time to correct it.
        </p>
        {view === "day" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input type="date" className="h-9 w-40" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {date !== today && (
              <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Today</Button>
            )}
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
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : view === "day" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <span className="font-medium">{pretty(date)}</span>
              {holidays.has(date) && <Badge variant="secondary">Holiday · {holidays.get(date)}</Badge>}
              <span className="text-muted-foreground">Shift starts {shiftLabel(dayShift) ?? "— (set it below)"}</span>
              <span className="ml-auto flex flex-wrap gap-4">
                <span><span className="font-semibold text-emerald-600">{counts.ontime}</span> on time</span>
                <span><span className="font-semibold text-red-600">{counts.late}</span> late</span>
                <span><span className="font-semibold text-amber-600">{counts.none}</span> no punch</span>
              </span>
            </div>
            <ul className="divide-y rounded-lg border">
              {dayRows.map(({ p, day, status }) => (
                <li key={p.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.trader_number || "—"}
                      {day?.edited && <span className="ml-2 text-primary">edited{day.note ? ` · ${day.note}` : ""}</span>}
                    </p>
                  </div>
                  <span className={`w-16 text-right text-lg font-semibold tabular-nums ${status.kind === "late" ? "text-red-600" : status.kind === "ontime" ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {istTime(day?.checkin_at ?? null)}
                  </span>
                  <span className="w-36"><StatusBadge status={status} /></span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p, date)} aria-label={`Edit check-in for ${p.full_name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-10 min-w-[9rem] bg-muted px-3 py-2 text-left font-medium">Employee</th>
                  {dates.map((d) => (
                    <th key={d} className={`px-1 py-2 text-center font-medium ${holidays.has(d) || statusFor(d, undefined, shifts, holidays).kind === "weekend" ? "text-muted-foreground/60" : ""}`}>
                      {Number(d.slice(8))}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">Late</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  let late = 0;
                  return (
                    <tr key={p.user_id} className="border-t">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-1.5 font-medium">{p.full_name}</td>
                      {dates.map((d) => {
                        const day = byKey.get(`${p.user_id}|${d}`);
                        const st = statusFor(d, day, shifts, holidays);
                        if (st.kind === "late") late++;
                        const tone =
                          st.kind === "late" ? "bg-red-500/10 text-red-700 dark:text-red-400"
                            : st.kind === "ontime" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : st.kind === "none" ? "text-amber-600"
                                : "text-muted-foreground/40";
                        const label = day?.checkin_at ? istTime(day.checkin_at) : st.kind === "none" ? "×" : st.kind === "holiday" ? "H" : "·";
                        return (
                          <td key={d} className="p-0.5 text-center">
                            <button
                              type="button"
                              disabled={st.kind === "future"}
                              onClick={() => openEdit(p, d)}
                              title={`${p.full_name} · ${d}${day?.edited ? " · edited" : ""}`}
                              className={`w-full min-w-[2.75rem] whitespace-nowrap rounded px-1 py-1 tabular-nums transition-colors hover:ring-1 hover:ring-primary ${tone} ${day?.edited ? "underline decoration-dotted" : ""}`}
                            >
                              {label}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 text-center font-semibold tabular-nums text-red-600">{late || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Green: on time · Red: late · × no punch on a working day · H holiday · dotted underline: corrected by an admin.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>{edit.person.full_name}</DialogTitle>
                <DialogDescription>
                  {pretty(edit.date)} · device punch {istTime(edit.day?.device_checkin ?? null)}
                  {edit.day?.edited && " · currently corrected"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ci-time">Check-in time (India)</Label>
                  <Input id="ci-time" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-36" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ci-note">Note (optional)</Label>
                  <Input id="ci-note" value={editNote} maxLength={500} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. forgot to punch, came at 3:10" />
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex gap-2">
                  {edit.day?.edited && (
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => void run(() => resetCorrection(edit.person.user_id, edit.date), "Back to the device punch")}>
                      Use device punch
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive" disabled={saving} onClick={() => void run(() => saveCorrection(edit.person.user_id, edit.date, null, editNote), "Check-in removed for this day")}>
                    No check-in
                  </Button>
                </div>
                <Button disabled={saving || !/^\d{2}:\d{2}$/.test(editTime)} onClick={() => void run(() => saveCorrection(edit.person.user_id, edit.date, editTime, editNote), "Check-in saved")}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CheckIns;
