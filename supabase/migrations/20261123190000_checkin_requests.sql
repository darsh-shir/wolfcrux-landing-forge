-- Traders ask for a check-in correction ("forgot to punch, came at 3:20");
-- an admin approves (which saves a check-in correction) or rejects it.
CREATE TABLE IF NOT EXISTS public.checkin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  punch_date date NOT NULL,
  requested_time time,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text CHECK (admin_note IS NULL OR length(admin_note) <= 500),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One open request per person per day.
CREATE UNIQUE INDEX IF NOT EXISTS checkin_requests_one_pending
  ON public.checkin_requests (user_id, punch_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS checkin_requests_status_idx ON public.checkin_requests (status, created_at DESC);

ALTER TABLE public.checkin_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage check-in requests" ON public.checkin_requests;
CREATE POLICY "Admins manage check-in requests" ON public.checkin_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Employees view own check-in requests" ON public.checkin_requests;
CREATE POLICY "Employees view own check-in requests" ON public.checkin_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Employees may only file a pending request for themselves, for a recent past day.
DROP POLICY IF EXISTS "Employees file own check-in requests" ON public.checkin_requests;
CREATE POLICY "Employees file own check-in requests" ON public.checkin_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'pending' AND decided_by IS NULL AND decided_at IS NULL AND admin_note IS NULL
    AND punch_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND punch_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 62
  );
-- ...and withdraw it while it is still pending.
DROP POLICY IF EXISTS "Employees withdraw own pending requests" ON public.checkin_requests;
CREATE POLICY "Employees withdraw own pending requests" ON public.checkin_requests
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'pending');

DROP TRIGGER IF EXISTS update_checkin_requests_updated_at ON public.checkin_requests;
CREATE TRIGGER update_checkin_requests_updated_at BEFORE UPDATE ON public.checkin_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS log_changes ON public.checkin_requests;
CREATE TRIGGER log_changes AFTER INSERT OR UPDATE OR DELETE ON public.checkin_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_change();
