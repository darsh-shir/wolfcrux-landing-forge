
CREATE OR REPLACE FUNCTION public.sync_ledgers_on_trade_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_trader2 uuid;
  v_month int;
  v_year int;
  v_uid uuid;
  v_exists boolean;
  v_sto numeric;
  v_lto numeric;
  v_payout numeric;
  v_seat text;
  v_partner uuid;
  v_partner_pct numeric;
  v_software numeric;
  v_mode text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_trader2 := OLD.trader2_id;
    v_month := EXTRACT(MONTH FROM OLD.trade_date)::int;
    v_year := EXTRACT(YEAR FROM OLD.trade_date)::int;
  ELSE
    v_user := NEW.user_id;
    v_trader2 := NEW.trader2_id;
    v_month := EXTRACT(MONTH FROM NEW.trade_date)::int;
    v_year := EXTRACT(YEAR FROM NEW.trade_date)::int;
  END IF;

  -- For both primary trader and (if present) trader2, ensure a trader_config row
  -- exists for that month/year. If missing, carry forward the most recent config.
  -- Then touch updated_at so sync_payout_on_config_change fires and recomputes
  -- STO + LTO ledgers within the same transaction.
  FOR v_uid IN
    SELECT u FROM (VALUES (v_user), (v_trader2)) AS t(u) WHERE u IS NOT NULL
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM trader_config
      WHERE user_id = v_uid AND month = v_month AND year = v_year
    ) INTO v_exists;

    IF NOT v_exists THEN
      -- Pull the most recent prior config for this trader (any month).
      SELECT sto_percentage, lto_percentage, payout_percentage,
             seat_type, partner_id, partner_percentage, software_cost, config_mode
        INTO v_sto, v_lto, v_payout, v_seat, v_partner, v_partner_pct, v_software, v_mode
      FROM trader_config
      WHERE user_id = v_uid
      ORDER BY year DESC, month DESC, updated_at DESC
      LIMIT 1;

      INSERT INTO trader_config (
        user_id, month, year,
        sto_percentage, lto_percentage, payout_percentage,
        seat_type, partner_id, partner_percentage, software_cost, config_mode
      ) VALUES (
        v_uid, v_month, v_year,
        COALESCE(v_sto, 20), COALESCE(v_lto, 0), COALESCE(v_payout, 20),
        COALESCE(v_seat, 'Alone'), v_partner, COALESCE(v_partner_pct, 0),
        COALESCE(v_software, 0), COALESCE(v_mode, 'manual')
      );
      -- INSERT fires sync_payout_on_config_change automatically.
    ELSE
      -- Touch existing config to force recompute.
      UPDATE trader_config
      SET updated_at = now()
      WHERE user_id = v_uid AND month = v_month AND year = v_year;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
