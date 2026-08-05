CREATE TABLE IF NOT EXISTS public.stock_correlations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stock1 TEXT NOT NULL,
  stock2 TEXT NOT NULL,
  correlation NUMERIC(6,2) NOT NULL
);

GRANT SELECT ON public.stock_correlations TO anon;
GRANT SELECT, INSERT, DELETE ON public.stock_correlations TO authenticated;
GRANT ALL ON public.stock_correlations TO service_role;

ALTER TABLE public.stock_correlations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Correlations are viewable by everyone" ON public.stock_correlations;
CREATE POLICY "Correlations are viewable by everyone"
  ON public.stock_correlations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert correlations" ON public.stock_correlations;
CREATE POLICY "Admins can insert correlations"
  ON public.stock_correlations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete correlations" ON public.stock_correlations;
CREATE POLICY "Admins can delete correlations"
  ON public.stock_correlations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS stock_correlations_stock1_idx ON public.stock_correlations (stock1);
CREATE INDEX IF NOT EXISTS stock_correlations_stock2_idx ON public.stock_correlations (stock2);
CREATE INDEX IF NOT EXISTS stock_correlations_abs_idx ON public.stock_correlations (abs(correlation) DESC);