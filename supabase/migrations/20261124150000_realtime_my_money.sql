-- Let My Data refresh the moment an admin saves desk cost, salary backup,
-- payouts or LTO. Realtime still applies each table's row-level security, so a
-- person only receives changes to their own rows.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['desk_costs', 'salary_backups', 'payout_records', 'lto_ledger'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
