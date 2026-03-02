
-- Payout Tracker: monthly payout records per trader
CREATE TABLE public.payout_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  salary NUMERIC NOT NULL DEFAULT 0,
  cash_component NUMERIC NOT NULL DEFAULT 0,
  bank_transfer NUMERIC NOT NULL DEFAULT 0,
  advance_cash NUMERIC NOT NULL DEFAULT 0,
  advance_bank NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payout records" ON public.payout_records FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all payout records" ON public.payout_records FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own payout records" ON public.payout_records FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_payout_records_updated_at BEFORE UPDATE ON public.payout_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Salary Backup: base salary and monthly backup per trader
CREATE TABLE public.salary_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  backup_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.salary_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary backups" ON public.salary_backups FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all salary backups" ON public.salary_backups FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own salary backups" ON public.salary_backups FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_salary_backups_updated_at BEFORE UPDATE ON public.salary_backups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Desk Costs: total desk cost and payments per trader
CREATE TABLE public.desk_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_desk_cost NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.desk_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage desk costs" ON public.desk_costs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all desk costs" ON public.desk_costs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own desk costs" ON public.desk_costs FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_desk_costs_updated_at BEFORE UPDATE ON public.desk_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
