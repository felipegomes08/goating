-- Lista de confirmação da pelada no chat da turma.
--
-- A lista é uma mensagem do tipo 'lista' ligada à pelada. Cada membro responde "Vou" (entra na
-- pelada confirmado, se tiver vaga) ou "Não vou" (sai, se estava, e fica marcado).
-- Ela cai no chat sozinha quando a pelada da turma é anunciada (avisar_pelada_nova: na criação,
-- se for em até 7 dias, ou depois pelo agendador) e o organizador ou ADM pode reenviar.

-- quem respondeu "Não vou" (fica à parte de match_participants, que só tem quem vai)
CREATE TABLE public.nao_vou (
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);
ALTER TABLE public.nao_vou ENABLE ROW LEVEL SECURITY;
CREATE POLICY nao_vou_select_turma ON public.nao_vou
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = nao_vou.match_id AND m.crew_id IS NOT NULL AND public.membro_da_turma(m.crew_id)
  ));
REVOKE ALL ON public.nao_vou FROM anon, authenticated;
GRANT SELECT ON public.nao_vou TO authenticated;

-- quem confirma pela tela da pelada deixa de estar no "Não vou"
CREATE OR REPLACE FUNCTION public.confirmou_tira_nao_vou()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.nao_vou WHERE match_id = NEW.match_id AND user_id = NEW.user_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER participants_tira_nao_vou
  AFTER INSERT ON public.match_participants
  FOR EACH ROW EXECUTE FUNCTION public.confirmou_tira_nao_vou();

