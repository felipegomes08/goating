-- Configurações da turma: nome editável, escudo (foto redonda) e capa (foto de fundo).

ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS escudo_url TEXT;
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS capa_url TEXT;

-- Dono e administradores editam a turma, mas só o nome e as fotos:
-- trocar o dono ou "desexcluir" a turma fica fora do alcance direto de todo mundo.
DROP POLICY IF EXISTS "crews_update_own" ON public.crews;
CREATE POLICY "crews_update_gestores" ON public.crews FOR UPDATE TO authenticated
  USING (public.gere_turma(id))
  WITH CHECK (public.gere_turma(id));
REVOKE UPDATE ON public.crews FROM authenticated;
GRANT UPDATE (nome, escudo_url, capa_url) ON public.crews TO authenticated;

-- FOTOS DA TURMA: leitura pública (o endereço da foto abre sem login, como num site comum),
-- envio só por quem gere a turma. O caminho começa pelo id da turma: "<turma>/escudo-123.jpg".
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('turmas', 'turmas', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- A pasta precisa ser o id de uma turma que a pessoa gere. A comparação é em texto:
-- um caminho fora do padrão só não bate com nenhuma turma, em vez de dar erro de conversão.
CREATE OR REPLACE FUNCTION public.gere_pasta_da_turma(p_pasta TEXT)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crews c WHERE c.id::text = p_pasta AND public.gere_turma(c.id)
  );
$$;
REVOKE ALL ON FUNCTION public.gere_pasta_da_turma(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gere_pasta_da_turma(TEXT) TO authenticated;

DROP POLICY IF EXISTS "storage_turmas_insert" ON storage.objects;
CREATE POLICY "storage_turmas_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'turmas' AND public.gere_pasta_da_turma((storage.foldername(name))[1]));
DROP POLICY IF EXISTS "storage_turmas_update" ON storage.objects;
CREATE POLICY "storage_turmas_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'turmas' AND public.gere_pasta_da_turma((storage.foldername(name))[1]))
  WITH CHECK (bucket_id = 'turmas' AND public.gere_pasta_da_turma((storage.foldername(name))[1]));
DROP POLICY IF EXISTS "storage_turmas_delete" ON storage.objects;
CREATE POLICY "storage_turmas_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'turmas' AND public.gere_pasta_da_turma((storage.foldername(name))[1]));
