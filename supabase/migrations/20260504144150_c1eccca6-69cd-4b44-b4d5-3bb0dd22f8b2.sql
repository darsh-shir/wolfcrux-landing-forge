
-- 1. Fix privilege escalation on user_roles ----------------------------------
-- The existing "Admins can manage roles" policy is FOR ALL with only USING,
-- which does NOT enforce WITH CHECK on INSERT. Add explicit per-command
-- policies so only admins can insert/update/delete role rows.

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Lock down trainee pool ledger to admins only ---------------------------
DROP POLICY IF EXISTS "Authenticated can view pool" ON public.trainee_pool_ledger;

CREATE POLICY "Admins can view trainee pool"
ON public.trainee_pool_ledger
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Require sign-in for company birthdays ----------------------------------
REVOKE EXECUTE ON FUNCTION public.get_company_birthdays() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_company_birthdays() TO authenticated;

-- 4. Revoke public EXECUTE on internal trigger / helper functions ------------
-- These run via triggers (which use SECURITY DEFINER and bypass these grants),
-- so revoking EXECUTE from anon/authenticated does NOT break functionality.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_payout_on_config_change()            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_ledgers_on_trade_change()            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_milestone_config_on_mode_change()    FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_trader_milestone()                 FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_milestone_from_baseline()          FROM anon, authenticated, public;

-- has_role is intentionally callable by authenticated users (used inside
-- RLS policies running as the caller). Keep its grants as-is.
