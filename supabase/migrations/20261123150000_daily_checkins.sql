-- Daily check-in = the first biometric punch of each day. Later punches (e.g.
-- check-out) are still stored as raw punches for review, but not shown or used.
-- Admins can correct a day's check-in; corrections never touch attendance_records.

CREATE TABLE IF NOT EXISTS public.checkin_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  punch_date date NOT NULL,
  -- NULL means "no check-in this day" (admin removed the device punch).
  checkin_at timestamptz,
  note text CHECK (note IS NULL OR length(note) <= 500),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, punch_date)
);

ALTER TABLE public.checkin_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage check-in corrections" ON public.checkin_overrides;
CREATE POLICY "Admins manage check-in corrections" ON public.checkin_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Employees view own check-in corrections" ON public.checkin_overrides;
CREATE POLICY "Employees view own check-in corrections" ON public.checkin_overrides
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_checkin_overrides_updated_at ON public.checkin_overrides;
CREATE TRIGGER update_checkin_overrides_updated_at BEFORE UPDATE ON public.checkin_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS log_changes ON public.checkin_overrides;
CREATE TRIGGER log_changes AFTER INSERT OR UPDATE OR DELETE ON public.checkin_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- One row per person per day: the first device punch, replaced by an admin
-- correction when there is one. security_invoker = the caller's own access
-- rules apply (employees see only their own days, admins see everyone).
CREATE OR REPLACE VIEW public.daily_checkins WITH (security_invoker = true) AS
WITH firsts AS (
  SELECT employee_id AS user_id, punch_date, min(punch_timestamp) AS device_checkin
  FROM public.biometric_attendance_logs
  WHERE employee_id IS NOT NULL
  GROUP BY employee_id, punch_date
)
SELECT
  COALESCE(f.user_id, o.user_id) AS user_id,
  COALESCE(f.punch_date, o.punch_date) AS punch_date,
  f.device_checkin,
  CASE WHEN o.id IS NOT NULL THEN o.checkin_at ELSE f.device_checkin END AS checkin_at,
  (o.id IS NOT NULL) AS edited,
  o.note
FROM firsts f
FULL JOIN public.checkin_overrides o ON o.user_id = f.user_id AND o.punch_date = f.punch_date;

GRANT SELECT ON public.daily_checkins TO authenticated;
