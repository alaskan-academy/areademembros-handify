-- Adiciona "video" ao enum content_block_type
-- Necessário para suportar blocos de vídeo Panda no editor de aulas
ALTER TYPE public.content_block_type ADD VALUE IF NOT EXISTS 'video';
