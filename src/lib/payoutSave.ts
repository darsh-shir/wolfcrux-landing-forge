import { supabase } from "@/integrations/supabase/client";
import { localDateKey, must } from "@/lib/fetchAllRows";
import type { MonthResult } from "@/lib/payoutEngine";

const r2 = (n: number) => Math.round(n * 100) / 100;
/** 1st of the month `offset` months after (year, month), as a local date key. */
const firstOfMonthAfter = (year: number, month: number, offset: number) =>
  localDateKey(new Date(year, month - 1 + offset, 1));

/**
 * Save one trader's month (STO ledger, LTO ledger, seat software cost) exactly
 * as calculated by the payout engine. Used by the Payout Sheet and Payout Run.
 * Throws on any database error. LTO that was already released is never changed.
 */
export async function saveTraderMonth(params: {
  userId: string;
  year: number;
  month: number;
  result: MonthResult;
  seatCost: number;
}): Promise<void> {
  const { userId, year, month, result: m, seatCost } = params;

  const { data: cfg } = must(
    await supabase.from("trader_config").select("id").eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle()
  );
  if (cfg?.id) {
    must(await supabase.from("trader_config").update({ software_cost: seatCost }).eq("id", cfg.id));
  } else {
    must(await supabase.from("trader_config").insert({ user_id: userId, month, year, software_cost: seatCost }));
  }

  must(
    await supabase.from("sto_ledger").upsert(
      {
        user_id: userId,
        month,
        year,
        gross_profit: r2(m.grossPnl),
        shares_traded: Math.round(m.shares),
        share_cost: r2(m.shareCost),
        software_cost: r2(m.softwareCost),
        net_profit: r2(m.netProfit),
        sto_percentage: m.stoPercent,
        sto_amount: r2(m.sto),
        leave_deduction_percent: m.leavePct,
        leave_deduction_amount: r2(m.leaveDeductionSto),
        trainee_pool_contribution: r2(m.secondPcShare),
        final_sto_amount: r2(m.finalSto),
        payout_due_date: firstOfMonthAfter(year, month, 3),
      },
      { onConflict: "user_id,month,year" }
    )
  );

  const { data: lto } = must(
    await supabase.from("lto_ledger").select("id, is_released").eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle()
  );
  if (lto?.is_released) return;
  if (Math.abs(m.finalLto) < 0.005) {
    if (lto?.id) must(await supabase.from("lto_ledger").delete().eq("id", lto.id));
    return;
  }
  must(
    await supabase.from("lto_ledger").upsert(
      {
        user_id: userId,
        month,
        year,
        net_profit: r2(m.netProfit),
        lto_percentage: m.ltoPercent,
        lto_amount: r2(m.finalLto),
        unlock_date: firstOfMonthAfter(year, month, 12),
      },
      { onConflict: "user_id,month,year" }
    )
  );
}

export async function saveExchangeRate(year: number, month: number, usdToInr: number) {
  must(
    await supabase
      .from("monthly_exchange_rates")
      .upsert({ month, year, usd_to_inr: usdToInr }, { onConflict: "month,year" })
  );
}
