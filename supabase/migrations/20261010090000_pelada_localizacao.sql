-- Localização da pelada: link do Maps/Waze colado pelo organizador, ou o link gerado
-- quando ele marca o ponto no mapa. Só aceita endereço de internet (http/https).

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS local_link TEXT;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_local_link_formato;
ALTER TABLE public.matches ADD CONSTRAINT matches_local_link_formato
  CHECK (local_link IS NULL OR (local_link ~* '^https?://' AND char_length(local_link) <= 600));
