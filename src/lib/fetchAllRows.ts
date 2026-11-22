/**
 * Supabase returns at most 1,000 rows per request. This loads every row by
 * paging, and THROWS on any error so callers never work with partial data.
 *
 * Usage (the query must have a stable order):
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from("trading_data").select("*").eq("user_id", id)
 *       .order("trade_date").order("id").range(from, to));
 */
export const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maxPages = 200,
  parallel = 4
): Promise<T[]> {
  const all: T[] = [];
  // First page alone (most queries fit in one), then the rest `parallel` at a time.
  for (let start = 0; start < maxPages; start += start === 0 ? 1 : parallel) {
    const count = start === 0 ? 1 : Math.min(parallel, maxPages - start);
    const results = await Promise.all(
      Array.from({ length: count }, (_, i) => {
        const from = (start + i) * PAGE_SIZE;
        return page(from, from + PAGE_SIZE - 1);
      })
    );
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) return all;
    }
  }
  throw new Error(`Stopped after ${maxPages * PAGE_SIZE} rows; refine the query.`);
}

/** YYYY-MM-DD for a local calendar date (never shifts a day like toISOString). */
export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Throw if a Supabase call failed, so errors are never silently ignored. */
export function must<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}
