-- Ajustes depois do primeiro teste do chat:
--   1. uma lista de presença por vez no chat da turma (encerra a que está rolando antes de mandar
--      outra) e uma cobrança por vez por pelada; listas e cobranças podem ser encerradas;
--   2. a janela de avaliação passa a ser escolhida pela turma (padrão 2h).

-- 2. janela de avaliação da turma, em horas
ALTER TABLE public.crews
  ADD COLUMN janela_avaliacao_horas smallint NOT NULL DEFAULT 2
  CHECK (janela_avaliacao_horas BETWEEN 1 AND 48);

-- O fim da janela fica gravado na pelada (avaliacao_ate) quando ela é finalizada e quando o
-- placar é encerrado: o mais tarde dos dois, com as horas da turma. Roda depois de
-- matches_regras (que grava finalizada_em quando o organizador finaliza), por isso o nome com
-- "zz" e sem "UPDATE OF" (a coluna é preenchida por outro gatilho, não pelo UPDATE).
CREATE OR REPLACE FUNCTION public.janela_pelo_fim_do_placar()
RETURNS trigger
LANGUAGE plpgsql
-- roda também no UPDATE do próprio organizador (finalizar): precisa ler a turma e usar
-- janela_de_avaliacao, que o usuário comum não chama
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_janela interval;
BEGIN
  IF NEW.mvp_fechado_em IS NOT NULL
     OR (NEW.finalizada_em IS NULL AND NEW.placar_finalizado_em IS NULL)
     OR (NEW.finalizada_em IS NOT DISTINCT FROM OLD.finalizada_em
         AND NEW.placar_finalizado_em IS NOT DISTINCT FROM OLD.placar_finalizado_em) THEN
    RETURN NEW;
  END IF;
  SELECT make_interval(hours => c.janela_avaliacao_horas) INTO v_janela
  FROM public.crews c WHERE c.id = NEW.crew_id;
  v_janela := COALESCE(v_janela, public.janela_de_avaliacao());
  NEW.avaliacao_ate := GREATEST(NEW.finalizada_em + v_janela, NEW.placar_finalizado_em + v_janela);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_janela_pelo_placar ON public.matches;
CREATE TRIGGER matches_zz_janela_avaliacao
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.janela_pelo_fim_do_placar();

-- 1. a lista de presença que está rolando no chat da turma: não apagada, não encerrada e de
-- uma pelada que ainda não começou
CREATE OR REPLACE FUNCTION public.lista_ativa(p_crew_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT msg.id
  FROM public.mensagens_da_turma msg
  JOIN public.matches m ON m.id = msg.match_id
  WHERE msg.crew_id = p_crew_id AND msg.tipo = 'lista' AND msg.apagada_em IS NULL
    AND msg.dados->>'encerrada_em' IS NULL
    AND m.status = 'agendada'
    AND (m.data + m.horario) AT TIME ZONE 'America/Sao_Paulo' > now()
  ORDER BY msg.criado_em DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lista_ativa(uuid) FROM PUBLIC, anon, authenticated;

-- com lista rolando, a automática não entra (devolve nulo)
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
  IF v_crew IS NULL OR public.lista_ativa(v_crew) IS NOT NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id)
  VALUES (v_crew, p_autor, 'lista', p_match_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enviar_lista(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_ativa uuid;
  v_titulo text;
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
  v_ativa := public.lista_ativa(m.crew_id);
  IF v_ativa IS NOT NULL THEN
    SELECT mt.titulo INTO v_titulo
    FROM public.mensagens_da_turma msg JOIN public.matches mt ON mt.id = msg.match_id
    WHERE msg.id = v_ativa;
    RAISE EXCEPTION 'Já tem uma lista rolando no chat (%). Encerre ela antes de mandar outra.', v_titulo;
  END IF;
  v_id := public.postar_lista(p_match_id, auth.uid());
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Não deu pra mandar a lista.';
  END IF;
  RETURN v_id;
END;
$$;

-- só uma cobrança rolando por pelada
CREATE OR REPLACE FUNCTION public.enviar_cobranca(p_match_id uuid, p_valor integer, p_pix text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_pix text := NULLIF(btrim(COALESCE(p_pix, '')), '');
  v_id uuid;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF m.id IS NULL OR m.crew_id IS NULL THEN
    RAISE EXCEPTION 'Essa pelada não é de uma turma.';
  END IF;
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma cobra a pelada.';
  END IF;
  IF m.status <> 'finalizada' THEN
    RAISE EXCEPTION 'A cobrança vai depois que a pelada termina.';
  END IF;
  IF p_valor IS NULL OR p_valor < 100 OR p_valor > 100000 THEN
    RAISE EXCEPTION 'Valor por pessoa entre R$ 1,00 e R$ 1.000,00.';
  END IF;
  IF v_pix IS NOT NULL AND char_length(v_pix) > 140 THEN
    RAISE EXCEPTION 'Chave Pix grande demais.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quem_paga(p_match_id)) THEN
    RAISE EXCEPTION 'Ninguém jogou essa pelada pra cobrar.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mensagens_da_turma msg
    WHERE msg.match_id = p_match_id AND msg.tipo = 'pagamento' AND msg.apagada_em IS NULL
      AND msg.dados->>'encerrada_em' IS NULL
  ) THEN
    RAISE EXCEPTION 'Essa pelada já tem uma cobrança rolando no chat. Encerre ela antes de mandar outra.';
  END IF;
  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id, dados)
  VALUES (m.crew_id, auth.uid(), 'pagamento', p_match_id,
          jsonb_build_object('valor', p_valor, 'pix', v_pix))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- quem mandou ou um gestor encerra a lista ou a cobrança: o cartão fica no chat, sem botões
CREATE OR REPLACE FUNCTION public.encerrar_mensagem(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.mensagens_da_turma;
BEGIN
  SELECT * INTO v_msg FROM public.mensagens_da_turma WHERE id = p_id;
  IF v_msg.id IS NULL OR NOT public.membro_da_turma(v_msg.crew_id) OR v_msg.tipo = 'texto' THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;
  IF v_msg.autor_id IS DISTINCT FROM auth.uid() AND NOT public.gere_turma(v_msg.crew_id) THEN
    RAISE EXCEPTION 'Só quem mandou ou um administrador encerra.';
  END IF;
  UPDATE public.mensagens_da_turma
  SET dados = COALESCE(dados, '{}'::jsonb) || jsonb_build_object('encerrada_em', now())
  WHERE id = p_id AND apagada_em IS NULL AND dados->>'encerrada_em' IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.encerrar_mensagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_mensagem(uuid) TO authenticated;

-- a lista automática pode não entrar (já tinha uma rolando): aí o "Nova pelada" vai com push
CREATE OR REPLACE FUNCTION public.avisar_pelada_nova(p_match uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_turma TEXT;
  v_lista uuid;
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

  v_lista := public.postar_lista(m.id, m.organizador_id);
  IF v_lista IS NULL THEN
    RETURN;
  END IF;

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
