import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

/**
 * Month-end P&L adjustments between traders ("move $X of net profit from A to B").
 * Stored in `pnl_transfers` (added by a database update). Until that update is
 * applied, `available` is false and every amount is treated as zero.
 */
export interface PnlTransfer {
  id: string;
  month: number;
  year: number;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface TransfersResult {
  rows: PnlTransfer[];
  available: boolean;
  error?: string;
}

const missingTable = (msg: string) => /pnl_transfers|does not exist|schema cache|404/i.test(msg);

/** All transfers, or only those involving `userId`. */
export async function loadTransfers(userId?: string): Promise<TransfersResult> {
  try {
    const rows = await fetchAllRows<any>((f, t) => {
      let q = supabase.from("pnl_transfers").select("*");
      if (userId) q = q.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
      return q.order("created_at").order("id").range(f, t);
    });
    return { rows: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })), available: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], available: false, error: missingTable(msg) ? undefined : msg };
  }
}

/** Net amount moved in (+) / out (−) for a person, keyed by YYYY-MM. */
export function transfersNetByMonth(userId: string, rows: PnlTransfer[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (r.to_user_id === userId) map.set(key, (map.get(key) ?? 0) + r.amount);
    if (r.from_user_id === userId) map.set(key, (map.get(key) ?? 0) - r.amount);
  }
  return map;
}
