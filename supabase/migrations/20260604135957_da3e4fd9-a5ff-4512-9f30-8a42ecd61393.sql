
-- Document categories
CREATE TYPE public.document_category AS ENUM (
  'salary_slip','offer_letter','confirmation_letter','appraisal_letter','experience_letter','id_proof','contract','other'
);

CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.document_category NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  document_date date,
  is_hidden boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all employee documents"
  ON public.employee_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own visible documents"
  ON public.employee_documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_hidden = false);

CREATE TRIGGER trg_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_documents_user ON public.employee_documents(user_id, created_at DESC);

-- Storage policies on bucket 'employee-documents'
-- Files are stored under {user_id}/{filename}
CREATE POLICY "Admins manage all employee document files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their own employee document files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
