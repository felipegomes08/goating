-- Turmas (pelada fixa), times do dia, placar ao vivo e estatísticas por turma.
--
-- Tudo aditivo: pelada sem turma e sem placar continua funcionando igual.
--
-- crews          a turma (o futebol fixo). Estatística é sempre por turma.
-- crew_members   jogador da turma. user_id nulo = jogador sem conta (só o nome),
--                criado pelo dono; dá pra vincular a uma conta depois sem perder histórico.
-- match_players  quem jogou naquele dia, em qual time, e o saldo do dia
--                (gols / jogos / vitórias / empates / derrotas).
-- games          cada jogo dentro do dia (no rachão são vários).
-- game_players   escalação de cada jogo — vitória individual sai daqui.
-- goals          cada gol.

-- TURMAS
CREATE TABLE public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dono_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX crews_dono_idx ON public.crews (dono_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crews TO authenticated;
GRANT ALL ON public.crews TO service_role;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crews_select_auth" ON public.crews FOR SELECT TO authenticated USING (true);
CREATE POLICY "crews_insert_own" ON public.crews FOR INSERT TO authenticated WITH CHECK (auth.uid() = dono_id);
CREATE POLICY "crews_update_own" ON public.crews FOR UPDATE TO authenticated USING (auth.uid() = dono_id) WITH CHECK (auth.uid() = dono_id);
CREATE POLICY "crews_delete_own" ON public.crews FOR DELETE TO authenticated USING (auth.uid() = dono_id);

-- MEMBROS DA TURMA
CREATE TABLE public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  posicao TEXT,
  estrelas SMALLINT CHECK (estrelas BETWEEN 1 AND 5),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crew_id, user_id)
);
CREATE INDEX crew_members_user_idx ON public.crew_members (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_members TO authenticated;
GRANT ALL ON public.crew_members TO service_role;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_members_select_auth" ON public.crew_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew_members_manage_owner" ON public.crew_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crews c WHERE c.id = crew_id AND c.dono_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crews c WHERE c.id = crew_id AND c.dono_id = auth.uid()));

-- CONFIGURAÇÃO DE JOGO NA PELADA
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS num_times SMALLINT NOT NULL DEFAULT 2 CHECK (num_times BETWEEN 2 AND 6),
  ADD COLUMN IF NOT EXISTS nomes_times TEXT[],
  ADD COLUMN IF NOT EXISTS tempos SMALLINT NOT NULL DEFAULT 2 CHECK (tempos BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS minutos_tempo SMALLINT NOT NULL DEFAULT 30 CHECK (minutos_tempo BETWEEN 1 AND 90),
  -- nulo = sem limite de gols (jogo só acaba no tempo)
  ADD COLUMN IF NOT EXISTS gols_limite SMALLINT CHECK (gols_limite BETWEEN 1 AND 20),
  -- por_jogo: cada jogo ganho no dia vale 1 vitória. por_dia: só o time campeão do dia leva 1 vitória.
  ADD COLUMN IF NOT EXISTS contagem_vitoria TEXT NOT NULL DEFAULT 'por_jogo' CHECK (contagem_vitoria IN ('por_jogo', 'por_dia')),
  -- rascunho do placar em andamento (pra recuperar se trocar de aparelho)
  ADD COLUMN IF NOT EXISTS placar_estado JSONB,
  ADD COLUMN IF NOT EXISTS placar_finalizado_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS matches_crew_idx ON public.matches (crew_id, data);

-- JOGADORES DO DIA
CREATE TABLE public.match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  -- índice do time no dia (0 = primeiro time). Nulo = ainda sem time.
  time SMALLINT,
  gols INTEGER NOT NULL DEFAULT 0,
  jogos INTEGER NOT NULL DEFAULT 0,
  vitorias INTEGER NOT NULL DEFAULT 0,
  empates INTEGER NOT NULL DEFAULT 0,
  derrotas INTEGER NOT NULL DEFAULT 0,
  UNIQUE (match_id, member_id)
);
CREATE INDEX match_players_member_idx ON public.match_players (member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_players TO authenticated;
GRANT ALL ON public.match_players TO service_role;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_players_select_auth" ON public.match_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_players_manage_owner" ON public.match_players FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()));

-- JOGOS, ESCALAÇÕES E GOLS: leitura pra todo mundo logado, escrita só pela função salvar_placar.
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  ordem SMALLINT NOT NULL,
  time_a SMALLINT NOT NULL,
  time_b SMALLINT NOT NULL,
  gols_a SMALLINT NOT NULL DEFAULT 0,
  gols_b SMALLINT NOT NULL DEFAULT 0,
  -- índice do time vencedor; nulo = empate
  vencedor SMALLINT,
  duracao_seg INTEGER NOT NULL DEFAULT 0,
  UNIQUE (match_id, ordem)
);
GRANT SELECT ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_select_auth" ON public.games FOR SELECT TO authenticated USING (true);

