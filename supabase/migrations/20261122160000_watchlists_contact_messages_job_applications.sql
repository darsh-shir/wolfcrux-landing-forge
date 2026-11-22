-- =============================================================================
-- Watchlists, contact-form messages and job applications (with resume uploads)
--
-- Additive only: creates new tables, one new private storage bucket and their
-- access rules. No existing table, row or policy is changed.
-- Safe to run more than once.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Terminal watchlist: one row per signed-in user, private to that user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_watchlists (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  symbols text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_watchlists_max_symbols CHECK (cardinality(symbols) <= 200)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_watchlists TO authenticated;
GRANT ALL ON public.user_watchlists TO service_role;
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own watchlist" ON public.user_watchlists;
CREATE POLICY "Users manage their own watchlist"
ON public.user_watchlists FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_watchlists_updated_at ON public.user_watchlists;
CREATE TRIGGER update_user_watchlists_updated_at
BEFORE UPDATE ON public.user_watchlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -----------------------------------------------------------------------------
-- 2. Contact-form messages: anyone can send, only admins can read
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can send a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can send a contact message"
ON public.contact_messages FOR INSERT TO anon, authenticated
WITH CHECK (is_read = false);

DROP POLICY IF EXISTS "Admins manage contact messages" ON public.contact_messages;
CREATE POLICY "Admins manage contact messages"
ON public.contact_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON public.contact_messages (created_at DESC);


-- -----------------------------------------------------------------------------
-- 3. Job applications: anyone can apply, only admins can read
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL CHECK (char_length(position) BETWEEN 1 AND 200),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 200),
  email text NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  linkedin_url text CHECK (linkedin_url IS NULL OR char_length(linkedin_url) <= 500),
  message text CHECK (message IS NULL OR char_length(message) <= 5000),
  resume_path text CHECK (resume_path IS NULL OR resume_path ~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$'),
  resume_file_name text CHECK (resume_file_name IS NULL OR char_length(resume_file_name) <= 255),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.job_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a job application" ON public.job_applications;
CREATE POLICY "Anyone can submit a job application"
ON public.job_applications FOR INSERT TO anon, authenticated
WITH CHECK (status = 'new' AND admin_notes IS NULL);

DROP POLICY IF EXISTS "Admins manage job applications" ON public.job_applications;
CREATE POLICY "Admins manage job applications"
ON public.job_applications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER update_job_applications_updated_at
BEFORE UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_job_applications_created ON public.job_applications (created_at DESC);


-- -----------------------------------------------------------------------------
-- 4. Basic flood protection for the two public forms:
--    at most 5 submissions per email address per hour, per form.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limit_public_form_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent integer;
BEGIN
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE lower(email) = lower($1) AND created_at > now() - interval ''1 hour''',
    TG_TABLE_NAME
  ) INTO recent USING NEW.email;
  IF recent >= 5 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_contact_messages ON public.contact_messages;
CREATE TRIGGER limit_contact_messages
BEFORE INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.limit_public_form_submissions();

DROP TRIGGER IF EXISTS limit_job_applications ON public.job_applications;
CREATE TRIGGER limit_job_applications
BEFORE INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.limit_public_form_submissions();


-- -----------------------------------------------------------------------------
-- 5. Private "resumes" bucket: PDF / Word only, 5 MB max.
--    Applicants can upload (never read, list, replace or delete);
--    only admins can read and delete.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can upload a resume" ON storage.objects;
CREATE POLICY "Anyone can upload a resume"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND name ~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$'
);

DROP POLICY IF EXISTS "Admins read resumes" ON storage.objects;
CREATE POLICY "Admins read resumes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete resumes" ON storage.objects;
CREATE POLICY "Admins delete resumes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resumes' AND public.has_role(auth.uid(), 'admin'));
