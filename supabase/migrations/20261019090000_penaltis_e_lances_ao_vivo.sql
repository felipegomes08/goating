-- Disputa de pênaltis e lances do ao vivo (assistência, defesa épica e cartões).
--
-- Tudo que chega novo no placar é opcional: o site antigo continua salvando do jeito dele.

-- 1. PÊNALTIS. O placar do jogo continua sendo o do tempo normal; a disputa tem o placar
--    dela. Cada turma decide se gol de pênalti da disputa conta na artilharia.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS penaltis_a SMALLINT,
  ADD COLUMN IF NOT EXISTS penaltis_b SMALLINT,
  ADD COLUMN IF NOT EXISTS penaltis_na_artilharia BOOLEAN NOT NULL DEFAULT true;
-- gol marcado na disputa (não entra em gols_a / gols_b)
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS penalti BOOLEAN NOT NULL DEFAULT false;

-- 2. LANCES. Um registro por assistência, defesa épica ou cartão.
CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  time SMALLINT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('assistencia', 'defesa', 'amarelo', 'azul', 'vermelho')),
  tempo SMALLINT NOT NULL DEFAULT 1,
  minuto SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS game_events_game_idx ON public.game_events (game_id);
CREATE INDEX IF NOT EXISTS game_events_member_idx ON public.game_events (member_id);
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
-- leitura igual à dos gols; gravar, só pela função salvar_placar
REVOKE ALL ON public.game_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_events TO authenticated;
GRANT ALL ON public.game_events TO service_role;
DROP POLICY IF EXISTS game_events_select_auth ON public.game_events;
CREATE POLICY game_events_select_auth ON public.game_events FOR SELECT TO authenticated USING (true);

-- totais do dia de cada jogador, do lado dos gols e das vitórias
ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS assistencias INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defesas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amarelos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS azuis INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vermelhos INTEGER NOT NULL DEFAULT 0;

-- 3. SALVAR O PLACAR
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

  UPDATE public.matches
  SET status = 'finalizada',
      finalizada_em = COALESCE(finalizada_em, now()),
      placar_finalizado_em = now()
  WHERE id = p_match_id;
END;
$$;

-- 4. RANKING DA TURMA: os totais novos por jogador. Muda o formato da resposta, então a
--    função é recriada (o site antigo ignora as colunas a mais).
DROP FUNCTION IF EXISTS public.crew_stats(uuid, date, date);
CREATE FUNCTION public.crew_stats(p_crew_id uuid, p_desde date DEFAULT NULL, p_ate date DEFAULT NULL)
RETURNS TABLE (
  member_id uuid, user_id uuid, nome text, foto_url text, peladas bigint, jogos bigint,
  gols bigint, vitorias bigint, empates bigint, derrotas bigint,
  assistencias bigint, defesas bigint, amarelos bigint, azuis bigint, vermelhos bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
    COALESCE(sum(mp.derrotas), 0),
    COALESCE(sum(mp.assistencias), 0),
    COALESCE(sum(mp.defesas), 0),
    COALESCE(sum(mp.amarelos), 0),
    COALESCE(sum(mp.azuis), 0),
    COALESCE(sum(mp.vermelhos), 0)
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.crew_members cm ON cm.id = mp.member_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE m.crew_id = p_crew_id
    AND m.placar_finalizado_em IS NOT NULL
    AND mp.jogos > 0
    AND cm.removido_em IS NULL
    AND (p_desde IS NULL OR m.data >= p_desde)
    AND (p_ate IS NULL OR m.data <= p_ate)
  GROUP BY cm.id, cm.user_id, cm.nome, p.foto_url;
$$;
REVOKE ALL ON FUNCTION public.crew_stats(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_stats(uuid, date, date) TO authenticated;

-- 5. VINCULAR E JUNTAR JOGADORES: os lances acompanham o histórico, como os gols.
CREATE OR REPLACE FUNCTION public.vincular_membro(p_member_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew UUID;
  v_destino UUID;
BEGIN
  SELECT cm.crew_id INTO v_crew
  FROM public.crew_members cm
  WHERE cm.id = p_member_id AND cm.user_id IS NULL AND public.gere_turma(cm.crew_id);
  IF v_crew IS NULL THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma vincula jogadores sem conta.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RAISE EXCEPTION 'Conta não encontrada.';
  END IF;

  SELECT cm.id INTO v_destino FROM public.crew_members cm WHERE cm.crew_id = v_crew AND cm.user_id = p_user_id;
  IF v_destino IS NULL THEN
    UPDATE public.crew_members SET user_id = p_user_id WHERE id = p_member_id;
    RETURN p_member_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players a
    JOIN public.match_players b ON b.match_id = a.match_id
    WHERE a.member_id = p_member_id AND b.member_id = v_destino
  ) THEN
    RAISE EXCEPTION 'Os dois aparecem na mesma pelada: não são a mesma pessoa.';
  END IF;

  UPDATE public.match_players SET member_id = v_destino WHERE member_id = p_member_id;
  UPDATE public.game_players SET member_id = v_destino WHERE member_id = p_member_id;
  UPDATE public.goals SET member_id = v_destino WHERE member_id = p_member_id;
  UPDATE public.game_events SET member_id = v_destino WHERE member_id = p_member_id;
  UPDATE public.crew_members d
  SET posicao = COALESCE(d.posicao, o.posicao), estrelas = COALESCE(d.estrelas, o.estrelas)
  FROM public.crew_members o
  WHERE d.id = v_destino AND o.id = p_member_id;
  DELETE FROM public.crew_members WHERE id = p_member_id;
  RETURN v_destino;
END;
$$;

CREATE OR REPLACE FUNCTION public.juntar_membros(p_origem UUID, p_destino UUID)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew UUID;
BEGIN
  IF p_origem = p_destino THEN
    RAISE EXCEPTION 'Escolha outro jogador pra juntar.';
  END IF;

  SELECT cm.crew_id INTO v_crew
  FROM public.crew_members cm
  WHERE cm.id = p_origem AND cm.user_id IS NULL AND public.gere_turma(cm.crew_id);
  IF v_crew IS NULL THEN
    RAISE EXCEPTION 'Só o dono ou um administrador junta jogadores, e o que some precisa ser um jogador sem conta.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crew_members cm WHERE cm.id = p_destino AND cm.crew_id = v_crew) THEN
    RAISE EXCEPTION 'Os dois jogadores precisam ser da mesma turma.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players a
    JOIN public.match_players b ON b.match_id = a.match_id
    WHERE a.member_id = p_origem AND b.member_id = p_destino
  ) THEN
    RAISE EXCEPTION 'Os dois aparecem na mesma pelada: não são a mesma pessoa.';
  END IF;

  UPDATE public.match_players SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.game_players SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.goals SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.game_events SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.crew_members d
  SET posicao = COALESCE(d.posicao, o.posicao),
      estrelas = COALESCE(d.estrelas, o.estrelas),
      removido_em = NULL
  FROM public.crew_members o
  WHERE d.id = p_destino AND o.id = p_origem;
  DELETE FROM public.crew_members WHERE id = p_origem;
  RETURN p_destino;
END;
$$;
