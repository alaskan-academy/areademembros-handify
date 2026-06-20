-- Bucket privado para PDFs de certificados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: aluna acessa apenas seus próprios arquivos
CREATE POLICY "students_read_own_cert_files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Ativa RLS na tabela certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Aluna vê seus próprios certificados
CREATE POLICY "students_view_own_certificates"
ON certificates FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin vê todos
CREATE POLICY "admins_view_all_certificates"
ON certificates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Verificação pública por hash (sem auth — hash UUID v4 não enumerável)
CREATE POLICY "public_verify_certificate"
ON certificates FOR SELECT
TO anon
USING (true);

-- Apenas service_role insere/atualiza certificados
CREATE POLICY "service_insert_certificates"
ON certificates FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "service_update_certificates"
ON certificates FOR UPDATE
TO service_role
USING (true);
