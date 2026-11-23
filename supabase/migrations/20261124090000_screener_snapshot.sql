-- Daily market snapshot for the Terminal screener: a scheduled job fetches every
-- stock in batches into screener_rows, then publishes one compact file to the
-- private "screener" storage bucket, which signed-in users can read.

CREATE TABLE IF NOT EXISTS public.screener_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_date date NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_rows integer,
  pages_total integer,
  pages_done integer NOT NULL DEFAULT 0,
  failed_pages integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  error text,
  routes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.screener_rows (
  ticker text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.screener_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screener_rows ENABLE ROW LEVEL SECURITY;
-- Only admins may look at the job's progress; rows are written by the job (service role).
DROP POLICY IF EXISTS "Admins view screener runs" ON public.screener_runs;
CREATE POLICY "Admins view screener runs" ON public.screener_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('screener', 'screener', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Signed-in users read screener snapshot" ON storage.objects;
CREATE POLICY "Signed-in users read screener snapshot" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'screener');

-- Pause after the source pushes back, then resume from the same page.
ALTER TABLE public.screener_runs ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;
