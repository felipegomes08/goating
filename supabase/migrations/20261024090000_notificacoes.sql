-- Notificações (o sino do app). Cada momento importante da pelada, da turma e do perfil
-- gera um aviso pra quem interessa. Quem fez a ação não recebe aviso dela, e convidado (sem
-- conta) não recebe nada. Os avisos são criados só pelo banco: gatilhos nas tabelas que já
-- existem e uma rotina a cada 5 minutos pros lembretes.

-- 1. TABELA
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT,
  -- tela que abre ao tocar ("/pelada/<id>", "/turma/<id>"...)
  link TEXT,
  -- evita repetir o mesmo aviso (lembretes, MVP...): um por pessoa por chave
  chave TEXT,
  lida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notificacoes_user_idx ON public.notificacoes (user_id, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_chave_idx ON public.notificacoes (user_id, chave)
  WHERE chave IS NOT NULL;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.notificacoes TO authenticated;
GRANT UPDATE (lida_em) ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
DROP POLICY IF EXISTS notificacoes_minhas_ler ON public.notificacoes;
CREATE POLICY notificacoes_minhas_ler ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notificacoes_minhas_marcar ON public.notificacoes;
CREATE POLICY notificacoes_minhas_marcar ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notificacoes_minhas_apagar ON public.notificacoes;
CREATE POLICY notificacoes_minhas_apagar ON public.notificacoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- o sino acende na hora (o tempo real respeita as regras de leitura acima)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificacoes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
END $$;

-- peladas avisadas como "nova pelada" (recorrentes são avisadas quando entram nos próximos 7 dias)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS avisada_em TIMESTAMPTZ;
-- as que já existem não disparam aviso atrasado
UPDATE public.matches SET avisada_em = now() WHERE avisada_em IS NULL;

-- 2. AJUDANTES
CREATE OR REPLACE FUNCTION public.notificar(
  p_user UUID, p_tipo TEXT, p_titulo TEXT, p_corpo TEXT, p_link TEXT,
  p_chave TEXT DEFAULT NULL, p_mesmo_se_eu BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user IS NULL OR (p_user = auth.uid() AND NOT p_mesmo_se_eu) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user AND NOT p.eh_convidado) THEN
    RETURN;
  END IF;
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, link, chave)
  VALUES (p_user, p_tipo, left(p_titulo, 200), left(p_corpo, 300), p_link, p_chave)
  ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.nome_curto(p_user UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE((SELECT btrim(nome_exibicao) FROM public.profiles WHERE id = p_user), 'Alguém') $$;

-- "quinta, 23/10 às 18:45"
CREATE OR REPLACE FUNCTION public.quando_da_pelada(p_data DATE, p_horario TIME)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (ARRAY['domingo','segunda','terça','quarta','quinta','sexta','sábado'])[extract(dow FROM p_data)::int + 1]
         || ', ' || to_char(p_data, 'DD/MM') || ' às ' || to_char(p_horario, 'HH24:MI')
$$;

-- dono e administradores ativos de uma turma
CREATE OR REPLACE FUNCTION public.gestores_da_turma(p_crew UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.dono_id FROM public.crews c WHERE c.id = p_crew AND c.excluida_em IS NULL
  UNION
  SELECT cm.user_id FROM public.crew_members cm
  JOIN public.crews c ON c.id = cm.crew_id AND c.excluida_em IS NULL
  WHERE cm.crew_id = p_crew AND cm.admin AND cm.user_id IS NOT NULL AND cm.removido_em IS NULL
$$;

-- 3. PRESENÇA NA PELADA: confirmou, pediu, lotou, aceito, desistiu, tirado
CREATE OR REPLACE FUNCTION public.notif_presencas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_link TEXT;
  v_n INT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = COALESCE(NEW.match_id, OLD.match_id);
  -- pelada apagada (as presenças saem junto) ou já jogada: sem aviso
  IF m.id IS NULL OR m.status = 'finalizada' THEN
    RETURN NULL;
  END IF;
  v_link := '/pelada/' || m.id;
  SELECT count(*) INTO v_n FROM public.match_participants WHERE match_id = m.id AND status = 'aprovado';

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'aprovado' THEN
      PERFORM public.notificar(m.organizador_id, 'confirmou',
        public.nome_curto(NEW.user_id) || ' confirmou na ' || m.titulo,
        v_n || '/' || m.quantidade_vagas || ' confirmados', v_link);
    ELSIF NEW.status = 'pendente' THEN
      PERFORM public.notificar(m.organizador_id, 'pedido_pelada',
        public.nome_curto(NEW.user_id) || ' pediu pra entrar na ' || m.titulo,
        'Toque pra aceitar ou recusar.', v_link);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pendente' AND NEW.status = 'aprovado' THEN
      PERFORM public.notificar(NEW.user_id, 'pedido_aceito',
        'Você entrou na ' || m.titulo, public.quando_da_pelada(m.data, m.horario), v_link);
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'aprovado' THEN
    IF auth.uid() = OLD.user_id THEN
      PERFORM public.notificar(m.organizador_id, 'desistiu',
        public.nome_curto(OLD.user_id) || ' desistiu da ' || m.titulo,
        v_n || '/' || m.quantidade_vagas || ' confirmados', v_link);
    ELSIF auth.uid() IS NOT NULL THEN
      PERFORM public.notificar(OLD.user_id, 'tirado',
        'Você saiu da lista da ' || m.titulo, public.quando_da_pelada(m.data, m.horario), v_link);
    END IF;
  END IF;

  -- lotou (uma vez por pelada)
  IF TG_OP <> 'DELETE' AND NEW.status = 'aprovado' AND v_n >= m.quantidade_vagas THEN
    PERFORM public.notificar(m.organizador_id, 'lotou',
      m.titulo || ' lotou', v_n || '/' || m.quantidade_vagas || ' confirmados', v_link,
      'lotou:' || m.id, true);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_presencas ON public.match_participants;
CREATE TRIGGER notif_presencas
AFTER INSERT OR UPDATE OF status OR DELETE ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.notif_presencas();

-- 4. TURMA: entrou, virou administrador, pedido, pedido aceito
CREATE OR REPLACE FUNCTION public.notif_membros()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma TEXT;
  v_link TEXT := '/turma/' || NEW.crew_id;
  g UUID;
BEGIN
  SELECT nome INTO v_turma FROM public.crews WHERE id = NEW.crew_id AND excluida_em IS NULL;
  IF v_turma IS NULL THEN
    RETURN NULL;
  END IF;
  -- ganhou conta na turma: entrou agora, ou ligou a conta a um jogador que já existia
  IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.user_id IS NULL) THEN
    FOR g IN SELECT public.gestores_da_turma(NEW.crew_id) LOOP
      IF g <> NEW.user_id THEN
        PERFORM public.notificar(g, 'entrou_turma',
          public.nome_curto(NEW.user_id) || ' entrou na ' || v_turma, NULL, v_link);
      END IF;
    END LOOP;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.admin AND NOT OLD.admin AND NEW.user_id IS NOT NULL THEN
    PERFORM public.notificar(NEW.user_id, 'admin',
      'Você agora é administrador da ' || v_turma,
      'Dá pra montar times, marcar placar e organizar as peladas.', v_link);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_membros ON public.crew_members;
CREATE TRIGGER notif_membros
AFTER INSERT OR UPDATE OF user_id, admin ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.notif_membros();

CREATE OR REPLACE FUNCTION public.notif_pedidos_turma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turma TEXT;
  v_link TEXT := '/turma/' || NEW.crew_id;
  g UUID;
BEGIN
  SELECT nome INTO v_turma FROM public.crews WHERE id = NEW.crew_id AND excluida_em IS NULL;
  IF v_turma IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'pendente' THEN
    FOR g IN SELECT public.gestores_da_turma(NEW.crew_id) LOOP
      PERFORM public.notificar(g, 'pedido_turma',
        public.nome_curto(NEW.user_id) || ' quer entrar na ' || v_turma,
        'Toque pra ver o perfil e responder.', v_link);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pendente' AND NEW.status = 'aprovado' THEN
    PERFORM public.notificar(NEW.user_id, 'pedido_aceito_turma', 'Você entrou na ' || v_turma,
      'Seu pedido foi aceito.', v_link);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_pedidos_turma ON public.crew_join_requests;
CREATE TRIGGER notif_pedidos_turma
AFTER INSERT OR UPDATE OF status ON public.crew_join_requests
FOR EACH ROW EXECUTE FUNCTION public.notif_pedidos_turma();

-- 5. PELADA: nova, mudou, apagada, avaliação aberta, MVP
-- pelada nova nos próximos 7 dias: já sai marcada como avisada (o aviso vai no gatilho de depois)
CREATE OR REPLACE FUNCTION public.marca_pelada_avisada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.crew_id IS NOT NULL AND NEW.status = 'agendada'
     AND NEW.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date + 7 THEN
    NEW.avisada_em := now();
  ELSE
    NEW.avisada_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS marca_pelada_avisada ON public.matches;
CREATE TRIGGER marca_pelada_avisada
BEFORE INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.marca_pelada_avisada();

-- avisa os jogadores da turma que tem pelada nova (usada no gatilho e na rotina)
CREATE OR REPLACE FUNCTION public.avisar_pelada_nova(p_match UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_turma TEXT;
  u UUID;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match;
  SELECT nome INTO v_turma FROM public.crews WHERE id = m.crew_id AND excluida_em IS NULL;
  IF v_turma IS NULL THEN
    RETURN;
  END IF;
  FOR u IN
    SELECT DISTINCT cm.user_id FROM public.crew_members cm
    WHERE cm.crew_id = m.crew_id AND cm.user_id IS NOT NULL AND cm.removido_em IS NULL
      AND cm.user_id <> m.organizador_id
  LOOP
    PERFORM public.notificar(u, 'nova_pelada', 'Nova pelada na ' || v_turma,
      m.titulo || ': ' || public.quando_da_pelada(m.data, m.horario) || '. Confirma aí?',
      '/pelada/' || m.id, 'nova:' || m.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_peladas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link TEXT := '/pelada/' || NEW.id;
  v_fim TIMESTAMPTZ;
  u UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.avisada_em IS NOT NULL THEN
      PERFORM public.avisar_pelada_nova(NEW.id);
    END IF;
    RETURN NULL;
  END IF;

  -- mudou dia, horário ou local de uma pelada que ainda vai acontecer
  IF NEW.status = 'agendada' AND (NEW.data, NEW.horario, NEW.local) IS DISTINCT FROM (OLD.data, OLD.horario, OLD.local) THEN
    FOR u IN SELECT user_id FROM public.match_participants WHERE match_id = NEW.id AND status = 'aprovado' LOOP
      PERFORM public.notificar(u, 'mudou', NEW.titulo || ' mudou',
        'Agora: ' || public.quando_da_pelada(NEW.data, NEW.horario) || ', ' || NEW.local, v_link);
    END LOOP;
  END IF;

  -- finalizada: abre a avaliação pra quem jogou
  IF OLD.status <> 'finalizada' AND NEW.status = 'finalizada' AND NEW.finalizada_em IS NOT NULL THEN
    v_fim := COALESCE(NEW.avaliacao_ate, NEW.finalizada_em + public.janela_de_avaliacao());
    IF v_fim > now() THEN
      FOR u IN SELECT user_id FROM public.match_participants WHERE match_id = NEW.id AND status = 'aprovado' LOOP
        PERFORM public.notificar(u, 'avaliar', 'Avaliações abertas: ' || NEW.titulo,
          'Dá sua nota pra galera até ' || to_char(v_fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.',
          v_link || '/avaliar', 'avaliar:' || NEW.id);
      END LOOP;
    END IF;
  END IF;

  -- saiu o MVP (no fechamento da janela)
  IF NEW.mvp_fechado_em IS NOT NULL AND OLD.mvp_fechado_em IS NULL AND NEW.mvp_id IS NOT NULL THEN
    FOR u IN SELECT user_id FROM public.match_participants WHERE match_id = NEW.id AND status = 'aprovado' LOOP
      IF u = NEW.mvp_id THEN
        PERFORM public.notificar(u, 'mvp_voce', 'Você é o MVP da ' || NEW.titulo || '!',
          'Toque pra ver e compartilhar o seu cartão.', v_link, 'mvp:' || NEW.id, true);
      ELSE
        PERFORM public.notificar(u, 'mvp', 'MVP da ' || NEW.titulo || ': ' || public.nome_curto(NEW.mvp_id),
          'Toque pra ver o cartão do craque.', v_link, 'mvp:' || NEW.id, true);
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_peladas ON public.matches;
CREATE TRIGGER notif_peladas
AFTER INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.notif_peladas();

-- apagada: avisa quem tinha confirmado (antes de apagar, enquanto a lista ainda existe)
CREATE OR REPLACE FUNCTION public.notif_pelada_apagada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u UUID;
BEGIN
  IF OLD.status <> 'finalizada' AND OLD.data >= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    FOR u IN SELECT user_id FROM public.match_participants WHERE match_id = OLD.id AND status = 'aprovado' LOOP
      PERFORM public.notificar(u, 'cancelada',
        'A ' || OLD.titulo || ' de ' || to_char(OLD.data, 'DD/MM') || ' foi cancelada', NULL, '/');
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS notif_pelada_apagada ON public.matches;
CREATE TRIGGER notif_pelada_apagada
BEFORE DELETE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.notif_pelada_apagada();

-- 6. PERFIL: subiu de nível (pra revelar) e, depois de revelado, aviso pros seguidores
CREATE OR REPLACE FUNCTION public.notif_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u UUID;
BEGIN
  IF NEW.tier_pendente IS NOT NULL AND NEW.tier_pendente IS DISTINCT FROM OLD.tier_pendente THEN
    PERFORM public.notificar(NEW.id, 'subiu', 'Você subiu pro ' || NEW.tier_pendente || '!',
      'Toque pra revelar sua carta nova.', '/perfil', 'subiu:' || NEW.tier_pendente, true);
  END IF;
  IF NEW.tier_reconhecido IS NOT NULL AND NEW.tier_reconhecido IS DISTINCT FROM OLD.tier_reconhecido THEN
    FOR u IN SELECT seguidor_id FROM public.followers WHERE seguido_id = NEW.id LOOP
      PERFORM public.notificar(u, 'colega_subiu',
        btrim(NEW.nome_exibicao) || ' chegou no ' || NEW.tier_reconhecido, 'Toque pra ver a carta.',
        '/jogador/' || NEW.id, 'colega:' || NEW.id || ':' || NEW.tier_reconhecido);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_tier ON public.profiles;
-- sem "OF coluna": o tier pendente é gravado por outro gatilho, não pelo comando em si
CREATE TRIGGER notif_tier
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.tier_pendente IS DISTINCT FROM OLD.tier_pendente
      OR NEW.tier_reconhecido IS DISTINCT FROM OLD.tier_reconhecido)
EXECUTE FUNCTION public.notif_tier();

-- 7. SOCIAL: novo seguidor, comentário novo
CREATE OR REPLACE FUNCTION public.notif_seguidor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notificar(NEW.seguido_id, 'seguidor',
    public.nome_curto(NEW.seguidor_id) || ' começou a te seguir', NULL,
    '/jogador/' || NEW.seguidor_id, 'seguidor:' || NEW.seguidor_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_seguidor ON public.followers;
CREATE TRIGGER notif_seguidor
AFTER INSERT ON public.followers
FOR EACH ROW EXECUTE FUNCTION public.notif_seguidor();

CREATE OR REPLACE FUNCTION public.notif_comentario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.comentario IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.comentario IS NULL) THEN
    PERFORM public.notificar(NEW.avaliado_id, 'comentario', 'Você recebeu um comentário novo',
      'É anônimo: ninguém vê quem escreveu.', '/perfil', 'comentario:' || NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notif_comentario ON public.evaluations;
CREATE TRIGGER notif_comentario
AFTER INSERT OR UPDATE OF comentario ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.notif_comentario();

-- 8. ROTINA A CADA 5 MINUTOS: lembretes e peladas recorrentes que entraram na semana
CREATE OR REPLACE FUNCTION public.rodar_notificacoes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  u UUID;
  v_n INT;
BEGIN
  -- 3h antes: confirmados e quem organiza
  FOR m IN
    SELECT * FROM public.matches
    WHERE status = 'agendada'
      AND (data + horario) AT TIME ZONE 'America/Sao_Paulo' BETWEEN now() AND now() + interval '3 hours'
  LOOP
    SELECT count(*) INTO v_n FROM public.match_participants WHERE match_id = m.id AND status = 'aprovado';
    PERFORM public.notificar(m.organizador_id, 'lembrete_org',
      m.titulo || ' às ' || to_char(m.horario, 'HH24:MI') || ': ' || v_n || ' confirmados',
      'Bora montar os times?', '/pelada/' || m.id, 'lembrete:' || m.id);
    FOR u IN SELECT user_id FROM public.match_participants
             WHERE match_id = m.id AND status = 'aprovado' AND user_id <> m.organizador_id LOOP
      PERFORM public.notificar(u, 'lembrete', 'Hoje tem: ' || m.titulo || ' às ' || to_char(m.horario, 'HH24:MI'),
        m.local, '/pelada/' || m.id, 'lembrete:' || m.id);
    END LOOP;
  END LOOP;

  -- 30 min antes de fechar a avaliação: quem jogou e ainda não avaliou todo mundo
  FOR m IN
    SELECT *, COALESCE(avaliacao_ate, finalizada_em + public.janela_de_avaliacao()) AS fim
    FROM public.matches
    WHERE status = 'finalizada' AND mvp_fechado_em IS NULL AND finalizada_em IS NOT NULL
      AND COALESCE(avaliacao_ate, finalizada_em + public.janela_de_avaliacao())
          BETWEEN now() AND now() + interval '30 minutes'
  LOOP
    SELECT count(*) INTO v_n FROM public.match_participants WHERE match_id = m.id AND status = 'aprovado';
    FOR u IN
      SELECT p.user_id FROM public.match_participants p
      WHERE p.match_id = m.id AND p.status = 'aprovado'
        AND (SELECT count(*) FROM public.evaluations e WHERE e.match_id = m.id AND e.avaliador_id = p.user_id) < v_n - 1
    LOOP
      PERFORM public.notificar(u, 'avaliar_fim', 'Faltam 30 min pra avaliar a ' || m.titulo,
        'Depois disso sai o MVP.', '/pelada/' || m.id || '/avaliar', 'avaliar_fim:' || m.id);
    END LOOP;
  END LOOP;

  -- pelada (recorrente) que entrou nos próximos 7 dias e ainda não foi avisada
  FOR m IN
    SELECT id FROM public.matches
    WHERE avisada_em IS NULL AND crew_id IS NOT NULL AND status = 'agendada'
      AND data BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date
                   AND (now() AT TIME ZONE 'America/Sao_Paulo')::date + 7
  LOOP
    UPDATE public.matches SET avisada_em = now() WHERE id = m.id;
    PERFORM public.avisar_pelada_nova(m.id);
  END LOOP;

  -- notificação com mais de 60 dias some
  DELETE FROM public.notificacoes WHERE criado_em < now() - interval '60 days';
END;
$$;

-- ninguém chama essas funções pela API: só os gatilhos e a rotina
REVOKE ALL ON FUNCTION public.notificar(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nome_curto(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quando_da_pelada(DATE, TIME) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gestores_da_turma(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.avisar_pelada_nova(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rodar_notificacoes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_presencas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_membros() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_pedidos_turma() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marca_pelada_avisada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_peladas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_pelada_apagada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_tier() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_seguidor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_comentario() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('notificacoes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notificacoes');
SELECT cron.schedule('notificacoes', '*/5 * * * *', 'SELECT public.rodar_notificacoes();');
