-- Make trading_accounts.user_id nullable for non-dedicated accounts
ALTER TABLE public.trading_accounts ALTER COLUMN user_id DROP NOT NULL;