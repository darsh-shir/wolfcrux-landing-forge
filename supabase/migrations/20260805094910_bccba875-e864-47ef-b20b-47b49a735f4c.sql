CREATE OR REPLACE FUNCTION public.clear_stock_correlations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can clear correlation data';
  END IF;
  TRUNCATE TABLE public.stock_correlations;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_stock_correlations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_stock_correlations() FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_stock_correlations() TO authenticated;