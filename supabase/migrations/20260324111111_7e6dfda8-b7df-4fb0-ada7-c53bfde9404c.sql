
-- 1. Trader Milestones
CREATE TABLE public.trader_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_start_date date NOT NULL,
  current_level integer NOT NULL DEFAULT 0,
  cumulative_net_profit numeric NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.trader_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage milestones" ON public.trader_milestones FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own milestones" ON public.trader_milestones FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_trader_milestones_updated_at BEFORE UPDATE ON public.trader_milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. STO Ledger
CREATE TABLE public.sto_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  gross_profit numeric NOT NULL DEFAULT 0,
  shares_traded integer NOT NULL DEFAULT 0,
  share_cost numeric NOT NULL DEFAULT 0,
  software_cost numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  sto_percentage numeric NOT NULL DEFAULT 20,
  sto_amount numeric NOT NULL DEFAULT 0,
  leave_deduction_percent numeric NOT NULL DEFAULT 0,
  leave_deduction_amount numeric NOT NULL DEFAULT 0,
  trainee_pool_contribution numeric NOT NULL DEFAULT 0,
  final_sto_amount numeric NOT NULL DEFAULT 0,
  payout_due_date date,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.sto_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sto_ledger" ON public.sto_ledger FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own sto" ON public.sto_ledger FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_sto_ledger_updated_at BEFORE UPDATE ON public.sto_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. LTO Ledger
CREATE TABLE public.lto_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  net_profit numeric NOT NULL DEFAULT 0,
  lto_percentage numeric NOT NULL DEFAULT 0,
  lto_amount numeric NOT NULL DEFAULT 0,
  unlock_date date NOT NULL,
  is_released boolean NOT NULL DEFAULT false,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.lto_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lto_ledger" ON public.lto_ledger FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own lto" ON public.lto_ledger FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_lto_ledger_updated_at BEFORE UPDATE ON public.lto_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Monthly Exchange Rates
CREATE TABLE public.monthly_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  usd_to_inr numeric NOT NULL DEFAULT 83.0,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

ALTER TABLE public.monthly_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exchange rates" ON public.monthly_exchange_rates FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view rates" ON public.monthly_exchange_rates FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON public.monthly_exchange_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Trainee Pool Ledger
CREATE TABLE public.trainee_pool_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  total_pool_amount numeric NOT NULL DEFAULT 0,
  num_trainees integer NOT NULL DEFAULT 0,
  per_trainee_amount numeric NOT NULL DEFAULT 0,
  is_distributed boolean NOT NULL DEFAULT false,
  distributed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

ALTER TABLE public.trainee_pool_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trainee pool" ON public.trainee_pool_ledger FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view pool" ON public.trainee_pool_ledger FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_trainee_pool_updated_at BEFORE UPDATE ON public.trainee_pool_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Add employee_role and assigned_trader to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_role text NOT NULL DEFAULT 'trainee';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_trader_id uuid;
