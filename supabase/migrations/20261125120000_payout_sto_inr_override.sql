-- Admin can change a person's STO in ₹ for a month in Payout Run; the
-- calculated amount stays visible as the original.
ALTER TABLE public.payout_records ADD COLUMN IF NOT EXISTS sto_inr_override NUMERIC(14,2);
