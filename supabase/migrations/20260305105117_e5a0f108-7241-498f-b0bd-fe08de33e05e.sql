
CREATE TABLE public.leave_carry_forward (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  carry_forward_days numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE public.leave_carry_forward ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage carry forward" ON public.leave_carry_forward FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all carry forward" ON public.leave_carry_forward FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own carry forward" ON public.leave_carry_forward FOR SELECT TO authenticated USING (auth.uid() = user_id);
