CREATE OR REPLACE FUNCTION public.recalc_trader_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_total numeric := 0;
  v_level int := 0;
  v_sto numeric := 20;
  v_lto numeric := 0;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT COALESCE(SUM(net_profit), 0) INTO v_total
  FROM sto_ledger WHERE user_id = v_user;

  v_level := CASE
    WHEN v_total >= 500000 THEN 4
    WHEN v_total >= 300000 THEN 3
    WHEN v_total >= 150000 THEN 2
    WHEN v_total >= 50000  THEN 1
    ELSE 0
  END;

  -- Map level -> milestone STO/LTO percentages (matches MILESTONES in payoutCalculations.ts)
  v_sto := CASE v_level
    WHEN 0 THEN 20
    WHEN 1 THEN 25
    WHEN 2 THEN 35
    WHEN 3 THEN 45
    WHEN 4 THEN 55
  END;
  v_lto := CASE v_level
    WHEN 0 THEN 0
    WHEN 1 THEN 10
    WHEN 2 THEN 15
    WHEN 3 THEN 20
    WHEN 4 THEN 25
  END;

  UPDATE trader_milestones
  SET cumulative_net_profit = v_total,
      current_level = v_level,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  -- Auto-sync milestone-mode trader_config rows (do not touch manual ones)
  UPDATE trader_config
  SET sto_percentage = v_sto,
      lto_percentage = v_lto,
      payout_percentage = v_sto,
      updated_at = now()
  WHERE user_id = v_user
    AND config_mode = 'milestone';

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Make sure the trigger exists on sto_ledger (it should already, but enforce idempotently)
DROP TRIGGER IF EXISTS trg_recalc_trader_milestone ON public.sto_ledger;
CREATE TRIGGER trg_recalc_trader_milestone
AFTER INSERT OR UPDATE OR DELETE ON public.sto_ledger
FOR EACH ROW EXECUTE FUNCTION public.recalc_trader_milestone();

-- Also fire when trader_config.config_mode flips to 'milestone' so the % syncs immediately.
CREATE OR REPLACE FUNCTION public.sync_milestone_config_on_mode_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_level int := 0;
  v_sto numeric := 20;
  v_lto numeric := 0;
BEGIN
  IF NEW.config_mode = 'milestone' THEN
    SELECT COALESCE(current_level, 0) INTO v_level
    FROM trader_milestones WHERE user_id = NEW.user_id;

    v_sto := CASE COALESCE(v_level,0)
      WHEN 0 THEN 20 WHEN 1 THEN 25 WHEN 2 THEN 35 WHEN 3 THEN 45 WHEN 4 THEN 55
    END;
    v_lto := CASE COALESCE(v_level,0)
      WHEN 0 THEN 0 WHEN 1 THEN 10 WHEN 2 THEN 15 WHEN 3 THEN 20 WHEN 4 THEN 25
    END;

    NEW.sto_percentage := v_sto;
    NEW.lto_percentage := v_lto;
    NEW.payout_percentage := v_sto;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_milestone_config ON public.trader_config;
CREATE TRIGGER trg_sync_milestone_config
BEFORE INSERT OR UPDATE OF config_mode ON public.trader_config
FOR EACH ROW EXECUTE FUNCTION public.sync_milestone_config_on_mode_change();