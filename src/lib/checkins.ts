import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

/**
 * Daily check-ins from the biometric device: the first punch of each day
 * (later punches such as check-out are ignored), or an admin's correction.
 * Times are India time. Nothing here changes attendance records.
 */
export const IST = "Asia/Kolkata";

export interface CheckinDay {
  user_id: string;
  punch_date: string; // YYYY-MM-DD
  device_checkin: string | null;
  checkin_at: string | null;
  edited: boolean;
  note: string | null;
  /** Admin's decision for the day, if any. */
  decided_status: "ontime" | "late" | "half_day" | "absent" | null;
}
export interface Shift {
  effective_from: string;
  shift_start: string; // HH:MM:SS
  grace_minutes: number;
  /** Later than this many minutes after the start → "Half day?" for review. */
  half_day_after_minutes: number;
  /** A first punch this many minutes after the start is really a check-out → "Missed check-in". */
  checkout_after_minutes: number;
  notes?: string | null;
}
export type DayStatus =
  | { kind: "ontime"; minutes: number; byAdmin?: boolean }
  | { kind: "late"; minutes: number | null; byAdmin?: boolean }
  | { kind: "half_day"; minutes: number | null; byAdmin?: boolean }
  | { kind: "absent"; byAdmin: true }
  /** Needs a decision: probably a half day (came very late). */
  | { kind: "half_day_review"; minutes: number }
  /** Needs a decision: only a late punch (probably a check-out), no check-in. */
  | { kind: "missed"; at: string }
  /** No punch, but a leave/absence is recorded in Leaves. */
  | { kind: "leave"; label: string }
  | { kind: "none" }
  | { kind: "weekend" }
  | { kind: "holiday"; name: string }
  | { kind: "future" };

export async function loadCheckins(from: string, to: string, userId?: string): Promise<CheckinDay[]> {
  return fetchAllRows<CheckinDay>((f, t) => {
    let q = supabase
      .from("daily_checkins" as never)
      .select("*")
      .gte("punch_date", from)
      .lte("punch_date", to);
    if (userId) q = q.eq("user_id", userId);
    return q.order("punch_date").order("user_id").range(f, t) as never;
  });
}

export async function loadShifts(): Promise<Shift[]> {
  const { data } = await supabase.from("attendance_shift_settings").select("effective_from, shift_start, grace_minutes, half_day_after_minutes, checkout_after_minutes, notes").order("effective_from");
  return (data ?? []) as Shift[];
}

export async function loadHolidays(from: string, to: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("holidays").select("holiday_date, name").gte("holiday_date", from).lte("holiday_date", to);
  return new Map((data ?? []).map((h: { holiday_date: string; name: string }) => [h.holiday_date, h.name]));
}

/** HH:MM in India time. */
export const istTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" }) : "—";
const istMinutes = (iso: string) => {
  const [h, m] = istTime(iso).split(":").map(Number);
  return h * 60 + m;
};

/** Shift in force on a date (latest setting effective on or before it). */
export const shiftFor = (date: string, shifts: Shift[]) =>
  [...shifts].reverse().find((s) => s.effective_from <= date) ?? null;

export const shiftLabel = (s: Shift | null) => (s ? s.shift_start.slice(0, 5) : null);

export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });

export const isWeekend = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};

/** Minutes after shift start (negative = early), or null without a shift. */
export function minutesLate(date: string, iso: string, shifts: Shift[]) {
  const shift = shiftFor(date, shifts);
  if (!shift) return null;
  const [h, m] = shift.shift_start.split(":").map(Number);
  return istMinutes(iso) - (h * 60 + m);
}

/**
 * One status per person per day. Precedence: admin decision → admin-corrected
 * or device first punch (on time / late / half day? / missed check-in) →
 * holiday → weekend → recorded leave → no punch.
 */
