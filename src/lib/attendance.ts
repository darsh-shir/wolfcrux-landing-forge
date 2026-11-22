/**
 * Attendance used for leave balances and leave deductions.
 *
 * Absences, half days and late marks can be recorded in two places: the
 * attendance records (manual or biometric) and the attendance chosen on the
 * daily trade entry. Every screen (admin Leaves, Payout Sheet, the trader's
 * own leave tab) merges them the same way here. A stored record always wins
 * over one derived from a trade entry for the same person and day.
 */
export type AttendanceStatus = "present" | "absent" | "half_day" | "late";

export interface AttendanceRecord {
  id: string;
  user_id: string;
  record_date: string;
  status: AttendanceStatus;
  is_deductible: boolean;
  notes: string | null;
  source?: "manual" | "trading" | "biometric";
}

export interface TradeAttendanceRow {
  id: string;
  user_id: string;
  trader2_id: string | null;
  trader2_role?: string | null;
  trade_date: string;
  trader1_attendance?: string | null;
  trader2_attendance?: string | null;
  late_remarks?: string | null;
}

const normalise = (status: string | null | undefined, lateRemark: boolean): AttendanceStatus | null => {
  const s = (status || "").toLowerCase();
  if (s === "absent") return "absent";
  if (s === "half_day") return "half_day";
  if (s === "late" || (s === "present" && lateRemark)) return "late";
  return null; // present / holiday: nothing to record
};

export function mergeAttendance(stored: any[], tradeRows: TradeAttendanceRow[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = stored.map((r: any) => ({
    ...r,
    source: r.source === "biometric" ? "biometric" : "manual",
  }));
  const seen = new Set(records.map((r) => `${r.user_id}|${r.record_date}`));

  const add = (row: TradeAttendanceRow, uid: string | null, status: string | null | undefined, lateRemark: boolean) => {
    if (!uid) return;
    const norm = normalise(status, lateRemark);
    if (!norm) return;
    const key = `${uid}|${row.trade_date}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      id: `td-${row.id}-${uid}`,
      user_id: uid,
      record_date: row.trade_date,
      status: norm,
      is_deductible: norm !== "late",
      notes: norm === "late" ? row.late_remarks || "Late (from trading entry)" : "Auto-marked from trading entry",
      source: "trading",
    });
  };

  for (const row of tradeRows) {
    add(row, row.user_id, row.trader1_attendance, !!row.late_remarks);
    const isPartner = !row.trader2_role || row.trader2_role.toLowerCase() === "partner";
    if (isPartner) add(row, row.trader2_id, row.trader2_attendance, false);
  }
  return records;
}
