
ALTER TABLE public.trader_config 
ADD COLUMN config_mode text NOT NULL DEFAULT 'manual',
ADD COLUMN sto_percentage numeric NOT NULL DEFAULT 0,
ADD COLUMN lto_percentage numeric NOT NULL DEFAULT 0;

-- Copy existing payout_percentage to sto_percentage for existing records
UPDATE public.trader_config SET sto_percentage = payout_percentage;
