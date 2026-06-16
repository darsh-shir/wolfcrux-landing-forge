
-- 1) Mask year of birth in get_company_birthdays to reduce PII exposure
CREATE OR REPLACE FUNCTION public.get_company_birthdays()
RETURNS TABLE(full_name text, birthdate date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.full_name,
    -- Mask the year so only month/day are exposed
    make_date(2000, EXTRACT(MONTH FROM p.birthdate)::int, EXTRACT(DAY FROM p.birthdate)::int) AS birthdate
  FROM public.profiles p
  WHERE p.birthdate IS NOT NULL;
$$;

-- 2) Add a RESTRICTIVE policy on user_roles so only admins can insert roles
DROP POLICY IF EXISTS "Only admins may insert roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins may insert roles (restrictive)"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Also restrict updates/deletes to admins only (defense in depth)
DROP POLICY IF EXISTS "Only admins may update roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins may update roles (restrictive)"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins may delete roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins may delete roles (restrictive)"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
