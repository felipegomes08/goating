-- TURMAS: avaliação, ranking por cidade, pedido de entrada e link de convite com código.

-- ============================================================================
-- 1. A turma ganha cidade, nota e a opção de aceitar pedidos de entrada.
-- ============================================================================
ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS cidade TEXT CHECK (cidade IS NULL OR char_length(cidade) <= 80),
  ADD COLUMN IF NOT EXISTS aceita_pedidos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nota NUMERIC,
  ADD COLUMN IF NOT EXISTS avaliacoes INTEGER NOT NULL DEFAULT 0;
-- nota e quantidade de avaliações só mudam pelo gatilho das avaliações
GRANT UPDATE (cidade, aceita_pedidos) ON public.crews TO authenticated;

-- turmas que já existem: a cidade onde mais jogaram; sem pelada, a cidade do dono
UPDATE public.crews c
SET cidade = COALESCE(
  (SELECT m.cidade FROM public.matches m
   WHERE m.crew_id = c.id AND char_length(m.cidade) > 2
   GROUP BY m.cidade ORDER BY count(*) DESC LIMIT 1),
  (SELECT p.cidade FROM public.profiles p WHERE p.id = c.dono_id)
)
WHERE c.cidade IS NULL;

-- turma nova nasce na cidade do dono (dá pra trocar nas configurações)
CREATE OR REPLACE FUNCTION public.crews_cidade_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cidade IS NULL THEN
    SELECT p.cidade INTO NEW.cidade FROM public.profiles p WHERE p.id = NEW.dono_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crews_cidade_padrao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crews_cidade_padrao ON public.crews;
CREATE TRIGGER crews_cidade_padrao BEFORE INSERT ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.crews_cidade_padrao();

-- ============================================================================
-- 2. AVALIAÇÃO DA TURMA: uma por pessoa, que pode ser atualizada. Só avalia quem tem
--    conta e jogou pelada finalizada da turma. Dono e administradores não avaliam a própria.
--    Ninguém mexe na tabela direto: tudo passa pelas funções abaixo.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crew_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organizacao NUMERIC NOT NULL CHECK (organizacao BETWEEN 0 AND 10),
  pontualidade NUMERIC NOT NULL CHECK (pontualidade BETWEEN 0 AND 10),
  nivel NUMERIC NOT NULL CHECK (nivel BETWEEN 0 AND 10),
  ambiente NUMERIC NOT NULL CHECK (ambiente BETWEEN 0 AND 10),
  estrutura NUMERIC NOT NULL CHECK (estrutura BETWEEN 0 AND 10),
  nota_geral NUMERIC NOT NULL,
  comentario TEXT CHECK (comentario IS NULL OR char_length(comentario) BETWEEN 1 AND 200),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crew_id, autor_id)
);
ALTER TABLE public.crew_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crew_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crew_reviews TO service_role;

-- a nota da turma acompanha as avaliações (inclusive quando alguém exclui a conta)
CREATE OR REPLACE FUNCTION public.recalcular_nota_da_turma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_crew UUID := COALESCE(NEW.crew_id, OLD.crew_id);
BEGIN
  UPDATE public.crews c
  SET nota = sub.media, avaliacoes = sub.total
  FROM (SELECT round(avg(r.nota_geral), 2) AS media, count(*)::int AS total
        FROM public.crew_reviews r WHERE r.crew_id = v_crew) sub
  WHERE c.id = v_crew;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.recalcular_nota_da_turma() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crew_reviews_recalc ON public.crew_reviews;
CREATE TRIGGER crew_reviews_recalc AFTER INSERT OR UPDATE OR DELETE ON public.crew_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_nota_da_turma();

CREATE OR REPLACE FUNCTION public.pode_avaliar_turma(p_crew_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.eh_convidado)
    AND EXISTS (SELECT 1 FROM public.crews c
                WHERE c.id = p_crew_id AND c.excluida_em IS NULL AND c.dono_id <> auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.crew_members cm
                    WHERE cm.crew_id = p_crew_id AND cm.user_id = auth.uid() AND cm.admin)
    AND (
      -- confirmou presença numa pelada da turma que foi finalizada
      EXISTS (SELECT 1 FROM public.match_participants mp
              JOIN public.matches m ON m.id = mp.match_id
              WHERE m.crew_id = p_crew_id AND m.status = 'finalizada'
                AND mp.user_id = auth.uid() AND mp.status = 'aprovado')
      -- ou estava no elenco de um jogo com placar
      OR EXISTS (SELECT 1 FROM public.match_players pl
                 JOIN public.crew_members cm ON cm.id = pl.member_id
                 JOIN public.matches m ON m.id = pl.match_id
                 WHERE m.crew_id = p_crew_id AND m.placar_finalizado_em IS NOT NULL
                   AND cm.user_id = auth.uid() AND pl.jogos > 0)
    );
