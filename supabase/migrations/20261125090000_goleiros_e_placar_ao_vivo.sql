-- Goleiros e placar ao vivo.
--
-- 1. GOLEIROS: cada jogo guarda o goleiro de cada lado (nulo = revezamento / sem goleiro).
--    Gols sofridos = gols do outro lado no jogo em que ele estava no gol.
--    O histórico é preenchido pelo jogador de posição GOL do lado (só quando há exatamente um).
-- 2. PLACAR AO VIVO: um marcador por pelada (dois celulares marcando se apagavam), a hora da
--    última mudança do placar e uma leitura só com o que a tela ao vivo precisa.

-- ===================================================================== 1. GOLEIROS

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS goleiro_a uuid REFERENCES public.crew_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goleiro_b uuid REFERENCES public.crew_members(id) ON DELETE SET NULL;

-- salvar_placar: igual à anterior (20261113090000) + goleiro de cada lado
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

    -- goleiro só vale se estava escalado naquele lado
    UPDATE public.games g
    SET goleiro_a = (SELECT gp.member_id FROM public.game_players gp
                     WHERE gp.game_id = g.id AND gp.time = g.time_a
                       AND gp.member_id::text = v_jogo->>'goleiro_a'),
        goleiro_b = (SELECT gp.member_id FROM public.game_players gp
                     WHERE gp.game_id = g.id AND gp.time = g.time_b
                       AND gp.member_id::text = v_jogo->>'goleiro_b')
    WHERE g.id = v_game_id;

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

