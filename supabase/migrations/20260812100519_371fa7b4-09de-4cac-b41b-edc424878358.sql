ALTER TABLE public.trading_data
ADD CONSTRAINT trading_data_user_account_date_unique
UNIQUE (user_id, account_id, trade_date);