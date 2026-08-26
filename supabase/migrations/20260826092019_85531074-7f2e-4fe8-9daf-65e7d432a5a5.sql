CREATE TABLE public.trader_monthly_manual (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  milestone_amount numeric NOT NULL DEFAULT 0,
  amount_given numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trader_monthly_manual TO authenticated;
GRANT ALL ON public.trader_monthly_manual TO service_role;

ALTER TABLE public.trader_monthly_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all monthly manual entries"
ON public.trader_monthly_manual FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own monthly manual entries"
ON public.trader_monthly_manual FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_trader_monthly_manual_updated_at
BEFORE UPDATE ON public.trader_monthly_manual
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_trader_monthly_manual_user ON public.trader_monthly_manual (user_id, year, month);