-- Corrigir o placar de uma pelada já encerrada:
--   1. não empurra mais a janela de avaliação (a hora do "placar encerrado" fica a da primeira vez;
--      antes cada correção regravava now() e a janela ganhava mais 2 horas);
--   2. atualiza a mensagem da rodada da liga no chat com o líder de depois da correção (antes ela
--      ficava com o líder do primeiro encerramento).
-- Também: com empate no topo, a rodada mostra o primeiro da tabela (mesma ordem da tela).

CREATE OR REPLACE FUNCTION public.salvar_placar(p_match_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogo JSONB;
  v_game_id UUID;
BEGIN
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma salva o placar.';
  END IF;

  -- gols e lances vão embora junto com os jogos
  DELETE FROM public.games WHERE match_id = p_match_id;

  FOR v_jogo IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'jogos', '[]'::jsonb)) LOOP
    INSERT INTO public.games (match_id, ordem, time_a, time_b, gols_a, gols_b, vencedor, duracao_seg,
                              penaltis_a, penaltis_b, penaltis_na_artilharia)
    VALUES (
      p_match_id,
      (v_jogo->>'ordem')::smallint,
      (v_jogo->>'time_a')::smallint,
      (v_jogo->>'time_b')::smallint,
      (v_jogo->>'gols_a')::smallint,
      (v_jogo->>'gols_b')::smallint,
      (v_jogo->>'vencedor')::smallint,
      COALESCE((v_jogo->>'duracao_seg')::integer, 0),
      (v_jogo->>'penaltis_a')::smallint,
      (v_jogo->>'penaltis_b')::smallint,
      COALESCE((v_jogo->>'penaltis_na_artilharia')::boolean, true)
    )
    RETURNING id INTO v_game_id;

    INSERT INTO public.game_players (game_id, member_id, time)
    SELECT v_game_id, (e->>'member_id')::uuid, (e->>'time')::smallint
    FROM jsonb_array_elements(COALESCE(v_jogo->'escalacao', '[]'::jsonb)) e
    JOIN public.match_players mp ON mp.match_id = p_match_id AND mp.member_id = (e->>'member_id')::uuid;

    INSERT INTO public.goals (game_id, member_id, time, tempo, minuto, penalti)
    SELECT
      v_game_id,
      (SELECT mp.member_id FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.member_id = (g->>'member_id')::uuid),
      (g->>'time')::smallint,
      COALESCE((g->>'tempo')::smallint, 1),
      COALESCE((g->>'minuto')::smallint, 0),
      COALESCE((g->>'penalti')::boolean, false)
    FROM jsonb_array_elements(COALESCE(v_jogo->'gols', '[]'::jsonb)) g;

    -- lance de quem não está no elenco do dia, ou de tipo desconhecido, é ignorado
    INSERT INTO public.game_events (game_id, member_id, time, tipo, tempo, minuto)
    SELECT
      v_game_id, mp.member_id, (l->>'time')::smallint, l->>'tipo',
      COALESCE((l->>'tempo')::smallint, 1),
      COALESCE((l->>'minuto')::smallint, 0)
    FROM jsonb_array_elements(COALESCE(v_jogo->'lances', '[]'::jsonb)) l
    JOIN public.match_players mp ON mp.match_id = p_match_id AND mp.member_id = (l->>'member_id')::uuid
    WHERE l->>'tipo' IN ('assistencia', 'defesa', 'amarelo', 'azul', 'vermelho');
  END LOOP;

  UPDATE public.match_players mp
  SET gols = 0, jogos = 0, vitorias = 0, empates = 0, derrotas = 0,
      assistencias = 0, defesas = 0, amarelos = 0, azuis = 0, vermelhos = 0
  WHERE mp.match_id = p_match_id;

  UPDATE public.match_players mp
  SET gols = COALESCE((j->>'gols')::integer, 0),
      jogos = COALESCE((j->>'jogos')::integer, 0),
      vitorias = COALESCE((j->>'vitorias')::integer, 0),
      empates = COALESCE((j->>'empates')::integer, 0),
      derrotas = COALESCE((j->>'derrotas')::integer, 0),
      assistencias = COALESCE((j->>'assistencias')::integer, 0),
      defesas = COALESCE((j->>'defesas')::integer, 0),
      amarelos = COALESCE((j->>'amarelos')::integer, 0),
      azuis = COALESCE((j->>'azuis')::integer, 0),
      vermelhos = COALESCE((j->>'vermelhos')::integer, 0)
  FROM jsonb_array_elements(COALESCE(p_payload->'jogadores', '[]'::jsonb)) j
  WHERE mp.match_id = p_match_id AND mp.member_id = (j->>'member_id')::uuid;

  -- corrigir não reabre nem estica a janela de avaliação: a hora do encerramento fica a primeira
  UPDATE public.matches
  SET status = 'finalizada',
      finalizada_em = COALESCE(finalizada_em, now()),
      placar_finalizado_em = COALESCE(placar_finalizado_em, now())
  WHERE id = p_match_id;

  -- se a pelada já tinha posto a rodada da liga no chat, ela passa a mostrar a tabela corrigida
  PERFORM public.atualizar_rodada_da_liga(p_match_id);