export function statusFor(
  date: string,
  day: CheckinDay | undefined,
  shifts: Shift[],
  holidays: Map<string, string>,
  leave?: string | null
): DayStatus {
  const late = day?.checkin_at ? minutesLate(date, day.checkin_at, shifts) : null;
  switch (day?.decided_status) {
    case "ontime":
      return { kind: "ontime", minutes: late ?? 0, byAdmin: true };
    case "late":
      return { kind: "late", minutes: late, byAdmin: true };
    case "half_day":
      return { kind: "half_day", minutes: late, byAdmin: true };
    case "absent":
      return { kind: "absent", byAdmin: true };
  }
  if (day?.checkin_at) {
    const shift = shiftFor(date, shifts);
    if (!shift || late === null) return { kind: "ontime", minutes: 0 };
    if (late <= (shift.grace_minutes || 0)) return { kind: "ontime", minutes: late };
    // A device punch long after the start is a check-out, not a check-in.
    if (!day.edited && late >= (shift.checkout_after_minutes ?? 240)) return { kind: "missed", at: day.checkin_at };
    if (late > (shift.half_day_after_minutes ?? 120)) return { kind: "half_day_review", minutes: late };
    return { kind: "late", minutes: late };
  }
  if (day?.edited) return { kind: "absent", byAdmin: true };
  if (holidays.has(date)) return { kind: "holiday", name: holidays.get(date)! };
  if (isWeekend(date)) return { kind: "weekend" };
  if (date > todayIST()) return { kind: "future" };
  if (leave) return { kind: "leave", label: leave };
  return { kind: "none" };
}

export const lateText = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** All dates (YYYY-MM-DD) in a month. */
export const monthDates = (year: number, month: number) =>
  Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);

export type Decision = "ontime" | "late" | "half_day" | "absent";

/** Admin decision for a day: status, optional check-in time (HH:MM India time) and note. */
export async function saveCorrection(userId: string, date: string, time: string | null, note: string | null, status: Decision | null = null) {
  const checkin_at = time ? `${date}T${time}:00+05:30` : null;
  const { error } = await supabase
    .from("checkin_overrides" as never)
    .upsert({ user_id: userId, punch_date: date, checkin_at, note: note?.trim() || null, status } as never, { onConflict: "user_id,punch_date" });
  if (error) throw new Error(error.message);
}

/** Remove an admin correction so the device's first punch is used again. */
export async function resetCorrection(userId: string, date: string) {
  const { error } = await supabase.from("checkin_overrides" as never).delete().eq("user_id", userId).eq("punch_date", date);
  if (error) throw new Error(error.message);
}

/** Leave/absence recorded in Leaves (attendance_records) per user and date. */
export async function loadLeaves(from: string, to: string, userId?: string): Promise<Map<string, string>> {
  let q = supabase.from("attendance_records").select("user_id, record_date, status").gte("record_date", from).lte("record_date", to);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  const label: Record<string, string> = { absent: "Leave / absent", half_day: "Half day (leave)", late: "Late (recorded)" };
  return new Map(
    (data ?? [])
      .filter((r: { status: string }) => r.status !== "late")
      .map((r: { user_id: string; record_date: string; status: string }) => [`${r.user_id}|${r.record_date}`, label[r.status] ?? r.status])
  );
}

/** Save shift rules effective from a date (replaces the rules for that date). */
export async function saveShift(s: { effective_from: string; shift_start: string; grace_minutes: number; half_day_after_minutes: number; checkout_after_minutes: number; notes: string | null }) {
  const { error } = await supabase.from("attendance_shift_settings").upsert(s as never, { onConflict: "effective_from" });
  if (error) throw new Error(error.message);
}

/** Turn fingerprint check-ins on or off for one person. */
export async function setUsesBiometric(userId: string, on: boolean) {
  const { error } = await supabase.from("profiles").update({ uses_biometric: on } as never).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Statuses that need an admin decision. */
export const needsReview = (s: DayStatus) => s.kind === "missed" || s.kind === "half_day_review" || s.kind === "none";
