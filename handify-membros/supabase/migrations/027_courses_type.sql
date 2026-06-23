-- Tipo do conteúdo: 'course' = Curso | 'material' = Material Didático
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'course'
  CHECK (course_type IN ('course', 'material'));
