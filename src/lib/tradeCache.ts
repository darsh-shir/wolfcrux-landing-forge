import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

/**
 * All trade rows (only the columns payouts need), kept in memory for a short
 * time so switching months or admin tabs doesn't download the whole history
 * again. Call `invalidateTradeCache()` after trades are added or edited.
 */
// All columns, so the Admin page (which needs notes, accounts, etc.) can share it.
export const TRADE_COLS = "*";

const TTL_MS = 2 * 60_000;
let cached: { at: number; promise: Promise<any[]> } | null = null;

export function getAllTradeRows(): Promise<any[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.promise;
  const promise = fetchAllRows<any>((f, t) =>
    supabase.from("trading_data").select(TRADE_COLS).order("trade_date").order("id").range(f, t)
  );
  cached = { at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null; // don't cache failures
  });
  return promise;
}

export function invalidateTradeCache() {
  cached = null;
}

/** Group rows by every person involved (primary trader and partner). */
export function rowsByPerson(rows: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  const add = (id: string | null, r: any) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(r);
  };
  for (const r of rows) {
    add(r.user_id, r);
    if (r.trader2_id && r.trader2_id !== r.user_id) add(r.trader2_id, r);
  }
  return map;
}
