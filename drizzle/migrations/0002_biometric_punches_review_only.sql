-- Biometric punch records are for admin review only. Never derive or write attendance from them.
CREATE OR REPLACE FUNCTION public.process_biometric_day(_user_id uuid, _date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep the function in place for existing triggers/RPC callers, but deliberately do not
  -- create, update, or delete attendance_records from biometric punches.
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.process_biometric_day(uuid, date) FROM PUBLIC, anon, authenticated;