CREATE TABLE public.game_players (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  time SMALLINT NOT NULL,
  PRIMARY KEY (game_id, member_id)
);
GRANT SELECT ON public.game_players TO authenticated;
GRANT ALL ON public.game_players TO service_role;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_players_select_auth" ON public.game_players FOR SELECT TO authenticated USING (true);

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  -- nulo = gol sem autor / contra
  member_id UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  time SMALLINT NOT NULL,
  tempo SMALLINT NOT NULL DEFAULT 1,
  minuto SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX goals_game_idx ON public.goals (game_id);
CREATE INDEX goals_member_idx ON public.goals (member_id);
GRANT SELECT ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_select_auth" ON public.goals FOR SELECT TO authenticated USING (true);

-- Grava o placar do dia inteiro de uma vez (jogos, escalações, gols e saldo de cada jogador)
-- e finaliza a pelada. Pode ser chamada de novo pra corrigir: apaga e regrava.
CREATE OR REPLACE FUNCTION public.salvar_placar(p_match_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jogo JSONB;
  v_game_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.matches m WHERE m.id = p_match_id AND m.organizador_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Só o organizador pode salvar o placar.';
  END IF;

  DELETE FROM public.games WHERE match_id = p_match_id;

  FOR v_jogo IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'jogos', '[]'::jsonb)) LOOP
    INSERT INTO public.games (match_id, ordem, time_a, time_b, gols_a, gols_b, vencedor, duracao_seg)
    VALUES (
      p_match_id,
      (v_jogo->>'ordem')::smallint,
      (v_jogo->>'time_a')::smallint,
      (v_jogo->>'time_b')::smallint,
      (v_jogo->>'gols_a')::smallint,
      (v_jogo->>'gols_b')::smallint,
      (v_jogo->>'vencedor')::smallint,
      COALESCE((v_jogo->>'duracao_seg')::integer, 0)
    )
    RETURNING id INTO v_game_id;

    INSERT INTO public.game_players (game_id, member_id, time)
    SELECT v_game_id, (e->>'member_id')::uuid, (e->>'time')::smallint
    FROM jsonb_array_elements(COALESCE(v_jogo->'escalacao', '[]'::jsonb)) e
    JOIN public.match_players mp ON mp.match_id = p_match_id AND mp.member_id = (e->>'member_id')::uuid;

    INSERT INTO public.goals (game_id, member_id, time, tempo, minuto)
    SELECT
      v_game_id,
      (SELECT mp.member_id FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.member_id = (g->>'member_id')::uuid),
      (g->>'time')::smallint,
      COALESCE((g->>'tempo')::smallint, 1),
      COALESCE((g->>'minuto')::smallint, 0)
    FROM jsonb_array_elements(COALESCE(v_jogo->'gols', '[]'::jsonb)) g;
  END LOOP;

  UPDATE public.match_players mp
  SET gols = 0, jogos = 0, vitorias = 0, empates = 0, derrotas = 0
  WHERE mp.match_id = p_match_id;

  UPDATE public.match_players mp
  SET gols = COALESCE((j->>'gols')::integer, 0),
      jogos = COALESCE((j->>'jogos')::integer, 0),
      vitorias = COALESCE((j->>'vitorias')::integer, 0),
      empates = COALESCE((j->>'empates')::integer, 0),
      derrotas = COALESCE((j->>'derrotas')::integer, 0)
  FROM jsonb_array_elements(COALESCE(p_payload->'jogadores', '[]'::jsonb)) j
  WHERE mp.match_id = p_match_id AND mp.member_id = (j->>'member_id')::uuid;

  UPDATE public.matches
  SET status = 'finalizada',
      finalizada_em = COALESCE(finalizada_em, now()),
      placar_finalizado_em = now()
  WHERE id = p_match_id;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_placar(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_placar(UUID, JSONB) TO authenticated;

-- Ranking da turma num período (datas inclusivas; nulo = sem limite).
CREATE OR REPLACE FUNCTION public.crew_stats(p_crew_id UUID, p_desde DATE DEFAULT NULL, p_ate DATE DEFAULT NULL)
RETURNS TABLE (
  member_id UUID,
  user_id UUID,
  nome TEXT,
  foto_url TEXT,
  peladas BIGINT,
  jogos BIGINT,
  gols BIGINT,
  vitorias BIGINT,
  empates BIGINT,
  derrotas BIGINT
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    cm.id,
    cm.user_id,
    cm.nome,
    p.foto_url,
    count(*),
    COALESCE(sum(mp.jogos), 0),
    COALESCE(sum(mp.gols), 0),
    COALESCE(sum(mp.vitorias), 0),
    COALESCE(sum(mp.empates), 0),
    COALESCE(sum(mp.derrotas), 0)
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.crew_members cm ON cm.id = mp.member_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE m.crew_id = p_crew_id
    AND m.placar_finalizado_em IS NOT NULL
    AND mp.jogos > 0
    AND (p_desde IS NULL OR m.data >= p_desde)
    AND (p_ate IS NULL OR m.data <= p_ate)
  GROUP BY cm.id, cm.user_id, cm.nome, p.foto_url;
$$;
REVOKE ALL ON FUNCTION public.crew_stats(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_stats(UUID, DATE, DATE) TO authenticated;
