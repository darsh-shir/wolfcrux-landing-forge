-- When the admin changes a month's LTO amount, the calculated amount is kept
-- here (and kept up to date by later saves) while lto_amount holds the admin's figure.
ALTER TABLE public.lto_ledger ADD COLUMN IF NOT EXISTS lto_amount_original NUMERIC(14,2);
