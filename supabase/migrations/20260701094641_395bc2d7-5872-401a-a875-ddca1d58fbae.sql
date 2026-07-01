-- Remove stale LTO ledger rows for months where the trader's current LTO% is 0
DELETE FROM public.lto_ledger l
USING public.trader_config tc
WHERE tc.user_id = l.user_id
  AND tc.month = l.month
  AND tc.year = l.year
  AND COALESCE(tc.lto_percentage, 0) = 0
  AND l.is_released = false;

-- Touch those configs so the sync trigger recomputes STO cleanly as well
UPDATE public.trader_config
SET updated_at = now()
WHERE COALESCE(lto_percentage, 0) = 0;