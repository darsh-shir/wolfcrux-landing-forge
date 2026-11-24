import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/fetchAllRows";
import { fmtAmt } from "@/lib/utils";

/**
 * Default monthly salary (₹) per employee.
 *
 * Stored as the yearly "base salary" on the Salary Backup record
 * (salary_backups, month = 0), so the Users tab, Salary Backup tab and Payout
 * Run all use the same number. A year without its own record uses the most
 * recent earlier year's salary.
 */
export const TRAINEE_STIPEND_INR = 10_000;

export interface SalaryInfo {
  salary: number;
  /** Salary backup held for this person (₹), from the same record. */
  backup: number;
  year: number;
  recordId: string;
}

export async function loadDefaultSalaries(year: number): Promise<Map<string, SalaryInfo>> {
  const { data } = must(
    await supabase.from("salary_backups").select("id, user_id, year, base_salary, backup_amount").eq("month", 0).lte("year", year)
  );
  const map = new Map<string, SalaryInfo>();
  for (const r of data ?? []) {
    const cur = map.get(r.user_id);
    if (!cur || r.year > cur.year) map.set(r.user_id, {
        salary: Number(r.base_salary) || 0,
        backup: Number(r.backup_amount) || 0,
        year: r.year,
        recordId: r.id,
      });
  }
  return map;
}

/** Set the default salary from `year` onwards (creates that year's record if needed). */
export async function saveDefaultSalary(userId: string, year: number, salary: number): Promise<void> {
  const { data: existing } = must(
    await supabase.from("salary_backups").select("id").eq("user_id", userId).eq("year", year).eq("month", 0).maybeSingle()
  );
  if (existing?.id) {
    must(await supabase.from("salary_backups").update({ base_salary: salary }).eq("id", existing.id));
  } else {
    must(
      await supabase
        .from("salary_backups")
        .insert({ user_id: userId, year, month: 0, base_salary: salary, backup_amount: 0, notes: null })
    );
  }
}

/** Add (+) or take (−) ₹ from a salary backup record. Returns the new backup. */
export async function changeBackup(recordId: string, delta: number): Promise<number> {
  const { data } = must(await supabase.from("salary_backups").select("backup_amount").eq("id", recordId).single());
  const next = Math.round((Number(data.backup_amount) || 0) + delta);
  must(await supabase.from("salary_backups").update({ backup_amount: next }).eq("id", recordId));
  return next;
}

/** "Backup used ₹12,000" in a payout note → 12000. */
export const backupUsedFromNote = (note: string | null | undefined): number => {
  const m = (note || "").match(/Backup used ₹([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
};

export const withBackupNote = (note: string | null | undefined, amount: number): string => {
  const rest = (note || "").replace(/\s*·?\s*Backup used ₹[\d,]+/g, "").trim();
  if (amount <= 0) return rest;
  const tag = `Backup used ₹${fmtAmt(Math.round(amount), 0)}`;
  return rest ? `${rest} · ${tag}` : tag;
};
