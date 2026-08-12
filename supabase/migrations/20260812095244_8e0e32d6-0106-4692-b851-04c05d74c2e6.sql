CREATE UNIQUE INDEX IF NOT EXISTS trading_data_user_account_date_uniq
  ON public.trading_data (user_id, account_id, trade_date);