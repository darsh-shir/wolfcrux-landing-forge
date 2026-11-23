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
}
export interface Shift {
  effective_from: string;
  shift_start: string; // HH:MM:SS
  grace_minutes: number;
}
export type DayStatus =
  | { kind: "ontime"; minutes: number }
  | { kind: "late"; minutes: number }
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
  const { data } = await supabase.from("attendance_shift_settings").select("effective_from, shift_start, grace_minutes").order("effective_from");
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

export function statusFor(date: string, day: CheckinDay | undefined, shifts: Shift[], holidays: Map<string, string>): DayStatus {
  if (day?.checkin_at) {
    const shift = shiftFor(date, shifts);
    if (!shift) return { kind: "ontime", minutes: 0 };
    const [h, m] = shift.shift_start.split(":").map(Number);
    const diff = istMinutes(day.checkin_at) - (h * 60 + m);
    return diff > (shift.grace_minutes || 0) ? { kind: "late", minutes: diff } : { kind: "ontime", minutes: diff };
  }
  if (holidays.has(date)) return { kind: "holiday", name: holidays.get(date)! };
  if (isWeekend(date)) return { kind: "weekend" };
  if (date > todayIST()) return { kind: "future" };
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

/** Admin correction: set a check-in time (HH:MM India time), or null for "no check-in". */
export async function saveCorrection(userId: string, date: string, time: string | null, note: string | null) {
  const checkin_at = time ? `${date}T${time}:00+05:30` : null;
  const { error } = await supabase
    .from("checkin_overrides" as never)
    .upsert({ user_id: userId, punch_date: date, checkin_at, note: note?.trim() || null } as never, { onConflict: "user_id,punch_date" });
  if (error) throw new Error(error.message);
}

/** Remove an admin correction so the device's first punch is used again. */
export async function resetCorrection(userId: string, date: string) {
  const { error } = await supabase.from("checkin_overrides" as never).delete().eq("user_id", userId).eq("punch_date", date);
  if (error) throw new Error(error.message);
}
