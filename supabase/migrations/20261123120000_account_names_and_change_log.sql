-- 1. Traders can read the names of the accounts their own trades were made on
--    (accounts are created without an owner, so they used to show "Unknown").
DROP POLICY IF EXISTS "Users can view accounts of their trades" ON public.trading_accounts;
CREATE POLICY "Users can view accounts of their trades" ON public.trading_accounts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trading_data t
    WHERE t.account_id = trading_accounts.id
      AND (t.user_id = auth.uid() OR t.trader2_id = auth.uid())
  ));

-- 2. Change history: who changed what, and when, on the money and people tables.
CREATE TABLE IF NOT EXISTS public.change_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  changed_by uuid DEFAULT auth.uid(),
  old_data jsonb,
  new_data jsonb
);
CREATE INDEX IF NOT EXISTS change_log_changed_at_idx ON public.change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS change_log_table_idx ON public.change_log (table_name, changed_at DESC);

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view change log" ON public.change_log;
CREATE POLICY "Admins can view change log" ON public.change_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- No insert/update/delete policies: only the trigger below writes, and nobody edits history.
REVOKE INSERT, UPDATE, DELETE ON public.change_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  n jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
BEGIN
  -- Skip updates that only touched updated_at.
  IF TG_OP = 'UPDATE' AND (o - 'updated_at') = (n - 'updated_at') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.change_log (table_name, action, row_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, TG_OP, COALESCE(n ->> 'id', o ->> 'id'), o, n);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.log_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trading_data', 'payout_records', 'sto_ledger', 'lto_ledger', 'salary_backups', 'desk_costs',
    'trader_config', 'trader_baselines', 'profiles', 'user_roles', 'attendance_records',
    'trading_accounts', 'pnl_transfers', 'monthly_exchange_rates'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS log_changes ON public.%I', t);
    EXECUTE format('CREATE TRIGGER log_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_change()', t);
  END LOOP;
END $$;