-- põe a lista da pelada no chat da turma (sem checar quem chama: uso interno)
CREATE OR REPLACE FUNCTION public.postar_lista(p_match_id uuid, p_autor uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew uuid;
  v_id uuid;
BEGIN
  SELECT m.crew_id INTO v_crew FROM public.matches m
  JOIN public.crews c ON c.id = m.crew_id AND c.excluida_em IS NULL
  WHERE m.id = p_match_id AND m.status = 'agendada';
  IF v_crew IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id)
  VALUES (v_crew, p_autor, 'lista', p_match_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.postar_lista(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- o organizador ou ADM manda (ou reenvia) a lista no chat
CREATE OR REPLACE FUNCTION public.enviar_lista(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF m.id IS NULL OR m.crew_id IS NULL THEN
    RAISE EXCEPTION 'Essa pelada não é de uma turma.';
  END IF;
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma manda a lista.';
  END IF;
  IF m.status <> 'agendada' OR (m.data + m.horario) AT TIME ZONE 'America/Sao_Paulo' <= now() THEN
    RAISE EXCEPTION 'Essa pelada já começou.';
  END IF;
  v_id := public.postar_lista(p_match_id, auth.uid());
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Não deu pra mandar a lista.';
  END IF;
  RETURN v_id;
END;
$$;

-- "Vou" ou "Não vou" pela lista do chat. Quem responde é da turma, então o "Vou" entra direto
-- confirmado, mesmo em pelada fechada (o pedido com aprovação é pra quem é de fora, na tela da
-- pelada). Lotada não entra. Devolve como a pessoa ficou.
CREATE OR REPLACE FUNCTION public.responder_lista(p_match_id uuid, p_vou boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_eu uuid := auth.uid();
  v_status text;
  v_confirmados int;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF m.id IS NULL OR m.crew_id IS NULL OR NOT public.membro_da_turma(m.crew_id) THEN
    RAISE EXCEPTION 'Só quem é da turma responde a lista.';
  END IF;
  IF m.status <> 'agendada' OR (m.data + m.horario) AT TIME ZONE 'America/Sao_Paulo' <= now() THEN
    RAISE EXCEPTION 'A pelada já começou: a lista fechou.';
  END IF;

  IF NOT p_vou THEN
    -- sair da pelada (o organizador recebe o "desistiu" como na tela da pelada)
    DELETE FROM public.match_participants WHERE match_id = p_match_id AND user_id = v_eu;
    INSERT INTO public.nao_vou (match_id, user_id) VALUES (p_match_id, v_eu)
    ON CONFLICT DO NOTHING;
    RETURN 'nao_vou';
  END IF;

  DELETE FROM public.nao_vou WHERE match_id = p_match_id AND user_id = v_eu;
  SELECT status INTO v_status FROM public.match_participants
  WHERE match_id = p_match_id AND user_id = v_eu;
  IF v_status = 'aprovado' THEN
    RETURN v_status;
  END IF;

  -- trava a pelada pra duas pessoas não pegarem a última vaga ao mesmo tempo
  PERFORM 1 FROM public.matches WHERE id = p_match_id FOR UPDATE;
  SELECT count(*) INTO v_confirmados FROM public.match_participants
  WHERE match_id = p_match_id AND status = 'aprovado';
  IF v_confirmados >= m.quantidade_vagas THEN
    RAISE EXCEPTION 'Lotou! Não tem mais vaga nessa pelada.';
  END IF;

  IF v_status = 'pendente' THEN
    -- pedido feito antes pela tela da pelada: pela lista vira confirmado
    UPDATE public.match_participants SET status = 'aprovado'
    WHERE match_id = p_match_id AND user_id = v_eu;
  ELSE
    INSERT INTO public.match_participants (match_id, user_id, status)
    VALUES (p_match_id, v_eu, 'aprovado');
  END IF;
  RETURN 'aprovado';
END;
$$;

-- o cartão da lista: a pelada e cada pessoa com a resposta dela (vou, pendente, nao_vou ou nula)
CREATE OR REPLACE FUNCTION public.lista_da_pelada(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT * FROM public.matches
    WHERE id = p_match_id AND crew_id IS NOT NULL AND public.membro_da_turma(crew_id)
  ),
  gente AS (
    -- quem é da turma (com conta) e quem está na pelada mesmo sem ser da turma
    SELECT cm.user_id FROM public.crew_members cm, m
    WHERE cm.crew_id = m.crew_id AND cm.user_id IS NOT NULL AND cm.removido_em IS NULL
    UNION
    SELECT mp.user_id FROM public.match_participants mp, m WHERE mp.match_id = m.id
    UNION
    SELECT c.dono_id FROM public.crews c, m WHERE c.id = m.crew_id
  )
  SELECT jsonb_build_object(
    'pelada', jsonb_build_object(
      'id', m.id, 'titulo', m.titulo, 'data', m.data, 'horario', m.horario, 'local', m.local,
      'vagas', m.quantidade_vagas, 'tipo', m.tipo, 'status', m.status,
      -- conta todo mundo confirmado, inclusive convidado sem conta (que não aparece na lista)
      'confirmados', (SELECT count(*) FROM public.match_participants x
                      WHERE x.match_id = m.id AND x.status = 'aprovado'),
      'comecou', m.status <> 'agendada'
                 OR (m.data + m.horario) AT TIME ZONE 'America/Sao_Paulo' <= now()
    ),
    'pessoas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'nome', p.nome_exibicao, 'foto_url', p.foto_url,
        'resposta', CASE
          WHEN mp.status = 'aprovado' THEN 'vou'
          WHEN mp.status = 'pendente' THEN 'pendente'
          WHEN nv.user_id IS NOT NULL THEN 'nao_vou'
        END,
        'respondeu_em', COALESCE(mp.entrou_em, nv.criado_em)
      ) ORDER BY COALESCE(mp.entrou_em, nv.criado_em), p.nome_exibicao)
      FROM gente g
      JOIN public.profiles p ON p.id = g.user_id AND NOT p.eh_convidado
      LEFT JOIN public.match_participants mp ON mp.match_id = m.id AND mp.user_id = p.id
      LEFT JOIN public.nao_vou nv ON nv.match_id = m.id AND nv.user_id = p.id
    ), '[]'::jsonb)
  )
  FROM m;
$$;

REVOKE ALL ON FUNCTION public.enviar_lista(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.responder_lista(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lista_da_pelada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_lista(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_lista(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lista_da_pelada(uuid) TO authenticated;

-- anúncio da pelada nova da turma: além do sino, a lista cai no chat. Quem recebe o aviso do
-- chat no celular não recebe o "Nova pelada" também (fica só no sino, sem push duplicado).
CREATE OR REPLACE FUNCTION public.avisar_pelada_nova(p_match uuid)
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

  PERFORM public.postar_lista(m.id, m.organizador_id);

  -- o push vai pelo chat: marca o do sino como enviado (o envio só acontece depois do commit)
  UPDATE public.notificacoes n SET push_enviado_em = now()
  WHERE n.chave = 'nova:' || m.id AND n.push_enviado_em IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_da_turma_leitura l
      WHERE l.crew_id = m.crew_id AND l.user_id = n.user_id AND l.silenciado
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = n.user_id AND 'chat' = ANY (COALESCE(p.push_desligados, '{}'))
    );
END;
$$;

-- os cartões da lista se atualizam sozinhos quando alguém responde
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nao_vou;
