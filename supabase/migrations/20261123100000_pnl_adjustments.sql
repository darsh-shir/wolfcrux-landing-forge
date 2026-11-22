-- =============================================================================
-- P&L adjustments between traders (month-end transfers of net profit)
--
-- One row = "move <amount> of net profit from <from_user> to <to_user> for
-- <month>/<year>". It lowers the giver's net profit and raises the receiver's,
-- so STO, LTO, carried losses and levels are correct for both.
--
-- Additive only. Safe to run more than once.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pnl_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pnl_transfers_different_people CHECK (from_user_id <> to_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pnl_transfers TO authenticated;
GRANT ALL ON public.pnl_transfers TO service_role;
ALTER TABLE public.pnl_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage P&L transfers" ON public.pnl_transfers;
CREATE POLICY "Admins manage P&L transfers"
ON public.pnl_transfers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Traders can see transfers that involve them, so their own payout view matches.
DROP POLICY IF EXISTS "Traders view their own P&L transfers" ON public.pnl_transfers;
CREATE POLICY "Traders view their own P&L transfers"
ON public.pnl_transfers FOR SELECT TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE INDEX IF NOT EXISTS idx_pnl_transfers_period ON public.pnl_transfers (year, month);
CREATE INDEX IF NOT EXISTS idx_pnl_transfers_from ON public.pnl_transfers (from_user_id);
CREATE INDEX IF NOT EXISTS idx_pnl_transfers_to ON public.pnl_transfers (to_user_id);
