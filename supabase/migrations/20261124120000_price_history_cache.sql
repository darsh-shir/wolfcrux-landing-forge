-- Shared daily price-history cache for the Terminal "Pairs" tab.
-- The first logged-in user each trading day fetches a ticker's completed daily
-- bars from the market data provider and stores them here; everyone else reads
-- this copy instead of fetching again.
CREATE TABLE IF NOT EXISTS public.price_history_cache (
  ticker TEXT PRIMARY KEY,
  trading_day DATE NOT NULL,
  bars JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_history_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users read price history" ON public.price_history_cache;
CREATE POLICY "Signed-in users read price history"
  ON public.price_history_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Signed-in users add price history" ON public.price_history_cache;
CREATE POLICY "Signed-in users add price history"
  ON public.price_history_cache FOR INSERT TO authenticated
  WITH CHECK (ticker ~ '^[A-Z.\-]{1,10}$' AND jsonb_typeof(bars) = 'array');

DROP POLICY IF EXISTS "Signed-in users refresh price history" ON public.price_history_cache;
CREATE POLICY "Signed-in users refresh price history"
  ON public.price_history_cache FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (ticker ~ '^[A-Z.\-]{1,10}$' AND jsonb_typeof(bars) = 'array');

GRANT SELECT, INSERT, UPDATE ON public.price_history_cache TO authenticated;
GRANT ALL ON public.price_history_cache TO service_role;
