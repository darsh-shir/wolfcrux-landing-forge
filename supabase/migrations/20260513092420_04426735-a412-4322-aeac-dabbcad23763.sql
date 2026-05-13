CREATE OR REPLACE FUNCTION public.recalc_trader_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_real numeric := 0;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT COALESCE(SUM(net_profit), 0) INTO v_real
  FROM sto_ledger WHERE user_id = v_user;

  -- Track cumulative net profit only. DO NOT auto-upgrade level or payout %.
  -- Admin promotes traders manually.
  UPDATE trader_milestones
  SET cumulative_net_profit = v_real,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_milestone_from_baseline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_real numeric := 0;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT COALESCE(SUM(net_profit), 0) INTO v_real
  FROM sto_ledger WHERE user_id = v_user;

  -- Track cumulative net profit only. DO NOT auto-upgrade level or payout %.
  UPDATE trader_milestones
  SET cumulative_net_profit = v_real,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_milestone_config_on_mode_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- No-op: level promotions and payout % are managed manually by admin.
  RETURN NEW;
END;
$function$;