$$;

CREATE OR REPLACE FUNCTION public.avaliar_turma(
  p_crew_id UUID, p_organizacao NUMERIC, p_pontualidade NUMERIC, p_nivel NUMERIC,
  p_ambiente NUMERIC, p_estrutura NUMERIC, p_comentario TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comentario TEXT := nullif(btrim(regexp_replace(p_comentario, '\s+', ' ', 'g')), '');
  v_geral NUMERIC := round((p_organizacao + p_pontualidade + p_nivel + p_ambiente + p_estrutura) / 5.0, 2);
BEGIN
  IF NOT public.pode_avaliar_turma(p_crew_id) THEN
    RAISE EXCEPTION 'Só quem já jogou uma pelada dessa turma pode avaliar. Dono e administradores não avaliam a própria turma.';
  END IF;
  INSERT INTO public.crew_reviews (crew_id, autor_id, organizacao, pontualidade, nivel, ambiente, estrutura, nota_geral, comentario)
  VALUES (p_crew_id, auth.uid(), p_organizacao, p_pontualidade, p_nivel, p_ambiente, p_estrutura, v_geral, v_comentario)
  ON CONFLICT (crew_id, autor_id) DO UPDATE
  SET organizacao = EXCLUDED.organizacao, pontualidade = EXCLUDED.pontualidade, nivel = EXCLUDED.nivel,
      ambiente = EXCLUDED.ambiente, estrutura = EXCLUDED.estrutura, nota_geral = EXCLUDED.nota_geral,
      comentario = EXCLUDED.comentario, atualizado_em = now();
END;
$$;

-- ============================================================================
-- 3. PEDIDO DE ENTRADA: quem achou a turma pelo ranking pede, o dono ou um admin aprova.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crew_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ,
  respondido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (crew_id, user_id)
);
CREATE INDEX IF NOT EXISTS crew_join_requests_pendentes_idx
  ON public.crew_join_requests (crew_id) WHERE status = 'pendente';
ALTER TABLE public.crew_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crew_join_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crew_join_requests TO service_role;

