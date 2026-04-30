CREATE TABLE public.trader_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  baseline_days INTEGER NOT NULL DEFAULT 0,
  baseline_net_profit NUMERIC NOT NULL DEFAULT 0,
  baseline_level INTEGER NOT NULL DEFAULT 0,
  as_of_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trader_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trader baselines"
ON public.trader_baselines FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own baseline"
ON public.trader_baselines FOR SELECT
USING (auth.uid() = user_id);

CREATE TRIGGER update_trader_baselines_updated_at
BEFORE UPDATE ON public.trader_baselines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();