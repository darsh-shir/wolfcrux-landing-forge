import { supabase } from "@/integrations/supabase/client";
import { must } from "@/lib/fetchAllRows";
import type { LevelChange } from "@/lib/payoutEngine";

/**
 * Admin-set levels (with optional per-person %) and admin milestone figures.
 *
 * level_history: one row per upgrade, effective from the 1st of its month
 * (can be backdated). milestone_months: the admin's milestone net P&L for a
 * month, used for progress only (never for payouts).
 */

export interface LevelHistoryRow {
  id: string;
  user_id: string;
  effective_month: string; // YYYY-MM-01
  level: number;
  sto_percent: number | null;
  lto_percent: number | null;
  note: string | null;
}

export interface MilestoneMonthRow {
  id: string;
  user_id: string;
  month: string; // YYYY-MM-01
  net_profit: number;
  note: string | null;
}

const toMonthDate = (monthKey: string) => `${monthKey.slice(0, 7)}-01`;

export async function loadLevelHistory(userId?: string): Promise<LevelHistoryRow[]> {
  let q = supabase.from("level_history").select("*").order("effective_month");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return []; // table not readable (e.g. older database): behave as before
  return (data ?? []) as LevelHistoryRow[];
}

export async function loadMilestoneMonths(userId?: string): Promise<MilestoneMonthRow[]> {
  let q = supabase.from("milestone_months").select("*").order("month");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as MilestoneMonthRow[];
}

export const levelChangesFor = (userId: string, rows: LevelHistoryRow[]): LevelChange[] =>
  rows
    .filter((r) => r.user_id === userId)
    .map((r) => ({
      month: r.effective_month.slice(0, 7),
      level: r.level,
      stoPercent: r.sto_percent != null ? Number(r.sto_percent) : null,
      ltoPercent: r.lto_percent != null ? Number(r.lto_percent) : null,
    }));

export const milestoneOverridesFor = (userId: string, rows: MilestoneMonthRow[]): Map<string, number> =>
  new Map(rows.filter((r) => r.user_id === userId).map((r) => [r.month.slice(0, 7), Number(r.net_profit)]));

/** Keep trader_milestones.current_level (used for LTO release) in step with the level in force now. */
async function syncStoredLevel(userId: string) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { data } = must(
    await supabase
      .from("level_history")
      .select("level")
      .eq("user_id", userId)
      .lte("effective_month", thisMonth)
      .order("effective_month", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!data) return;
  const { data: existing } = must(await supabase.from("trader_milestones").select("id").eq("user_id", userId).maybeSingle());
  if (existing?.id) {
    must(await supabase.from("trader_milestones").update({ current_level: data.level, last_evaluated_at: new Date().toISOString() }).eq("id", existing.id));
  } else {
    must(await supabase.from("trader_milestones").insert({ user_id: userId, current_level: data.level, account_start_date: new Date().toISOString().slice(0, 10) }));
  }
}

export async function saveLevelChange(input: {
  userId: string;
  month: string; // YYYY-MM
  level: number;
  stoPercent: number | null;
  ltoPercent: number | null;
  note?: string | null;
}) {
  must(
    await supabase.from("level_history").upsert(
      {
        user_id: input.userId,
        effective_month: toMonthDate(input.month),
        level: input.level,
        sto_percent: input.stoPercent,
        lto_percent: input.ltoPercent,
        note: input.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,effective_month" },
    ),
  );
  await syncStoredLevel(input.userId);
}

export async function deleteLevelChange(id: string, userId: string) {
  must(await supabase.from("level_history").delete().eq("id", id));
  await syncStoredLevel(userId);
}

export async function saveMilestoneMonth(userId: string, month: string, netProfit: number | null, note?: string | null) {
  if (netProfit === null) {
    must(await supabase.from("milestone_months").delete().eq("user_id", userId).eq("month", toMonthDate(month)));
    return;
  }
  must(
    await supabase.from("milestone_months").upsert(
      { user_id: userId, month: toMonthDate(month), net_profit: netProfit, note: note ?? null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    ),
  );
}
