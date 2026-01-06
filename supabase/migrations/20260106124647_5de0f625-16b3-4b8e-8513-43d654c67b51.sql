-- Drop old tables if they exist (we're replacing the leave request system)
DROP TABLE IF EXISTS public.leave_requests;
DROP TABLE IF EXISTS public.leave_balances;

-- Create attendance_records table for admin-controlled attendance marking
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  record_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'late')),
  is_deductible BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, record_date)
);

-- Create monthly_leave_summary table to track monthly leave allocations
CREATE TABLE public.monthly_leave_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  allowed_full_days NUMERIC(3,1) NOT NULL DEFAULT 1,
  allowed_half_days NUMERIC(3,1) NOT NULL DEFAULT 1,
  used_full_days NUMERIC(3,1) NOT NULL DEFAULT 0,
  used_half_days NUMERIC(3,1) NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  deductible_count NUMERIC(3,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- Create trader_account_assignments table for non-dedicated account mapping
CREATE TABLE public.trader_account_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_id, assignment_date)
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_leave_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trader_account_assignments ENABLE ROW LEVEL SECURITY;

-- Attendance policies
CREATE POLICY "Admins can manage attendance" ON public.attendance_records
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all attendance" ON public.attendance_records
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own attendance" ON public.attendance_records
  FOR SELECT USING (auth.uid() = user_id);

-- Monthly summary policies
CREATE POLICY "Admins can manage summaries" ON public.monthly_leave_summary
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all summaries" ON public.monthly_leave_summary
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own summary" ON public.monthly_leave_summary
  FOR SELECT USING (auth.uid() = user_id);

-- Trader account assignment policies
CREATE POLICY "Admins can manage assignments" ON public.trader_account_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all assignments" ON public.trader_account_assignments
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own assignments" ON public.trader_account_assignments
  FOR SELECT USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_leave_summary_updated_at
  BEFORE UPDATE ON public.monthly_leave_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();