-- tabela dos goleiros da turma no período (mesmos filtros da crew_stats)
CREATE OR REPLACE FUNCTION public.crew_goleiros(p_crew_id uuid, p_desde date DEFAULT NULL, p_ate date DEFAULT NULL)
RETURNS TABLE (
  member_id uuid, user_id uuid, nome text, foto_url text,
  peladas bigint, jogos bigint, sofridos bigint, peladas_no_periodo bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH peladas AS (
    SELECT m.id
    FROM public.matches m
    WHERE m.crew_id = p_crew_id
      AND m.placar_finalizado_em IS NOT NULL
      AND (p_desde IS NULL OR m.data >= p_desde)
      AND (p_ate IS NULL OR m.data <= p_ate)
  ),
  atuacoes AS (
    SELECT g.match_id, g.goleiro_a AS member_id, g.gols_b AS sofridos
    FROM public.games g JOIN peladas p ON p.id = g.match_id
    WHERE g.goleiro_a IS NOT NULL
    UNION ALL
    SELECT g.match_id, g.goleiro_b, g.gols_a
    FROM public.games g JOIN peladas p ON p.id = g.match_id
    WHERE g.goleiro_b IS NOT NULL
  )
  SELECT
    cm.id, cm.user_id, cm.nome, pr.foto_url,
    count(DISTINCT a.match_id),
    count(*),
    COALESCE(sum(a.sofridos), 0),
    (SELECT count(*) FROM peladas)
  FROM atuacoes a
  JOIN public.crew_members cm ON cm.id = a.member_id
  LEFT JOIN public.profiles pr ON pr.id = cm.user_id
  WHERE cm.removido_em IS NULL
  GROUP BY cm.id, cm.user_id, cm.nome, pr.foto_url;
$$;
REVOKE ALL ON FUNCTION public.crew_goleiros(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_goleiros(uuid, date, date) TO authenticated;

-- histórico: o lado com exatamente um jogador de posição GOL ganha ele como goleiro
UPDATE public.games g
SET goleiro_a = COALESCE(g.goleiro_a, (
      SELECT (min(gp.member_id::text))::uuid
      FROM public.game_players gp JOIN public.crew_members cm ON cm.id = gp.member_id
      WHERE gp.game_id = g.id AND gp.time = g.time_a AND cm.posicao = 'GOL'
      HAVING count(*) = 1)),
    goleiro_b = COALESCE(g.goleiro_b, (
      SELECT (min(gp.member_id::text))::uuid
      FROM public.game_players gp JOIN public.crew_members cm ON cm.id = gp.member_id
      WHERE gp.game_id = g.id AND gp.time = g.time_b AND cm.posicao = 'GOL'
      HAVING count(*) = 1));

-- e o mesmo no placar guardado, pra uma correção futura do placar não apagar o goleiro
UPDATE public.matches m
SET placar_estado = jsonb_set(m.placar_estado, '{jogos}', (
  SELECT jsonb_agg(
    CASE WHEN j ? 'goleiros' THEN j
    ELSE j || jsonb_build_object('goleiros', jsonb_build_array(
      (SELECT CASE WHEN count(*) = 1 THEN to_jsonb(min(cm.id::text)) ELSE 'null'::jsonb END
       FROM jsonb_array_elements_text(j->'lados'->0) x
       JOIN public.crew_members cm ON cm.id::text = x AND cm.posicao = 'GOL'),
      (SELECT CASE WHEN count(*) = 1 THEN to_jsonb(min(cm.id::text)) ELSE 'null'::jsonb END
       FROM jsonb_array_elements_text(j->'lados'->1) x
       JOIN public.crew_members cm ON cm.id::text = x AND cm.posicao = 'GOL')))
    END ORDER BY ord)
  FROM jsonb_array_elements(m.placar_estado->'jogos') WITH ORDINALITY AS t(j, ord)))
WHERE m.placar_finalizado_em IS NOT NULL
  AND jsonb_typeof(m.placar_estado->'jogos') = 'array'
  AND jsonb_array_length(m.placar_estado->'jogos') > 0;

-- ===================================================================== 2. PLACAR AO VIVO

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS placar_marcador uuid,
  ADD COLUMN IF NOT EXISTS placar_marcador_desde timestamptz,
  ADD COLUMN IF NOT EXISTS placar_atualizado_em timestamptz;

-- hora da última mudança do placar ("atualizado há X s" na tela ao vivo)
CREATE OR REPLACE FUNCTION public.marca_placar_atualizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.placar_estado IS DISTINCT FROM OLD.placar_estado THEN
    NEW.placar_atualizado_em := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS matches_placar_atualizado ON public.matches;
CREATE TRIGGER matches_placar_atualizado BEFORE UPDATE OF placar_estado ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.marca_placar_atualizado();

-- vira o marcador do placar. p_so_se_livre: só pega se ninguém (ou eu mesmo) estiver marcando.
-- Devolve quem ficou marcando.
CREATE OR REPLACE FUNCTION public.assumir_placar(p_match_id uuid, p_so_se_livre boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marcador uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma marca o placar.';
  END IF;
  UPDATE public.matches
  SET placar_marcador = auth.uid(), placar_marcador_desde = now()
  WHERE id = p_match_id
    AND (NOT p_so_se_livre OR placar_marcador IS NULL OR placar_marcador = auth.uid());
  SELECT placar_marcador INTO v_marcador FROM public.matches WHERE id = p_match_id;
  RETURN v_marcador;
END;
$$;
REVOKE ALL ON FUNCTION public.assumir_placar(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assumir_placar(uuid, boolean) TO authenticated;

-- o que a tela ao vivo mostra: placar, relógio, lances e nomes. Sem dado pessoal além de nome e foto.
CREATE OR REPLACE FUNCTION public.placar_ao_vivo(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', m.id,
    'titulo', m.titulo,
    'status', m.status,
    'data', m.data,
    'horario', m.horario,
    'nomes_times', to_jsonb(m.nomes_times),
    'cores_times', to_jsonb(m.cores_times),
    'minutos_tempo', m.minutos_tempo,
    'tempos', m.tempos,
    'estado', m.placar_estado,
    'atualizado_em', m.placar_atualizado_em,
    'agora', now(),
    'marcador', (SELECT pr.nome_exibicao FROM public.profiles pr WHERE pr.id = m.placar_marcador),
    'jogadores', COALESCE((
      SELECT jsonb_object_agg(cm.id, jsonb_build_object('nome', cm.nome, 'foto', pr.foto_url))
      FROM public.crew_members cm
      LEFT JOIN public.profiles pr ON pr.id = cm.user_id
      WHERE cm.id IN (
        SELECT x::uuid
        FROM jsonb_array_elements(COALESCE(m.placar_estado->'jogos', '[]'::jsonb)) jg,
             jsonb_array_elements(COALESCE(jg->'lados', '[]'::jsonb)) l,
             jsonb_array_elements_text(l) x
      )), '{}'::jsonb)
  )
  FROM public.matches m
  WHERE m.id = p_match_id;
$$;
REVOKE ALL ON FUNCTION public.placar_ao_vivo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.placar_ao_vivo(uuid) TO authenticated;

-- a tela ao vivo e o card escutam a mudança da pelada (o SELECT de matches já é aberto pra quem entra)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END $$;
