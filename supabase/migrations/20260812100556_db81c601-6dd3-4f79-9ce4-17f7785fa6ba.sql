REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_stock_correlations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_company_birthdays() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_stock_correlations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_birthdays() TO authenticated;