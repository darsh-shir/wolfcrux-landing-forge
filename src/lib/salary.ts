import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/fetchAllRows";

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
  year: number;
  recordId: string;
}

export async function loadDefaultSalaries(year: number): Promise<Map<string, SalaryInfo>> {
  const { data } = must(
    await supabase.from("salary_backups").select("id, user_id, year, base_salary").eq("month", 0).lte("year", year)
  );
  const map = new Map<string, SalaryInfo>();
  for (const r of data ?? []) {
    const cur = map.get(r.user_id);
    if (!cur || r.year > cur.year) map.set(r.user_id, { salary: Number(r.base_salary) || 0, year: r.year, recordId: r.id });
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
