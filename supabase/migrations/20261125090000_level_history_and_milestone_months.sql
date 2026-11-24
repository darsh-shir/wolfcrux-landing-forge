-- Manual levels: each upgrade counts from the first day of its month and can
-- be backdated. STO/LTO % default to the level's own % but can be set per person.
CREATE TABLE IF NOT EXISTS public.level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  effective_month DATE NOT NULL CHECK (EXTRACT(DAY FROM effective_month) = 1),
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 10),
  sto_percent NUMERIC(5,2) CHECK (sto_percent IS NULL OR (sto_percent >= 0 AND sto_percent <= 100)),
  lto_percent NUMERIC(5,2) CHECK (lto_percent IS NULL OR (lto_percent >= 0 AND lto_percent <= 100)),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, effective_month)
);

-- Milestone net P&L per month, when the admin's figure differs from the
-- website's (e.g. profit made in someone else's account). Payouts are not affected.
CREATE TABLE IF NOT EXISTS public.milestone_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  net_profit NUMERIC(14,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['level_history', 'milestone_months'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "People read own %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "People read own %s" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id)', t || '_user_idx', t);
    -- Same audit trail as the other payout tables.
    EXECUTE format('DROP TRIGGER IF EXISTS log_changes ON public.%I', t);
    EXECUTE format('CREATE TRIGGER log_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_change()', t);
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
