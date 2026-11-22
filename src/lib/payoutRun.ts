import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows, must } from "@/lib/fetchAllRows";
import { getAllTradeRows, rowsByPerson } from "@/lib/tradeCache";
import { computeHistory, DEFAULT_SEAT_COST, type HistoryMonth } from "@/lib/payoutEngine";
import { getLeaveBalanceSummary } from "@/lib/payoutCalculations";
import { mergeAttendance } from "@/lib/attendance";
import { loadTransfers, transfersNetByMonth } from "@/lib/pnlTransfers";
import { loadDefaultSalaries, TRAINEE_STIPEND_INR } from "@/lib/salary";

export interface PayoutRunRow {
  userId: string;
  name: string;
  traderNumber: string;
  /** Engine result for the month (null for trainees, who are paid a stipend from the pool). */
  result: HistoryMonth | null;
  isTrainee: boolean;
  /** Default monthly salary in ₹ (Users tab / Salary Backup), or the trainee stipend. */
  defaultSalary: number;
  seatCost: number;
  /** Saved STO ledger row for the month, if any. */
  saved: any | null;
  /** Saved figures differ from today's calculation. */
  changedSinceSave: boolean;
  payoutRecord: any | null;
}

export interface PayoutRunData {
  rows: PayoutRunRow[];
  usdToInr: number | null;
  transfersAvailable: boolean;
}

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/**
 * Everything the Payout Run page needs for one STO month: every employee who
 * traded, received an adjustment, or has a saved STO record that month.
 */