END;
$$;

-- o líder (e os pontos) da mensagem de rodada da liga, de novo, a partir da tabela de agora
CREATE OR REPLACE FUNCTION public.atualizar_rodada_da_liga(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg record;
  v_lider record;
BEGIN
  FOR msg IN
    SELECT mt.id, (mt.dados->>'liga_id')::uuid AS liga_id
    FROM public.mensagens_da_turma mt
    JOIN public.ligas l ON l.id = (mt.dados->>'liga_id')::uuid
    WHERE mt.match_id = p_match_id AND mt.tipo = 'liga' AND mt.dados->>'evento' = 'rodada'
      AND l.encerrada_em IS NULL
  LOOP
    SELECT t.nome, t.pontos INTO v_lider
    FROM public.tabela_da_liga(msg.liga_id) t LIMIT 1;
    UPDATE public.mensagens_da_turma
    SET dados = dados || jsonb_build_object('lider', v_lider.nome, 'pontos', v_lider.pontos)
    WHERE id = msg.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.atualizar_rodada_da_liga(uuid) FROM PUBLIC, anon, authenticated;

-- empate no topo: o líder é o primeiro da tabela (a função já devolve na ordem da tela)
CREATE OR REPLACE FUNCTION public.liga_rodada_no_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ligas;
  v_rodada int;
  v_lider record;
BEGIN
  IF NEW.placar_finalizado_em IS NULL OR OLD.placar_finalizado_em IS NOT NULL
     OR NEW.crew_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.ligas
  WHERE crew_id = NEW.crew_id AND encerrada_em IS NULL AND NEW.data BETWEEN inicio AND fim
  LIMIT 1;
  IF l.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_rodada FROM public.matches m
  WHERE m.crew_id = l.crew_id AND m.placar_finalizado_em IS NOT NULL
    AND m.data BETWEEN l.inicio AND l.fim;
  SELECT t.nome, t.pontos INTO v_lider FROM public.tabela_da_liga(l.id) t LIMIT 1;

  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id, dados)
  VALUES (l.crew_id, NULL, 'liga', NEW.id,
          jsonb_build_object('evento', 'rodada', 'liga_id', l.id, 'liga', l.nome,
                             'rodada', v_rodada, 'lider', v_lider.nome, 'pontos', v_lider.pontos));
  RETURN NULL;
END;
$$;

-- a mensagem de ontem (Liga de Fim de Ano, rodada 1) passa a mostrar o líder da tabela corrigida
SELECT public.atualizar_rodada_da_liga(m.id)
FROM public.matches m
WHERE EXISTS (SELECT 1 FROM public.mensagens_da_turma mt WHERE mt.match_id = m.id AND mt.tipo = 'liga');
