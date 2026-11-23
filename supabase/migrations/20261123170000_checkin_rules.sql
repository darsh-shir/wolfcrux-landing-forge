-- 1. Who uses the fingerprint machine (people who don't come to the office are excluded).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uses_biometric boolean NOT NULL DEFAULT true;

-- 2. Admin decision for a day: on time / late / half day / absent (optional time and note).
ALTER TABLE public.checkin_overrides ADD COLUMN IF NOT EXISTS status text
  CHECK (status IS NULL OR status IN ('ontime', 'late', 'half_day', 'absent'));

-- 3. Shift rules: how late becomes "half day?", and when a first punch is really a check-out.
ALTER TABLE public.attendance_shift_settings
  ADD COLUMN IF NOT EXISTS half_day_after_minutes integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS checkout_after_minutes integer NOT NULL DEFAULT 240;

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
  o.note,
  o.status AS decided_status
FROM firsts f
FULL JOIN public.checkin_overrides o ON o.user_id = f.user_id AND o.punch_date = f.punch_date;
GRANT SELECT ON public.daily_checkins TO authenticated;
