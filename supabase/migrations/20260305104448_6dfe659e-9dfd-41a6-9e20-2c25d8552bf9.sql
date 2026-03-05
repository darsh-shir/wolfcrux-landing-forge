
ALTER TABLE public.trader_config ADD COLUMN IF NOT EXISTS month integer NOT NULL DEFAULT (EXTRACT(month FROM now()))::integer;
ALTER TABLE public.trader_config ADD COLUMN IF NOT EXISTS year integer NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer;

-- Drop old unique constraint if exists and add new one
ALTER TABLE public.trader_config DROP CONSTRAINT IF EXISTS trader_config_user_id_key;
ALTER TABLE public.trader_config ADD CONSTRAINT trader_config_user_month_year_unique UNIQUE (user_id, month, year);
