-- Administradores da turma: jogadores (com conta) que o dono autoriza a tocar a pelada
-- quando ele não vai — montar times, marcar o placar, finalizar, criar pelada da turma
-- e cuidar da lista de jogadores.
--
-- Só o dono nomeia e tira admin, e só o dono apaga ou renomeia a turma.

ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT false;

-- Dono ou admin da turma. SECURITY DEFINER porque é usada dentro das políticas de
-- crew_members (consultar a própria tabela pela política daria recursão).
CREATE OR REPLACE FUNCTION public.gere_turma(p_crew_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.crews c WHERE c.id = p_crew_id AND c.dono_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.crew_members cm
        WHERE cm.crew_id = p_crew_id AND cm.user_id = auth.uid() AND cm.admin
      );
$$;
REVOKE ALL ON FUNCTION public.gere_turma(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gere_turma(UUID) TO authenticated;

-- Organizador da pelada, ou dono/admin da turma dela.
CREATE OR REPLACE FUNCTION public.gere_pelada(p_match_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id
      AND (m.organizador_id = auth.uid() OR (m.crew_id IS NOT NULL AND public.gere_turma(m.crew_id)))
  );
$$;
REVOKE ALL ON FUNCTION public.gere_pelada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gere_pelada(UUID) TO authenticated;

-- JOGADORES DA TURMA: dono e admins gerenciam. A coluna "admin" fica fora do alcance
-- direto de todo mundo (só pela função definir_admin).
DROP POLICY IF EXISTS "crew_members_manage_owner" ON public.crew_members;
CREATE POLICY "crew_members_manage_gestores" ON public.crew_members FOR ALL TO authenticated
  USING (public.gere_turma(crew_id))
  WITH CHECK (public.gere_turma(crew_id));
REVOKE INSERT, UPDATE ON public.crew_members FROM authenticated;
GRANT INSERT (crew_id, user_id, nome, posicao, estrelas) ON public.crew_members TO authenticated;
GRANT UPDATE (nome, posicao, estrelas) ON public.crew_members TO authenticated;

-- PELADAS: admin da turma também edita a pelada (config de jogo, status, rascunho do placar).
-- E pelada só entra numa turma se quem cria gere essa turma (antes qualquer um conseguia
-- pendurar uma pelada na turma dos outros e sujar o ranking).
DROP POLICY IF EXISTS "matches_update_owner" ON public.matches;
CREATE POLICY "matches_update_gestores" ON public.matches FOR UPDATE TO authenticated
  USING (auth.uid() = organizador_id OR (crew_id IS NOT NULL AND public.gere_turma(crew_id)))
  WITH CHECK (
    (auth.uid() = organizador_id OR (crew_id IS NOT NULL AND public.gere_turma(crew_id)))
    AND (crew_id IS NULL OR public.gere_turma(crew_id))
  );
DROP POLICY IF EXISTS "matches_insert_own" ON public.matches;
CREATE POLICY "matches_insert_own" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizador_id AND (crew_id IS NULL OR public.gere_turma(crew_id)));

-- ELENCO DO DIA
DROP POLICY IF EXISTS "match_players_manage_owner" ON public.match_players;
CREATE POLICY "match_players_manage_gestores" ON public.match_players FOR ALL TO authenticated
  USING (public.gere_pelada(match_id))
  WITH CHECK (public.gere_pelada(match_id));

