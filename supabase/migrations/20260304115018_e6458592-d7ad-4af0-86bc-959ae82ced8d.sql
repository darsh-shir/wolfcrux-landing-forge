ALTER TABLE public.desk_costs ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer;

-- Drop old unique constraint if any, add new one with year
ALTER TABLE public.desk_costs DROP CONSTRAINT IF EXISTS desk_costs_user_id_key;
ALTER TABLE public.desk_costs ADD CONSTRAINT desk_costs_user_id_year_key UNIQUE (user_id, year);