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
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
  maxPages = 200,
  parallel = 8
): Promise<T[]> {
  // If the query asks for an exact count, fetch every remaining page at once.
  const first = await page(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);
  const firstRows = first.data ?? [];
  if (firstRows.length < PAGE_SIZE) return firstRows;
  if (typeof first.count === "number") {
    const pages = Math.ceil(first.count / PAGE_SIZE);
    if (pages > maxPages) throw new Error(`Stopped after ${maxPages * PAGE_SIZE} rows; refine the query.`);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => page((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE - 1))
    );
    const all = [...firstRows];
    for (const r of rest) {
      if (r.error) throw new Error(r.error.message);
      all.push(...(r.data ?? []));
    }
    // Rows added while loading could spill past the counted pages; fetch on until done.
    let from = pages * PAGE_SIZE;
    while ((rest.length ? rest[rest.length - 1].data?.length : firstRows.length) === PAGE_SIZE && from < maxPages * PAGE_SIZE) {
      const more = await page(from, from + PAGE_SIZE - 1);
      if (more.error) throw new Error(more.error.message);
      all.push(...(more.data ?? []));
      if ((more.data ?? []).length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  }
  return fetchRemaining(page, firstRows, maxPages, parallel);
}

async function fetchRemaining<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  firstRows: T[],
  maxPages: number,
  parallel: number
): Promise<T[]> {
  const all: T[] = [...firstRows];
  // The first page is already loaded; fetch the rest `parallel` at a time.
  for (let start = 1; start < maxPages; start += parallel) {
    const count = Math.min(parallel, maxPages - start);
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
