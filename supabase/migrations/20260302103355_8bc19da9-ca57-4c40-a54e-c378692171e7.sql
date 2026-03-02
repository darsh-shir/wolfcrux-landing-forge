
-- Trader configuration table for payout %, seat type, partner info
CREATE TABLE public.trader_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  payout_percentage NUMERIC NOT NULL DEFAULT 0,
  seat_type TEXT NOT NULL DEFAULT 'Alone',
  partner_id UUID,
  partner_percentage NUMERIC NOT NULL DEFAULT 0,
  software_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trader_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trader config" ON public.trader_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all trader config" ON public.trader_config FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own config" ON public.trader_config FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_trader_config_updated_at BEFORE UPDATE ON public.trader_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add trader2 and per-trader attendance to trading_data
ALTER TABLE public.trading_data 
  ADD COLUMN trader2_id UUID,
  ADD COLUMN trader1_attendance TEXT NOT NULL DEFAULT 'present',
  ADD COLUMN trader2_attendance TEXT NOT NULL DEFAULT 'present';

-- trader1_attendance / trader2_attendance values: 'present', 'late', 'half_day', 'holiday', 'absent'
