-- Allow partners (trader2) to read their joint sessions
CREATE POLICY "Partners can view sessions where they are trader2"
ON public.trading_data
FOR SELECT
USING (auth.uid() = trader2_id);