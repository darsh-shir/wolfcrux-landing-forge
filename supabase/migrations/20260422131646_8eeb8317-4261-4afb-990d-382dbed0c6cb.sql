
-- 1) Clean up LTO entries for traders who have no LTO % configured (or 0%)
DELETE FROM lto_ledger l
WHERE NOT EXISTS (
  SELECT 1 FROM trader_config tc
  WHERE tc.user_id = l.user_id
    AND tc.month = l.month
    AND tc.year = l.year
    AND tc.lto_percentage > 0
);

-- 2) Trigger function: when trader_config changes, recalculate STO + LTO + Pool for that trader/month
CREATE OR REPLACE FUNCTION public.sync_payout_on_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross numeric := 0;
  v_shares int := 0;
  v_share_cost numeric := 0;
  v_net numeric := 0;
  v_sto numeric := 0;
  v_lto numeric := 0;
  v_pool numeric := 0;
  v_has_trainee boolean := false;
BEGIN
  -- Aggregate trading data for the affected trader/month/year
  SELECT COALESCE(SUM(net_pnl), 0)::numeric, COALESCE(SUM(shares_traded), 0)::int
  INTO v_gross, v_shares
  FROM trading_data
  WHERE user_id = NEW.user_id
    AND EXTRACT(MONTH FROM trade_date)::int = NEW.month
    AND EXTRACT(YEAR FROM trade_date)::int = NEW.year;

  v_share_cost := (v_shares::numeric / 1000.0) * 14;
  v_net := v_gross - v_share_cost - COALESCE(NEW.software_cost, 0);

  IF v_net > 0 THEN
    v_sto := v_net * (COALESCE(NEW.sto_percentage, 0) / 100.0);
    v_lto := v_net * (COALESCE(NEW.lto_percentage, 0) / 100.0);
  END IF;

  -- Detect trainee partner
  IF NEW.partner_id IS NOT NULL THEN
    SELECT (employee_role = 'trainee') INTO v_has_trainee
    FROM profiles WHERE user_id = NEW.partner_id;
    v_has_trainee := COALESCE(v_has_trainee, false);
  END IF;

  v_pool := CASE WHEN v_has_trainee THEN v_sto * 0.25 ELSE 0 END;

  -- Upsert STO ledger
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

  -- LTO: insert/update if > 0, delete if 0
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

  -- Refresh trainee pool ledger total for that month
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
$$;

-- Attach trigger to trader_config
DROP TRIGGER IF EXISTS trader_config_sync_payout ON trader_config;
CREATE TRIGGER trader_config_sync_payout
AFTER INSERT OR UPDATE ON trader_config
FOR EACH ROW
EXECUTE FUNCTION public.sync_payout_on_config_change();

-- 3) One-time refresh of trainee_pool_ledger from current STO data
INSERT INTO trainee_pool_ledger (month, year, total_pool_amount, num_trainees, per_trainee_amount)
SELECT 
  s.month, s.year,
  SUM(s.trainee_pool_contribution),
  (SELECT COUNT(*) FROM profiles WHERE employee_role = 'trainee'),
  CASE WHEN (SELECT COUNT(*) FROM profiles WHERE employee_role = 'trainee') > 0
       THEN SUM(s.trainee_pool_contribution) / (SELECT COUNT(*) FROM profiles WHERE employee_role = 'trainee')
       ELSE 0 END
FROM sto_ledger s
GROUP BY s.month, s.year
ON CONFLICT DO NOTHING;
