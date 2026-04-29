-- 1) Fix recursion: only update trader_config when values actually change
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

  v_sto := CASE v_level
    WHEN 0 THEN 20 WHEN 1 THEN 25 WHEN 2 THEN 35 WHEN 3 THEN 45 WHEN 4 THEN 55
  END;
  v_lto := CASE v_level
    WHEN 0 THEN 0 WHEN 1 THEN 10 WHEN 2 THEN 15 WHEN 3 THEN 20 WHEN 4 THEN 25
  END;

  UPDATE trader_milestones
  SET cumulative_net_profit = v_total,
      current_level = v_level,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  -- Only update milestone-mode configs whose percentages are out of sync
  -- This prevents the recursive trigger loop
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

-- 2) Copy April 2026 trader_config rows into May 2026 (skip if already exists)
INSERT INTO trader_config (
  user_id, month, year, config_mode, sto_percentage, lto_percentage,
  payout_percentage, software_cost, seat_type, partner_id, partner_percentage
)
SELECT
  a.user_id, 5, 2026, a.config_mode, a.sto_percentage, a.lto_percentage,
  a.payout_percentage, a.software_cost, a.seat_type, a.partner_id, a.partner_percentage
FROM trader_config a
WHERE a.month = 4 AND a.year = 2026
  AND NOT EXISTS (
    SELECT 1 FROM trader_config m
    WHERE m.user_id = a.user_id AND m.month = 5 AND m.year = 2026
  );