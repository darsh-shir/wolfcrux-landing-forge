-- 1) Trigger function: when trading_data changes, refresh STO/LTO ledgers
-- by nudging the matching trader_config row (which fires sync_payout_on_config_change).
CREATE OR REPLACE FUNCTION public.sync_ledgers_on_trade_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_month int;
  v_year int;
  v_trader2 uuid;
BEGIN
  -- Determine affected trade row
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

  -- Touch the primary trader's config for that month so the existing
  -- sync_payout_on_config_change trigger recomputes STO + LTO ledgers.
  UPDATE trader_config
  SET updated_at = now()
  WHERE user_id = v_user AND month = v_month AND year = v_year;

  IF v_trader2 IS NOT NULL THEN
    UPDATE trader_config
    SET updated_at = now()
    WHERE user_id = v_trader2 AND month = v_month AND year = v_year;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_ledgers_after_trade ON public.trading_data;
CREATE TRIGGER sync_ledgers_after_trade
AFTER INSERT OR UPDATE OR DELETE ON public.trading_data
FOR EACH ROW
EXECUTE FUNCTION public.sync_ledgers_on_trade_change();

-- 2) Backfill: nudge every existing trader_config row so the existing
-- sync_payout_on_config_change trigger rebuilds STO + LTO ledgers from
-- current trading_data. This populates May 2026 (and any other gaps).
UPDATE public.trader_config SET updated_at = now();