export async function loadPayoutRun(year: number, month: number): Promise<PayoutRunData> {
  const monthKey = key(year, month);
  const monthEnd = `${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const [allRows, attendance, configs, transfers, profilesRes, baselinesRes, carryRes, stoRes, recordsRes, rateRes] =
    await Promise.all([
      getAllTradeRows(),
      fetchAllRows<any>((f, t) =>
        supabase
          .from("attendance_records")
          .select("id, user_id, record_date, status, is_deductible, notes")
          .gte("record_date", `${year}-01-01`)
          .lte("record_date", monthEnd)
          .order("id")
          .range(f, t)
      ),
      fetchAllRows<any>((f, t) => supabase.from("trader_config").select("*").order("id").range(f, t)),
      loadTransfers(),
      supabase.from("profiles").select("user_id, full_name, trader_number, joining_date, employee_role"),
      supabase.from("trader_baselines").select("user_id, as_of_date, baseline_days, baseline_net_profit"),
      supabase.from("leave_carry_forward").select("user_id, carry_forward_days").eq("year", year),
      supabase.from("sto_ledger").select("*").eq("month", month).eq("year", year),
      supabase.from("payout_records").select("*").eq("month", month).eq("year", year),
      supabase.from("monthly_exchange_rates").select("usd_to_inr").eq("month", month).eq("year", year).maybeSingle(),
    ]);
  [profilesRes, baselinesRes, carryRes, stoRes, recordsRes, rateRes].forEach(must);
  const [adminRolesRes, salaries] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "admin"),
    loadDefaultSalaries(year),
  ]);
  if (transfers.error) throw new Error(transfers.error);

  const rows = allRows.filter((r: any) => r.trade_date <= monthEnd);
  const byPerson = rowsByPerson(rows);
  const profiles = profilesRes.data ?? [];
  const savedByUser = new Map((stoRes.data ?? []).map((s: any) => [s.user_id, s]));
  const recordByUser = new Map((recordsRes.data ?? []).map((r: any) => [r.user_id, r]));

  // Who is in this month's run
  const ids = new Set<string>(savedByUser.keys());
  // Everyone on the payroll gets a row (salary is paid in loss months too),
  // except admin accounts that don't trade.
  const adminIds = new Set((adminRolesRes.data ?? []).map((r: any) => r.user_id));
  profiles.forEach((p: any) => {
    if (["trader", "trainee"].includes((p.employee_role || "").toLowerCase()) && !adminIds.has(p.user_id)) ids.add(p.user_id);
  });
  rows.forEach((r) => {
    if (!r.trade_date.startsWith(monthKey)) return;
    ids.add(r.user_id);
    if ((r.trader2_role || "").toLowerCase() === "partner" && r.trader2_id) ids.add(r.trader2_id);
  });
  transfers.rows.forEach((t) => {
    if (t.year === year && t.month === month) {
      ids.add(t.from_user_id);
      ids.add(t.to_user_id);
    }
  });

  const merged = mergeAttendance(attendance, rows.filter((r) => r.trade_date >= `${year}-01-01`));

  const result: PayoutRunRow[] = [];
  for (const userId of ids) {
    const profile = profiles.find((p: any) => p.user_id === userId);
    if (!profile) continue;
    const salaryInfo = salaries.get(userId);
    const hasActivity = (byPerson.get(userId) ?? []).some((r: any) => r.trade_date.startsWith(monthKey));
    if ((profile.employee_role || "").toLowerCase() === "trainee" && !hasActivity && !savedByUser.has(userId)) {
      result.push({
        userId,
        name: profile.full_name,
        traderNumber: profile.trader_number || "",
        result: null,
        isTrainee: true,
        defaultSalary: salaryInfo?.salary || TRAINEE_STIPEND_INR,
        seatCost: 0,
        saved: null,
        changedSinceSave: false,
        payoutRecord: recordByUser.get(userId) ?? null,
      });
      continue;
    }
    const mine = byPerson.get(userId) ?? [];
    const myConfigs = new Map(configs.filter((c) => c.user_id === userId).map((c) => [key(c.year, c.month), c]));
    const transferNet = transfersNetByMonth(userId, transfers.rows);
    const saved = savedByUser.get(userId) ?? null;
    const carry = Number((carryRes.data ?? []).find((c: any) => c.user_id === userId)?.carry_forward_days) || 0;
    const suggestedLeave = getLeaveBalanceSummary(
      merged.filter((a) => a.user_id === userId),
      month,
      year,
      carry,
      profile.joining_date
    ).deductionPercent;
    // A saved month keeps the leave % the admin chose.
    const leavePct = saved ? Number(saved.leave_deduction_percent) || 0 : suggestedLeave;
    const b = (baselinesRes.data ?? []).find((x: any) => x.user_id === userId);

    const history = computeHistory({
      personId: userId,
      rows: mine,
      throughMonth: monthKey,
      startMonth: profile.joining_date ? profile.joining_date.slice(0, 7) : null,
      baseline: b
        ? { asOfDate: b.as_of_date, days: Number(b.baseline_days) || 0, netProfit: Number(b.baseline_net_profit) || 0 }
        : null,
      configFor: (k) => {
        const c = myConfigs.get(k);
        return {
          seatCost: c?.software_cost != null ? Number(c.software_cost) : DEFAULT_SEAT_COST,
          mode: c?.config_mode,
          stoPercent: c?.sto_percentage != null ? Number(c.sto_percentage) : undefined,
          ltoPercent: c?.lto_percentage != null ? Number(c.lto_percentage) : undefined,
          leavePct: k === monthKey ? leavePct : 0,
          transfersNet: transferNet.get(k) ?? 0,
        };
      },
    });
    const m = history.byMonth.get(monthKey);
    if (!m) continue;
    const seatCfg = myConfigs.get(monthKey);
    result.push({
      userId,
      name: profile.full_name,
      traderNumber: profile.trader_number || "",
      result: m,
      isTrainee: false,
      defaultSalary: salaryInfo?.salary ?? 0,
      seatCost: seatCfg?.software_cost != null ? Number(seatCfg.software_cost) : DEFAULT_SEAT_COST,
      saved,
      changedSinceSave:
        !!saved && (!near(Number(saved.final_sto_amount), m.finalSto) || !near(Number(saved.net_profit), m.netProfit)),
      payoutRecord: recordByUser.get(userId) ?? null,
    });
  }

  result.sort((a, b) => Number(a.isTrainee) - Number(b.isTrainee) || (a.traderNumber || "zzz").localeCompare(b.traderNumber || "zzz") || a.name.localeCompare(b.name));
  return {
    rows: result,
    usdToInr: rateRes.data?.usd_to_inr != null ? Number(rateRes.data.usd_to_inr) : null,
    transfersAvailable: transfers.available,
  };
}
