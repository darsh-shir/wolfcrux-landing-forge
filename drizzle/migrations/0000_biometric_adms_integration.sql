-- Biometric (eSSL K90 Pro / ADMS) integration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_pin text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_biometric_pin_key ON public.profiles(biometric_pin) WHERE biometric_pin IS NOT NULL;

-- Distinguish automatic rows from manual ones; automation never touches manual rows.
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE TABLE public.attendance_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial_number text NOT NULL UNIQUE,
  device_name text NOT NULL,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  last_punch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_devices TO authenticated;
GRANT ALL ON public.attendance_devices TO service_role;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage devices" ON public.attendance_devices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.biometric_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.attendance_devices(id) ON DELETE SET NULL,
  device_serial_number text NOT NULL,
  biometric_pin text NOT NULL,
  employee_id uuid,
  punch_timestamp timestamptz NOT NULL,
  device_local_time text NOT NULL,
  punch_date date NOT NULL,
  verify_mode text,
  in_out_status text,
  work_code text,
  raw_payload text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biometric_punch_unique UNIQUE (device_serial_number, biometric_pin, punch_timestamp)
);
CREATE INDEX ON public.biometric_attendance_logs(employee_id, punch_date);
CREATE INDEX ON public.biometric_attendance_logs(biometric_pin) WHERE employee_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_attendance_logs TO authenticated;
GRANT ALL ON public.biometric_attendance_logs TO service_role;
ALTER TABLE public.biometric_attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage punches" ON public.biometric_attendance_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Employees view own punches" ON public.biometric_attendance_logs FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE TABLE public.adms_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial_number text,
  event_type text NOT NULL,
  method text,
  path text,
  table_name text,
  records_received int DEFAULT 0,
  records_accepted int DEFAULT 0,
  records_duplicate int DEFAULT 0,
  records_unmatched int DEFAULT 0,
  records_malformed int DEFAULT 0,
  payload_excerpt text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.adms_device_events(created_at DESC);
GRANT SELECT, DELETE ON public.adms_device_events TO authenticated;
GRANT ALL ON public.adms_device_events TO service_role;
ALTER TABLE public.adms_device_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view events" ON public.adms_device_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete events" ON public.adms_device_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Shift timing changes often (DST etc.), so it is stored as dated rules.
CREATE TABLE public.attendance_shift_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from date NOT NULL UNIQUE,
  shift_start time NOT NULL,
  grace_minutes int NOT NULL DEFAULT 0,
  half_day_min_hours numeric NOT NULL DEFAULT 4,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_shift_settings TO authenticated;
GRANT ALL ON public.attendance_shift_settings TO service_role;
ALTER TABLE public.attendance_shift_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shifts" ON public.attendance_shift_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users view shifts" ON public.attendance_shift_settings FOR SELECT TO authenticated USING (true);

-- Recompute automatic attendance for one employee/day (IST). Never touches manual rows.
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
    IF cnt >= 2 THEN
      hrs := extract(epoch FROM (last_out - first_in)) / 3600.0;
      IF hrs < s.half_day_min_hours THEN new_status := 'half_day'; END IF;
    END IF;
    IF new_status IS NULL AND first_in > start_ts THEN new_status := 'late'; END IF;
  END IF;

  IF new_status IS NULL THEN
    DELETE FROM attendance_records WHERE user_id=_user_id AND record_date=_date AND source='biometric';
  ELSIF EXISTS (SELECT 1 FROM attendance_records WHERE user_id=_user_id AND record_date=_date AND source='biometric') THEN
    UPDATE attendance_records SET status=new_status, is_deductible=(new_status<>'late'),
      notes='Auto (biometric): IN '||to_char(first_in AT TIME ZONE 'Asia/Kolkata','HH24:MI')||
            CASE WHEN cnt>=2 THEN ', OUT '||to_char(last_out AT TIME ZONE 'Asia/Kolkata','HH24:MI') ELSE '' END,
      updated_at=now()
    WHERE user_id=_user_id AND record_date=_date AND source='biometric';
  ELSE
    INSERT INTO attendance_records(user_id, record_date, status, is_deductible, notes, source)
    VALUES (_user_id, _date, new_status, new_status<>'late',
      'Auto (biometric): IN '||to_char(first_in AT TIME ZONE 'Asia/Kolkata','HH24:MI')||
      CASE WHEN cnt>=2 THEN ', OUT '||to_char(last_out AT TIME ZONE 'Asia/Kolkata','HH24:MI') ELSE '' END,
      'biometric');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.process_biometric_day(uuid,date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_biometric_log_process()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.employee_id IS NOT NULL THEN
    PERFORM process_biometric_day(OLD.employee_id, OLD.punch_date);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.employee_id IS NOT NULL THEN
    PERFORM process_biometric_day(NEW.employee_id, NEW.punch_date);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER biometric_log_process AFTER INSERT OR UPDATE OF employee_id OR DELETE
  ON public.biometric_attendance_logs FOR EACH ROW EXECUTE FUNCTION public.trg_biometric_log_process();

-- When an admin assigns a PIN to an employee, attach that PIN's unmatched punches.
CREATE OR REPLACE FUNCTION public.trg_profile_pin_mapped()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.biometric_pin IS NOT NULL AND NEW.biometric_pin IS DISTINCT FROM OLD.biometric_pin THEN
    UPDATE biometric_attendance_logs SET employee_id = NEW.user_id
      WHERE biometric_pin = NEW.biometric_pin AND employee_id IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_pin_mapped AFTER UPDATE OF biometric_pin ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profile_pin_mapped();

-- Recompute affected days when shift rules change
CREATE OR REPLACE FUNCTION public.recompute_biometric_range(_from date, _to date)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  FOR r IN SELECT DISTINCT employee_id, punch_date FROM biometric_attendance_logs
           WHERE employee_id IS NOT NULL AND punch_date BETWEEN _from AND _to LOOP
    PERFORM process_biometric_day(r.employee_id, r.punch_date); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.recompute_biometric_range(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_biometric_range(date,date) TO authenticated;

ALTER TABLE public.biometric_attendance_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.biometric_attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_devices;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;