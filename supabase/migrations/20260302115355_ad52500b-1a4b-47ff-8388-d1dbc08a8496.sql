
-- Add trader_number, joining_date, birthdate to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trader_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS joining_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthdate date;

-- Add paid_cash, paid_online flags to payout_records
ALTER TABLE public.payout_records ADD COLUMN IF NOT EXISTS paid_cash boolean NOT NULL DEFAULT false;
ALTER TABLE public.payout_records ADD COLUMN IF NOT EXISTS paid_online boolean NOT NULL DEFAULT false;

-- Make salary_backups.month have a default of 0 for yearly tracking
ALTER TABLE public.salary_backups ALTER COLUMN month SET DEFAULT 0;
