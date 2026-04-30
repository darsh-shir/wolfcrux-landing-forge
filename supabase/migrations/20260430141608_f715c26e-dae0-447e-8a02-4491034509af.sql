-- Update milestone recalculation to include baseline net profit when promoting levels.
-- Baseline (set in trader_baselines) represents pre-tracking profit and should
-- count toward level thresholds, but we never modify ledgers retroactively.

CREATE OR REPLACE FUNCTION public.recalc_trader_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_real numeric := 0;
  v_baseline numeric := 0;
  v_total numeric := 0;
  v_level int := 0;
  v_sto numeric := 20;
  v_lto numeric := 0;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT COALESCE(SUM(net_profit), 0) INTO v_real
  FROM sto_ledger WHERE user_id = v_user;

  SELECT COALESCE(baseline_net_profit, 0) INTO v_baseline
  FROM trader_baselines WHERE user_id = v_user;

  v_total := v_real + COALESCE(v_baseline, 0);

  v_level := CASE
    WHEN v_total >= 500000 THEN 4
    WHEN v_total >= 300000 THEN 3
    WHEN v_total >= 150000 THEN 2
    WHEN v_total >= 50000  THEN 1
    ELSE 0
  END;

  v_sto := CASE v_level
    WHEN 0 THEN 20 WHEN 1 THEN 25 WHEN 2 THEN 35 WHEN 3 THEN 45 WHEN 4 THEN 55
  END;
  v_lto := CASE v_level
    WHEN 0 THEN 0 WHEN 1 THEN 10 WHEN 2 THEN 15 WHEN 3 THEN 20 WHEN 4 THEN 25
  END;

  -- Store ONLY real profit in trader_milestones.cumulative_net_profit so the
  -- ledger figure stays auditable; the level reflects baseline + real.
  UPDATE trader_milestones
  SET cumulative_net_profit = v_real,
      current_level = v_level,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  UPDATE trader_config
  SET sto_percentage = v_sto,
      lto_percentage = v_lto,
      payout_percentage = v_sto,
      updated_at = now()
  WHERE user_id = v_user
    AND config_mode = 'milestone'
    AND (sto_percentage IS DISTINCT FROM v_sto
      OR lto_percentage IS DISTINCT FROM v_lto
      OR payout_percentage IS DISTINCT FROM v_sto);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- When a baseline is added/changed/removed, recompute the affected trader's level.
CREATE OR REPLACE FUNCTION public.recalc_milestone_from_baseline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_real numeric := 0;
  v_baseline numeric := 0;
  v_total numeric := 0;
  v_level int := 0;
  v_sto numeric := 20;
  v_lto numeric := 0;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT COALESCE(SUM(net_profit), 0) INTO v_real
  FROM sto_ledger WHERE user_id = v_user;

  IF TG_OP <> 'DELETE' THEN
    v_baseline := COALESCE(NEW.baseline_net_profit, 0);
  END IF;

  v_total := v_real + v_baseline;

  v_level := CASE
    WHEN v_total >= 500000 THEN 4
    WHEN v_total >= 300000 THEN 3
    WHEN v_total >= 150000 THEN 2
    WHEN v_total >= 50000  THEN 1
    ELSE 0
  END;

  v_sto := CASE v_level
    WHEN 0 THEN 20 WHEN 1 THEN 25 WHEN 2 THEN 35 WHEN 3 THEN 45 WHEN 4 THEN 55
  END;
  v_lto := CASE v_level
    WHEN 0 THEN 0 WHEN 1 THEN 10 WHEN 2 THEN 15 WHEN 3 THEN 20 WHEN 4 THEN 25
  END;

  -- Ensure a trader_milestones row exists, then update level only.
  INSERT INTO trader_milestones (user_id, account_start_date, current_level, cumulative_net_profit)
  VALUES (v_user, COALESCE((SELECT joining_date FROM profiles WHERE user_id = v_user), CURRENT_DATE), v_level, v_real)
  ON CONFLICT DO NOTHING;

  UPDATE trader_milestones
  SET current_level = v_level,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  UPDATE trader_config
  SET sto_percentage = v_sto,
      lto_percentage = v_lto,
      payout_percentage = v_sto,
      updated_at = now()
  WHERE user_id = v_user
    AND config_mode = 'milestone'
    AND (sto_percentage IS DISTINCT FROM v_sto
      OR lto_percentage IS DISTINCT FROM v_lto
      OR payout_percentage IS DISTINCT FROM v_sto);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_milestone_from_baseline ON public.trader_baselines;
CREATE TRIGGER trg_recalc_milestone_from_baseline
AFTER INSERT OR UPDATE OR DELETE ON public.trader_baselines
FOR EACH ROW EXECUTE FUNCTION public.recalc_milestone_from_baseline();