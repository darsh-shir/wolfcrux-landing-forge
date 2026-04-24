
-- Update sync_payout_on_config_change to skip writing sto_ledger when no trading activity
CREATE OR REPLACE FUNCTION public.sync_payout_on_config_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gross numeric := 0;
  v_shares int := 0;
  v_share_cost numeric := 0;
  v_net numeric := 0;
  v_sto numeric := 0;
  v_lto numeric := 0;
  v_pool numeric := 0;
  v_has_trainee boolean := false;
  v_has_activity boolean := false;
BEGIN
  -- Aggregate trading data for the affected trader/month/year (as primary)
  SELECT COALESCE(SUM(net_pnl), 0)::numeric, COALESCE(SUM(shares_traded), 0)::int
  INTO v_gross, v_shares
  FROM trading_data
  WHERE user_id = NEW.user_id
    AND EXTRACT(MONTH FROM trade_date)::int = NEW.month
    AND EXTRACT(YEAR FROM trade_date)::int = NEW.year;

  -- Detect any activity (primary or partner) for this month
  SELECT EXISTS (
    SELECT 1 FROM trading_data
    WHERE (user_id = NEW.user_id OR trader2_id = NEW.user_id)
      AND EXTRACT(MONTH FROM trade_date)::int = NEW.month
      AND EXTRACT(YEAR FROM trade_date)::int = NEW.year
  ) INTO v_has_activity;

  -- If no activity at all, remove any phantom STO/LTO rows and exit
  IF NOT v_has_activity THEN
    DELETE FROM sto_ledger
    WHERE user_id = NEW.user_id AND month = NEW.month AND year = NEW.year
      AND gross_profit = 0 AND shares_traded = 0 AND is_paid = false;
    DELETE FROM lto_ledger
    WHERE user_id = NEW.user_id AND month = NEW.month AND year = NEW.year
      AND is_released = false;
    RETURN NEW;
  END IF;

  v_share_cost := (v_shares::numeric / 1000.0) * 14;
  v_net := v_gross - v_share_cost - COALESCE(NEW.software_cost, 0);

  IF v_net > 0 THEN
    v_sto := v_net * (COALESCE(NEW.sto_percentage, 0) / 100.0);
    v_lto := v_net * (COALESCE(NEW.lto_percentage, 0) / 100.0);
  END IF;

  IF NEW.partner_id IS NOT NULL THEN
    SELECT (employee_role = 'trainee') INTO v_has_trainee
    FROM profiles WHERE user_id = NEW.partner_id;
    v_has_trainee := COALESCE(v_has_trainee, false);
  END IF;

  v_pool := CASE WHEN v_has_trainee THEN v_sto * 0.25 ELSE 0 END;

  INSERT INTO sto_ledger (
    user_id, month, year, gross_profit, shares_traded, share_cost, software_cost,
    net_profit, sto_percentage, sto_amount,
    leave_deduction_percent, leave_deduction_amount,
    trainee_pool_contribution, final_sto_amount, payout_due_date
  ) VALUES (
    NEW.user_id, NEW.month, NEW.year, v_gross, v_shares, v_share_cost, COALESCE(NEW.software_cost, 0),
    v_net, COALESCE(NEW.sto_percentage, 0), v_sto,
    0, 0,
    v_pool, v_sto - v_pool,
    make_date(
      CASE WHEN NEW.month + 3 > 12 THEN NEW.year + 1 ELSE NEW.year END,
      CASE WHEN NEW.month + 3 > 12 THEN NEW.month + 3 - 12 ELSE NEW.month + 3 END,
      1
    )
  )
  ON CONFLICT DO NOTHING;

  UPDATE sto_ledger
  SET gross_profit = v_gross,
      shares_traded = v_shares,
      share_cost = v_share_cost,
      software_cost = COALESCE(NEW.software_cost, 0),
      net_profit = v_net,
      sto_percentage = COALESCE(NEW.sto_percentage, 0),
      sto_amount = v_sto,
      trainee_pool_contribution = v_pool,
      final_sto_amount = v_sto - v_pool - leave_deduction_amount,
      updated_at = now()
  WHERE user_id = NEW.user_id AND month = NEW.month AND year = NEW.year;

  IF COALESCE(NEW.lto_percentage, 0) > 0 AND v_lto > 0 THEN
    INSERT INTO lto_ledger (user_id, month, year, net_profit, lto_percentage, lto_amount, unlock_date)
    VALUES (NEW.user_id, NEW.month, NEW.year, v_net, NEW.lto_percentage, v_lto,
            make_date(NEW.year + 1, NEW.month, 1))
    ON CONFLICT DO NOTHING;

    UPDATE lto_ledger
    SET net_profit = v_net,
        lto_percentage = NEW.lto_percentage,
        lto_amount = v_lto,
        updated_at = now()
    WHERE user_id = NEW.user_id AND month = NEW.month AND year = NEW.year
      AND is_released = false;
  ELSE
    DELETE FROM lto_ledger
    WHERE user_id = NEW.user_id AND month = NEW.month AND year = NEW.year
      AND is_released = false;
  END IF;

  INSERT INTO trainee_pool_ledger (month, year, total_pool_amount, num_trainees)
  VALUES (NEW.month, NEW.year, 0, 0)
  ON CONFLICT DO NOTHING;

  UPDATE trainee_pool_ledger tp
  SET total_pool_amount = COALESCE((
    SELECT SUM(trainee_pool_contribution) FROM sto_ledger
    WHERE month = NEW.month AND year = NEW.year
  ), 0),
  num_trainees = COALESCE((
    SELECT COUNT(*) FROM profiles WHERE employee_role = 'trainee'
  ), 0),
  per_trainee_amount = CASE 
    WHEN (SELECT COUNT(*) FROM profiles WHERE employee_role = 'trainee') > 0
    THEN COALESCE((SELECT SUM(trainee_pool_contribution) FROM sto_ledger WHERE month = NEW.month AND year = NEW.year), 0) 
         / (SELECT COUNT(*) FROM profiles WHERE employee_role = 'trainee')
    ELSE 0
  END,
  updated_at = now()
  WHERE tp.month = NEW.month AND tp.year = NEW.year;

  RETURN NEW;
END;
$function$;

-- Auto-recalculate trader_milestones whenever sto_ledger changes
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

  UPDATE trader_milestones
  SET cumulative_net_profit = v_total,
      current_level = v_level,
      last_evaluated_at = now(),
      updated_at = now()
  WHERE user_id = v_user;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_trader_milestone ON sto_ledger;
CREATE TRIGGER trg_recalc_trader_milestone
AFTER INSERT OR UPDATE OR DELETE ON sto_ledger
FOR EACH ROW EXECUTE FUNCTION public.recalc_trader_milestone();