-- Dono nomeia ou tira um admin. Só quem tem conta pode ser admin.
CREATE OR REPLACE FUNCTION public.definir_admin(p_member_id UUID, p_admin BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.crew_members cm SET admin = p_admin
  FROM public.crews c
  WHERE cm.id = p_member_id AND c.id = cm.crew_id AND c.dono_id = auth.uid()
    AND cm.user_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só o dono da turma escolhe os administradores, e só entre quem tem conta.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.definir_admin(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_admin(UUID, BOOLEAN) TO authenticated;

-- Saiu da turma, deixa de ser admin.
CREATE OR REPLACE FUNCTION public.sair_da_turma(p_crew_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.crew_members cm SET user_id = NULL, admin = false
  WHERE cm.crew_id = p_crew_id AND cm.user_id = auth.uid();
$$;

-- Placar: quem gere a pelada salva (antes só o organizador).
CREATE OR REPLACE FUNCTION public.salvar_placar(p_match_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jogo JSONB;
  v_game_id UUID;
BEGIN
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma salva o placar.';
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

-- Vincular jogador sem conta: admin também pode.
CREATE OR REPLACE FUNCTION public.vincular_membro(p_member_id UUID, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  UPDATE public.crew_members d
  SET posicao = COALESCE(d.posicao, o.posicao), estrelas = COALESCE(d.estrelas, o.estrelas)
  FROM public.crew_members o
  WHERE d.id = v_destino AND o.id = p_member_id;
  DELETE FROM public.crew_members WHERE id = p_member_id;
  RETURN v_destino;
END;
$$;

-- "Minhas turmas" passa a dizer se sou admin (muda o retorno, então recria).
DROP FUNCTION IF EXISTS public.minhas_turmas();
CREATE FUNCTION public.minhas_turmas()
RETURNS TABLE (
  crew_id UUID,
  nome TEXT,
  sou_dono BOOLEAN,
  sou_admin BOOLEAN,
  membros BIGINT,
  peladas BIGINT,
  meus_gols BIGINT,
  minha_posicao BIGINT,
  artilheiro TEXT,
  artilheiro_gols BIGINT,
  proxima_id UUID,
  proxima_data DATE,
  proxima_horario TIME
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH minhas AS (
    SELECT
      c.id,
      c.nome,
      c.criado_em,
      c.dono_id = auth.uid() AS sou_dono,
      eu.id AS meu_membro,
      COALESCE(eu.admin, false) AS sou_admin
    FROM public.crews c
    LEFT JOIN public.crew_members eu ON eu.crew_id = c.id AND eu.user_id = auth.uid()
    WHERE c.dono_id = auth.uid() OR eu.id IS NOT NULL
  ),
  mes AS (
    SELECT m.crew_id AS turma, mp.member_id AS membro, sum(mp.gols) AS gols
    FROM public.match_players mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE m.crew_id IN (SELECT t.id FROM minhas t)
      AND m.placar_finalizado_em IS NOT NULL
      AND mp.jogos > 0
      AND m.data >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date
    GROUP BY m.crew_id, mp.member_id
  ),
  classificacao AS (
    SELECT mes.turma, mes.membro, mes.gols, rank() OVER (PARTITION BY mes.turma ORDER BY mes.gols DESC) AS pos
    FROM mes
  )
  SELECT
    t.id,
    t.nome,
    t.sou_dono,
    t.sou_admin,
    (SELECT count(*) FROM public.crew_members cm WHERE cm.crew_id = t.id),
    (SELECT count(*) FROM public.matches m WHERE m.crew_id = t.id AND m.placar_finalizado_em IS NOT NULL),
    COALESCE((SELECT k.gols FROM classificacao k WHERE k.turma = t.id AND k.membro = t.meu_membro), 0)::bigint,
    (SELECT k.pos FROM classificacao k WHERE k.turma = t.id AND k.membro = t.meu_membro),
    art.nome,
    art.gols::bigint,
    prox.id,
    prox.data,
    prox.horario
  FROM minhas t
  LEFT JOIN LATERAL (
    SELECT cm.nome, k.gols
    FROM classificacao k
    JOIN public.crew_members cm ON cm.id = k.membro
    WHERE k.turma = t.id AND k.gols > 0
    ORDER BY k.gols DESC, cm.nome
    LIMIT 1
  ) art ON true
  LEFT JOIN LATERAL (
    SELECT m.id, m.data, m.horario
    FROM public.matches m
    WHERE m.crew_id = t.id
      AND m.status IN ('agendada', 'em_andamento')
      AND m.data >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ORDER BY m.data, m.horario
    LIMIT 1
  ) prox ON true
  ORDER BY t.criado_em DESC;
$$;
REVOKE ALL ON FUNCTION public.minhas_turmas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_turmas() TO authenticated;
