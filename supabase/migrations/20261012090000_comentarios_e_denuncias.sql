-- Comentário na avaliação de jogador: texto livre, assinado, que aparece no perfil de quem
-- foi avaliado. As notas continuam privadas; só o comentário (com o nome de quem escreveu)
-- fica visível. Todo comentário pode ser denunciado, e com 3 denúncias de pessoas
-- diferentes ele some sozinho até ser revisto.

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS comentario TEXT
  CHECK (comentario IS NULL OR char_length(comentario) BETWEEN 1 AND 200);
GRANT UPDATE (comentario) ON public.evaluations TO authenticated;

-- comentário só de espaços vira "sem comentário"
CREATE OR REPLACE FUNCTION public.normalizar_comentario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.comentario := nullif(btrim(regexp_replace(NEW.comentario, '\s+', ' ', 'g')), '');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalizar_comentario() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS evaluations_normalizar_comentario ON public.evaluations;
CREATE TRIGGER evaluations_normalizar_comentario
BEFORE INSERT OR UPDATE OF comentario ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.normalizar_comentario();

-- DENÚNCIAS. Ninguém lê nem escreve direto na tabela: só pela função denunciar_comentario.
-- "tipo" já prevê o comentário de turma, que entra na próxima etapa.
CREATE TABLE IF NOT EXISTS public.denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('comentario_jogador', 'comentario_turma')),
  alvo_id UUID NOT NULL,
  denunciante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  motivo TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 200),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, alvo_id, denunciante_id)
);
CREATE INDEX IF NOT EXISTS denuncias_alvo_idx ON public.denuncias (tipo, alvo_id);
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.denuncias FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.denuncias TO service_role;

-- Quantas denúncias escondem um comentário.
CREATE OR REPLACE FUNCTION public.comentario_oculto(p_tipo TEXT, p_alvo_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT count(*) FROM public.denuncias d WHERE d.tipo = p_tipo AND d.alvo_id = p_alvo_id) >= 3;
$$;
REVOKE ALL ON FUNCTION public.comentario_oculto(TEXT, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.denunciar_comentario(p_tipo TEXT, p_alvo_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_autor UUID;
BEGIN
  IF v_uid IS NULL OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.eh_convidado) THEN
    RAISE EXCEPTION 'Entre com a sua conta para denunciar.';
  END IF;
  IF p_tipo = 'comentario_jogador' THEN
    SELECT e.avaliador_id INTO v_autor FROM public.evaluations e
    WHERE e.id = p_alvo_id AND e.comentario IS NOT NULL;
  ELSE
    RAISE EXCEPTION 'Tipo de denúncia desconhecido.';
  END IF;
  IF v_autor IS NULL THEN
    RAISE EXCEPTION 'Esse comentário não existe mais.';
  END IF;
  IF v_autor = v_uid THEN
    RAISE EXCEPTION 'Esse comentário é seu. Se quiser, é só apagar.';
  END IF;
  -- trava contra denúncia em massa pra derrubar comentário dos outros
  IF (SELECT count(*) FROM public.denuncias d
      WHERE d.denunciante_id = v_uid AND d.criado_em > now() - interval '24 hours') >= 15 THEN
    RAISE EXCEPTION 'Você já denunciou bastante por hoje. Tenta de novo amanhã.';
  END IF;
  INSERT INTO public.denuncias (tipo, alvo_id, denunciante_id, motivo)
  VALUES (p_tipo, p_alvo_id, v_uid, nullif(btrim(left(p_motivo, 200)), ''))
  ON CONFLICT (tipo, alvo_id, denunciante_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.denunciar_comentario(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.denunciar_comentario(TEXT, UUID, TEXT) TO authenticated;

-- Comentários que um jogador recebeu: texto, quem escreveu e de qual pelada. Nunca as notas.
-- Comentário escondido por denúncias só aparece pra quem escreveu (pra ele poder apagar).
CREATE OR REPLACE FUNCTION public.comentarios_do_jogador(p_user_id UUID)
RETURNS TABLE (
  id UUID, autor_id UUID, autor_nome TEXT, autor_foto TEXT, comentario TEXT,
  criado_em TIMESTAMPTZ, pelada TEXT, meu BOOLEAN, denunciei BOOLEAN, oculto BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id, a.id, a.nome_exibicao, a.foto_url, e.comentario, e.criado_em, m.titulo,
    e.avaliador_id = auth.uid(),
    EXISTS (SELECT 1 FROM public.denuncias d
            WHERE d.tipo = 'comentario_jogador' AND d.alvo_id = e.id AND d.denunciante_id = auth.uid()),
    public.comentario_oculto('comentario_jogador', e.id)
  FROM public.evaluations e
  JOIN public.profiles a ON a.id = e.avaliador_id
  JOIN public.matches m ON m.id = e.match_id
  WHERE e.avaliado_id = p_user_id
    AND e.comentario IS NOT NULL
    AND (e.avaliador_id = auth.uid() OR NOT public.comentario_oculto('comentario_jogador', e.id))
  ORDER BY e.criado_em DESC
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.comentarios_do_jogador(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comentarios_do_jogador(UUID) TO authenticated;

-- Quem escreveu apaga o próprio comentário a qualquer momento (a nota fica).
-- A regra normal de edição da avaliação só vale por 24h, por isso é uma função.
CREATE OR REPLACE FUNCTION public.apagar_meu_comentario(p_evaluation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.evaluations SET comentario = NULL
  WHERE id = p_evaluation_id AND avaliador_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esse comentário não é seu.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apagar_meu_comentario(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apagar_meu_comentario(UUID) TO authenticated;