CREATE OR REPLACE FUNCTION public.pedir_entrada_na_turma(p_crew_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_antigo public.crew_join_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.eh_convidado) THEN
    RAISE EXCEPTION 'Crie sua conta pra pedir entrada numa turma.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crews c WHERE c.id = p_crew_id AND c.excluida_em IS NULL AND c.aceita_pedidos) THEN
    RAISE EXCEPTION 'Essa turma não está aceitando pedidos de entrada.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.crew_members cm
             WHERE cm.crew_id = p_crew_id AND cm.user_id = v_uid AND cm.removido_em IS NULL) THEN
    RAISE EXCEPTION 'Você já é dessa turma.';
  END IF;
  SELECT * INTO v_antigo FROM public.crew_join_requests j WHERE j.crew_id = p_crew_id AND j.user_id = v_uid;
  IF v_antigo.status = 'pendente' THEN
    RETURN;
  END IF;
  IF v_antigo.status = 'recusado' AND v_antigo.respondido_em > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Seu pedido foi recusado há pouco tempo. Dá pra pedir de novo em alguns dias.';
  END IF;
  IF (SELECT count(*) FROM public.crew_join_requests j WHERE j.user_id = v_uid AND j.status = 'pendente') >= 10 THEN
    RAISE EXCEPTION 'Você já tem muitos pedidos esperando resposta.';
  END IF;
  INSERT INTO public.crew_join_requests (crew_id, user_id) VALUES (p_crew_id, v_uid)
  ON CONFLICT (crew_id, user_id) DO UPDATE
  SET status = 'pendente', criado_em = now(), respondido_em = NULL, respondido_por = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_de_entrada(p_crew_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.crew_join_requests
  WHERE crew_id = p_crew_id AND user_id = auth.uid() AND status = 'pendente';
$$;

-- pedidos esperando resposta, com o resumo de quem pediu (só dono e administradores)
CREATE OR REPLACE FUNCTION public.pedidos_da_turma(p_crew_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, nome TEXT, handle TEXT, foto_url TEXT, cidade TEXT, posicao TEXT,
  overall NUMERIC, avaliacoes_recebidas INTEGER, tier TEXT, peladas INTEGER, criado_em TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, p.id, p.nome_exibicao, p.handle, p.foto_url, p.cidade, p.posicao_preferida,
         p.overall, p.avaliacoes_recebidas, p.tier_reconhecido, p.peladas_jogadas, j.criado_em
  FROM public.crew_join_requests j
  JOIN public.profiles p ON p.id = j.user_id
  WHERE j.crew_id = p_crew_id AND j.status = 'pendente' AND public.gere_turma(p_crew_id)
  ORDER BY j.criado_em;
$$;

CREATE OR REPLACE FUNCTION public.responder_pedido_de_entrada(p_pedido_id UUID, p_aprovar BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pedido public.crew_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_pedido FROM public.crew_join_requests j WHERE j.id = p_pedido_id AND j.status = 'pendente';
  IF v_pedido.id IS NULL OR NOT public.gere_turma(v_pedido.crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma responde pedidos.';
  END IF;
  IF p_aprovar AND NOT EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = v_pedido.crew_id AND cm.user_id = v_pedido.user_id
  ) THEN
    INSERT INTO public.crew_members (crew_id, user_id, nome)
    SELECT v_pedido.crew_id, p.id, p.nome_exibicao FROM public.profiles p WHERE p.id = v_pedido.user_id;
  END IF;
  UPDATE public.crew_join_requests
  SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'recusado' END,
      respondido_em = now(), respondido_por = auth.uid()
  WHERE id = p_pedido_id;
END;
$$;

-- Tudo o que a página da turma precisa saber sobre notas e sobre a situação de quem está vendo.
CREATE OR REPLACE FUNCTION public.resumo_da_turma(p_crew_id UUID)
RETURNS TABLE (
  total BIGINT, nota NUMERIC, organizacao NUMERIC, pontualidade NUMERIC, nivel NUMERIC,
  ambiente NUMERIC, estrutura NUMERIC, posso_avaliar BOOLEAN, pedido TEXT, aceita_pedidos BOOLEAN,
  minha JSONB
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.crew_reviews r WHERE r.crew_id = c.id),
    c.nota,
    (SELECT avg(r.organizacao) FROM public.crew_reviews r WHERE r.crew_id = c.id),
    (SELECT avg(r.pontualidade) FROM public.crew_reviews r WHERE r.crew_id = c.id),
    (SELECT avg(r.nivel) FROM public.crew_reviews r WHERE r.crew_id = c.id),
    (SELECT avg(r.ambiente) FROM public.crew_reviews r WHERE r.crew_id = c.id),
    (SELECT avg(r.estrutura) FROM public.crew_reviews r WHERE r.crew_id = c.id),
    public.pode_avaliar_turma(c.id),
    (SELECT j.status FROM public.crew_join_requests j WHERE j.crew_id = c.id AND j.user_id = auth.uid()),
    c.aceita_pedidos,
    (SELECT jsonb_build_object('organizacao', r.organizacao, 'pontualidade', r.pontualidade, 'nivel', r.nivel,
                               'ambiente', r.ambiente, 'estrutura', r.estrutura, 'comentario', r.comentario)
     FROM public.crew_reviews r WHERE r.crew_id = c.id AND r.autor_id = auth.uid())
  FROM public.crews c
  WHERE c.id = p_crew_id AND c.excluida_em IS NULL;
$$;

-- ============================================================================
-- 4. LINK DE CONVITE COM CÓDIGO. Antes, quem soubesse o endereço da turma entrava; com o
--    ranking esse endereço fica à vista. Agora só entra direto quem tem o código do link
--    que o organizador mandou; os outros pedem entrada.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crew_invites (
  crew_id UUID PRIMARY KEY REFERENCES public.crews(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crew_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crew_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crew_invites TO authenticated;
GRANT ALL ON public.crew_invites TO service_role;
-- o código aparece pra quem gere a turma e pra quem já é dela (pra poder chamar os amigos)
DROP POLICY IF EXISTS "crew_invites_select_da_turma" ON public.crew_invites;
CREATE POLICY "crew_invites_select_da_turma" ON public.crew_invites FOR SELECT TO authenticated
  USING (
    public.gere_turma(crew_id)
    OR EXISTS (SELECT 1 FROM public.crew_members cm
               WHERE cm.crew_id = crew_invites.crew_id AND cm.user_id = auth.uid() AND cm.removido_em IS NULL)
  );

INSERT INTO public.crew_invites (crew_id)
SELECT c.id FROM public.crews c ON CONFLICT (crew_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.crews_criar_convite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crew_invites (crew_id) VALUES (NEW.id) ON CONFLICT (crew_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crews_criar_convite() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crews_criar_convite ON public.crews;
CREATE TRIGGER crews_criar_convite AFTER INSERT ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.crews_criar_convite();

-- link antigo vazou? gera um código novo e o antigo para de valer
CREATE OR REPLACE FUNCTION public.renovar_convite_da_turma(p_crew_id UUID)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token TEXT := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
BEGIN
  IF NOT public.gere_turma(p_crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador troca o link da turma.';
  END IF;
  INSERT INTO public.crew_invites (crew_id, token) VALUES (p_crew_id, v_token)
  ON CONFLICT (crew_id) DO UPDATE SET token = EXCLUDED.token, criado_em = now();
  RETURN v_token;
END;
$$;

-- entrar na turma agora exige o código do link (a função ganha um parâmetro, então é recriada)
DROP FUNCTION IF EXISTS public.entrar_na_turma(UUID, UUID);
CREATE FUNCTION public.entrar_na_turma(p_crew_id UUID, p_member_id UUID DEFAULT NULL, p_token TEXT DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para entrar na turma.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crews c WHERE c.id = p_crew_id AND c.excluida_em IS NULL) THEN
    RAISE EXCEPTION 'Essa turma não existe mais.';
  END IF;

  SELECT cm.id INTO v_id FROM public.crew_members cm WHERE cm.crew_id = p_crew_id AND cm.user_id = v_uid;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  IF p_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.crew_invites i WHERE i.crew_id = p_crew_id AND i.token = p_token
  ) THEN
    RAISE EXCEPTION 'Esse link de convite não vale mais. Peça o link novo pra quem organiza, ou peça pra entrar na turma.';
  END IF;

  IF p_member_id IS NOT NULL THEN
    UPDATE public.crew_members cm SET user_id = v_uid, removido_em = NULL
    WHERE cm.id = p_member_id AND cm.crew_id = p_crew_id AND cm.user_id IS NULL
    RETURNING cm.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Esse jogador já está ligado a outra conta.';
    END IF;
  ELSE
    INSERT INTO public.crew_members (crew_id, user_id, nome)
    SELECT p_crew_id, v_uid, p.nome_exibicao FROM public.profiles p WHERE p.id = v_uid
    RETURNING id INTO v_id;
  END IF;
  -- entrou pelo link: um pedido que estivesse esperando deixa de fazer sentido
  DELETE FROM public.crew_join_requests WHERE crew_id = p_crew_id AND user_id = v_uid;
  RETURN v_id;
END;
$$;

-- ============================================================================
-- 5. RANKING DE TURMAS DA CIDADE. Com menos de 3 avaliações a turma aparece, mas depois
--    das que já têm nota (mesma régua do overall dos jogadores).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ranking_de_turmas(p_cidade TEXT)
RETURNS TABLE (
  crew_id UUID, nome TEXT, escudo_url TEXT, cidade TEXT, nota NUMERIC, avaliacoes INTEGER,
  membros BIGINT, peladas BIGINT, aceita_pedidos BOOLEAN, sou_membro BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.nome, c.escudo_url, c.cidade, c.nota, c.avaliacoes,
    (SELECT count(*) FROM public.crew_members cm WHERE cm.crew_id = c.id AND cm.removido_em IS NULL),
    (SELECT count(*) FROM public.matches m WHERE m.crew_id = c.id AND m.status = 'finalizada'),
    c.aceita_pedidos,
    c.dono_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.crew_members cm
      WHERE cm.crew_id = c.id AND cm.user_id = auth.uid() AND cm.removido_em IS NULL)
  FROM public.crews c
  WHERE c.excluida_em IS NULL AND c.cidade = p_cidade
  ORDER BY (c.avaliacoes >= 3) DESC, c.nota DESC NULLS LAST, c.avaliacoes DESC, c.criado_em
  LIMIT 100;
$$;

-- ============================================================================
-- 6. COMENTÁRIOS DA TURMA: assinados e denunciáveis, como os de jogador.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.comentarios_da_turma(p_crew_id UUID)
RETURNS TABLE (
  id UUID, autor_id UUID, autor_nome TEXT, autor_foto TEXT, comentario TEXT,
  criado_em TIMESTAMPTZ, meu BOOLEAN, denunciei BOOLEAN, oculto BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, a.id, a.nome_exibicao, a.foto_url, r.comentario, r.atualizado_em,
    r.autor_id = auth.uid(),
    EXISTS (SELECT 1 FROM public.denuncias d
            WHERE d.tipo = 'comentario_turma' AND d.alvo_id = r.id AND d.denunciante_id = auth.uid()),
    public.comentario_oculto('comentario_turma', r.id)
  FROM public.crew_reviews r
  JOIN public.profiles a ON a.id = r.autor_id
  WHERE r.crew_id = p_crew_id
    AND r.comentario IS NOT NULL
    AND (r.autor_id = auth.uid() OR NOT public.comentario_oculto('comentario_turma', r.id))
  ORDER BY r.atualizado_em DESC
  LIMIT 50;
$$;

-- a denúncia passa a valer também pra comentário de turma
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
  ELSIF p_tipo = 'comentario_turma' THEN
    SELECT r.autor_id INTO v_autor FROM public.crew_reviews r
    WHERE r.id = p_alvo_id AND r.comentario IS NOT NULL;
  ELSE
    RAISE EXCEPTION 'Tipo de denúncia desconhecido.';
  END IF;
  IF v_autor IS NULL THEN
    RAISE EXCEPTION 'Esse comentário não existe mais.';
  END IF;
  IF v_autor = v_uid THEN
    RAISE EXCEPTION 'Esse comentário é seu. Se quiser, é só apagar.';
  END IF;
  IF (SELECT count(*) FROM public.denuncias d
      WHERE d.denunciante_id = v_uid AND d.criado_em > now() - interval '24 hours') >= 15 THEN
    RAISE EXCEPTION 'Você já denunciou bastante por hoje. Tenta de novo amanhã.';
  END IF;
  INSERT INTO public.denuncias (tipo, alvo_id, denunciante_id, motivo)
  VALUES (p_tipo, p_alvo_id, v_uid, nullif(btrim(left(p_motivo, 200)), ''))
  ON CONFLICT (tipo, alvo_id, denunciante_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.apagar_meu_comentario_de_turma(p_review_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crew_reviews SET comentario = NULL WHERE id = p_review_id AND autor_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esse comentário não é seu.';
  END IF;
END;
$$;

-- ============================================================================
-- 7. Quem pode chamar o quê: tudo só pra quem está logado.
-- ============================================================================
REVOKE ALL ON FUNCTION
  public.pode_avaliar_turma(UUID),
  public.avaliar_turma(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT),
  public.resumo_da_turma(UUID),
  public.pedir_entrada_na_turma(UUID),
  public.cancelar_pedido_de_entrada(UUID),
  public.pedidos_da_turma(UUID),
  public.responder_pedido_de_entrada(UUID, BOOLEAN),
  public.renovar_convite_da_turma(UUID),
  public.entrar_na_turma(UUID, UUID, TEXT),
  public.ranking_de_turmas(TEXT),
  public.comentarios_da_turma(UUID),
  public.denunciar_comentario(TEXT, UUID, TEXT),
  public.apagar_meu_comentario_de_turma(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.avaliar_turma(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT),
  public.resumo_da_turma(UUID),
  public.pedir_entrada_na_turma(UUID),
  public.cancelar_pedido_de_entrada(UUID),
  public.pedidos_da_turma(UUID),
  public.responder_pedido_de_entrada(UUID, BOOLEAN),
  public.renovar_convite_da_turma(UUID),
  public.entrar_na_turma(UUID, UUID, TEXT),
  public.ranking_de_turmas(TEXT),
  public.comentarios_da_turma(UUID),
  public.denunciar_comentario(TEXT, UUID, TEXT),
  public.apagar_meu_comentario_de_turma(UUID)
  TO authenticated;
-- só as outras funções usam esta
REVOKE ALL ON FUNCTION public.pode_avaliar_turma(UUID) FROM authenticated;
