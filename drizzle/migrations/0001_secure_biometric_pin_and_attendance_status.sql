-- Employee biometric PINs may only be assigned by admins (or trusted server-side service-role jobs).
CREATE OR REPLACE FUNCTION public.guard_biometric_pin_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.biometric_pin IS DISTINCT FROM OLD.biometric_pin
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change biometric PINs';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_biometric_pin_changes() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_biometric_pin_changes ON public.profiles;
CREATE TRIGGER guard_biometric_pin_changes
  BEFORE UPDATE OF biometric_pin ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_biometric_pin_changes();

-- Every mapped punch creates a biometric attendance row when a shift rule exists.
-- A timely full shift is marked present; late and short days are classified automatically.
-- Manual attendance remains authoritative and is never overwritten.
CREATE OR REPLACE FUNCTION public.process_biometric_day(_user_id uuid, _date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record; first_in timestamptz; last_out timestamptz; cnt int;
  start_ts timestamptz; hrs numeric; new_status text := NULL;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM attendance_records WHERE user_id=_user_id AND record_date=_date AND source <> 'biometric') THEN
    RETURN;
  END IF;
  SELECT min(punch_timestamp), max(punch_timestamp), count(*) INTO first_in, last_out, cnt
    FROM biometric_attendance_logs WHERE employee_id=_user_id AND punch_date=_date;
  SELECT * INTO s FROM attendance_shift_settings WHERE effective_from <= _date ORDER BY effective_from DESC LIMIT 1;

  IF cnt > 0 AND s.id IS NOT NULL THEN
    start_ts := ((_date + s.shift_start) AT TIME ZONE 'Asia/Kolkata') + make_interval(mins => s.grace_minutes);
    new_status := 'present';
    IF cnt >= 2 THEN
      hrs := extract(epoch FROM (last_out - first_in)) / 3600.0;
      IF hrs < s.half_day_min_hours THEN new_status := 'half_day'; END IF;
    END IF;
    IF new_status = 'present' AND first_in > start_ts THEN new_status := 'late'; END IF;
  END IF;

  IF new_status IS NULL THEN
    DELETE FROM attendance_records WHERE user_id=_user_id AND record_date=_date AND source='biometric';
  ELSIF EXISTS (SELECT 1 FROM attendance_records WHERE user_id=_user_id AND record_date=_date AND source='biometric') THEN
    UPDATE attendance_records SET status=new_status,
      is_deductible=(new_status IN ('absent','half_day')),
      notes='Auto (biometric): IN '||to_char(first_in AT TIME ZONE 'Asia/Kolkata','HH24:MI')||
            CASE WHEN cnt>=2 THEN ', OUT '||to_char(last_out AT TIME ZONE 'Asia/Kolkata','HH24:MI') ELSE '' END,
      updated_at=now()
    WHERE user_id=_user_id AND record_date=_date AND source='biometric';
  ELSE
    INSERT INTO attendance_records(user_id, record_date, status, is_deductible, notes, source)
    VALUES (_user_id, _date, new_status, (new_status IN ('absent','half_day')),
      'Auto (biometric): IN '||to_char(first_in AT TIME ZONE 'Asia/Kolkata','HH24:MI')||
      CASE WHEN cnt>=2 THEN ', OUT '||to_char(last_out AT TIME ZONE 'Asia/Kolkata','HH24:MI') ELSE '' END,
      'biometric');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.process_biometric_day(uuid,date) FROM PUBLIC, anon, authenticated;