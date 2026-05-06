REVOKE ALL ON FUNCTION public.sync_milestone_config_on_mode_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_payout_on_config_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_ledgers_on_trade_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_milestone_from_baseline() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_trader_milestone() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_company_birthdays() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_birthdays() TO authenticated;