import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fingerprint, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/CheckinBadge";
import {
  type CheckinDay, type Shift, istTime, loadCheckins, loadHolidays, loadLeaves, loadShifts, monthDates, shiftFor, shiftLabel, statusFor, todayIST,
} from "@/lib/checkins";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The trader's own daily check-in times (first fingerprint of the day). */
const MyCheckins = () => {
  const { user } = useAuth();
  const today = todayIST();
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [days, setDays] = useState<CheckinDay[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [leaves, setLeaves] = useState<Map<string, string>>(new Map());
  const [onFingerprint, setOnFingerprint] = useState(true);
  const [loading, setLoading] = useState(true);
  const dates = monthDates(ym.y, ym.m).filter((d) => d <= today);

  useEffect(() => {
    if (!user) return;
    const all = monthDates(ym.y, ym.m);
    setLoading(true);
    Promise.all([
      loadCheckins(all[0], all[all.length - 1], user.id),
      loadShifts(),
      loadHolidays(all[0], all[all.length - 1]),
      loadLeaves(all[0], all[all.length - 1], user.id),
      supabase.from("profiles").select("uses_biometric").eq("user_id", user.id).maybeSingle(),
    ])
      .then(([d, s, h, l, prof]) => {
        setDays(d);
        setShifts(s);
        setHolidays(h);
        setLeaves(l);
        setOnFingerprint(prof.data?.uses_biometric !== false);
      })
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [user, ym]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.punch_date, d])), [days]);
  const rows = dates
    .map((d) => ({ d, day: byDate.get(d), status: statusFor(d, byDate.get(d), shifts, holidays, leaves.get(`${user?.id}|${d}`)) }))
    .filter((r) => r.status.kind !== "weekend" || r.day?.checkin_at)
    .reverse();
  const counts = rows.reduce(
    (c, r) => ({ ...c, [r.status.kind]: (c[r.status.kind] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const currentShift = shiftLabel(shiftFor(today, shifts));
  const late = (counts.late ?? 0) + (counts.half_day ?? 0) + (counts.half_day_review ?? 0);
  const pending = (counts.none ?? 0) + (counts.missed ?? 0);

  if (!loading && !onFingerprint && days.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Fingerprint className="h-5 w-5" /> Fingerprint check-in is off for you, so there's nothing to show here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Fingerprint className="h-5 w-5 text-primary" /> My check-ins
        </CardTitle>
        <div className="flex gap-2">
          <Select value={String(ym.m)} onValueChange={(v) => setYm({ ...ym, m: Number(v) })}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ym.y)} onValueChange={(v) => setYm({ ...ym, y: Number(v) })}>
            <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[ym.y - 1, ym.y].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border bg-emerald-500/5 p-3">
            <p className="text-2xl font-bold text-emerald-600">{counts.ontime ?? 0}</p>
            <p className="text-xs text-muted-foreground">On time</p>
          </div>
          <div className="rounded-lg border bg-red-500/5 p-3">
            <p className="text-2xl font-bold text-red-600">{late}</p>
            <p className="text-xs text-muted-foreground">Late / half day</p>
          </div>
          <div className="rounded-lg border bg-amber-500/5 p-3">
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-muted-foreground">No check-in</p>
          </div>
        </div>
        {currentShift && <p className="text-xs text-muted-foreground">Shift starts at {currentShift} (India time). Your first fingerprint of the day is your check-in.</p>}
        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No days yet this month.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map(({ d, day, status }) => (
              <li key={d} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0">
                  {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                </span>
                <span className={`w-14 font-semibold tabular-nums ${status.kind === "late" ? "text-red-600" : status.kind === "ontime" ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {status.kind === "missed" ? "—" : istTime(day?.checkin_at ?? null)}
                </span>
                <StatusBadge status={status} />
                {day?.edited && <span className="ml-auto truncate text-xs text-muted-foreground" title={day.note ?? ""}>corrected{day.note ? ` · ${day.note}` : ""}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default MyCheckins;
