import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import {
  computeHistory,
  DEFAULT_SEAT_COST,
  type Baseline,
  type HistoryResult,
  type MonthConfig,
  type TradeRow,
} from "@/lib/payoutEngine";

const TRADE_COLS =
  "id, trade_date, user_id, trader2_id, trader2_role, trader1_attendance, trader2_attendance, net_pnl, shares_traded";

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Month configs (seat cost, manual %) keyed by YYYY-MM. */
const configLookup = (configs: any[]) => {
  const map = new Map<string, any>(configs.map((c) => [`${c.year}-${String(c.month).padStart(2, "0")}`, c]));
  return (key: string): MonthConfig => {
    const c = map.get(key);
    return {
      seatCost: c?.software_cost != null ? Number(c.software_cost) : DEFAULT_SEAT_COST,
      mode: c?.config_mode,
      stoPercent: c?.sto_percentage != null ? Number(c.sto_percentage) : undefined,
      ltoPercent: c?.lto_percentage != null ? Number(c.lto_percentage) : undefined,
    };
  };
};

const toBaseline = (b: any): Baseline | null =>
  b
    ? { asOfDate: b.as_of_date, days: Number(b.baseline_days) || 0, netProfit: Number(b.baseline_net_profit) || 0 }
    : null;

/**
 * One trader's full payout history (levels, trading days, net profit, carried
 * losses) through the current month, using the shared payout engine.
 * Works for the trader themself (their own rows) and for admins.
 */
export const useTraderHistory = (userId: string | null | undefined) => {
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [own, asPartner, profileRes, baselineRes, configRes] = await Promise.all([
          fetchAllRows<any>((f, t) =>
            supabase.from("trading_data").select(TRADE_COLS).eq("user_id", userId).order("trade_date").order("id").range(f, t)),
          fetchAllRows<any>((f, t) =>
            supabase.from("trading_data").select(TRADE_COLS).eq("trader2_id", userId).order("trade_date").order("id").range(f, t)),
          supabase.from("profiles").select("joining_date").eq("user_id", userId).maybeSingle(),
          supabase.from("trader_baselines").select("as_of_date, baseline_days, baseline_net_profit").eq("user_id", userId).maybeSingle(),
          supabase.from("trader_config").select("*").eq("user_id", userId),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (configRes.error) throw configRes.error;
        const byId = new Map<string, TradeRow>();
        [...own, ...asPartner].forEach((r: any) => byId.set(r.id, r));
        const h = computeHistory({
          personId: userId,
          rows: [...byId.values()],
          throughMonth: currentMonthKey(),
          startMonth: profileRes.data?.joining_date?.slice(0, 7) ?? null,
          // Traders may not be allowed to read baselines; treat as none.
          baseline: baselineRes.error ? null : toBaseline(baselineRes.data),
          configFor: configLookup(configRes.data ?? []),
        });
        if (!cancelled) {
          setHistory(h);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { history, loading, error };
};

/** Every trader's history at once (admin screens). */
export const loadAllTraderHistories = async (userIds: string[]): Promise<Map<string, HistoryResult>> => {
  const [rows, profilesRes, baselinesRes, configsRes] = await Promise.all([
    fetchAllRows<any>((f, t) => supabase.from("trading_data").select(TRADE_COLS).order("trade_date").order("id").range(f, t)),
    supabase.from("profiles").select("user_id, joining_date"),
    supabase.from("trader_baselines").select("user_id, as_of_date, baseline_days, baseline_net_profit"),
    fetchAllRows<any>((f, t) => supabase.from("trader_config").select("*").order("id").range(f, t)),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (baselinesRes.error) throw baselinesRes.error;

  const through = currentMonthKey();
  const result = new Map<string, HistoryResult>();
  for (const id of userIds) {
    const mine = rows.filter((r: any) => r.user_id === id || r.trader2_id === id);
    result.set(
      id,
      computeHistory({
        personId: id,
        rows: mine,
        throughMonth: through,
        startMonth: profilesRes.data?.find((p: any) => p.user_id === id)?.joining_date?.slice(0, 7) ?? null,
        baseline: toBaseline(baselinesRes.data?.find((b: any) => b.user_id === id)),
        configFor: configLookup(configsRes.filter((c: any) => c.user_id === id)),
      })
    );
  }
  return result;
};
