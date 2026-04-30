CREATE OR REPLACE FUNCTION public.get_company_birthdays()
RETURNS TABLE (full_name text, birthdate date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name, birthdate
  FROM public.profiles
  WHERE birthdate IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_birthdays() TO authenticated;