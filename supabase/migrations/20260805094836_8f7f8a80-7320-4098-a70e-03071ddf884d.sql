CREATE OR REPLACE FUNCTION public.top_correlations(_ticker TEXT, _limit INT DEFAULT 10)
RETURNS TABLE (peer TEXT, correlation NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN sc.stock1 = upper(trim(_ticker)) THEN sc.stock2 ELSE sc.stock1 END AS peer,
         sc.correlation
  FROM public.stock_correlations sc
  WHERE sc.stock1 = upper(trim(_ticker)) OR sc.stock2 = upper(trim(_ticker))
  ORDER BY abs(sc.correlation) DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1)
$$;

CREATE OR REPLACE FUNCTION public.all_correlations(_ticker TEXT)
RETURNS TABLE (peer TEXT, correlation NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN sc.stock1 = upper(trim(_ticker)) THEN sc.stock2 ELSE sc.stock1 END AS peer,
         sc.correlation
  FROM public.stock_correlations sc
  WHERE sc.stock1 = upper(trim(_ticker)) OR sc.stock2 = upper(trim(_ticker))
  ORDER BY abs(sc.correlation) DESC
$$;

REVOKE ALL ON FUNCTION public.top_correlations(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.all_correlations(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_correlations(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.all_correlations(TEXT) TO anon, authenticated, service_role;