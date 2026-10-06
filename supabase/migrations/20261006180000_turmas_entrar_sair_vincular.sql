-- Turmas: entrar pelo link, sair, vincular jogador sem conta a uma conta e a lista "minhas turmas".
--
-- crew_members só é gravável pelo dono (RLS). O que o próprio jogador faz
-- (entrar, assumir o nome que já jogou, sair) passa por função.

-- Entra na turma. Passando p_member_id, assume um jogador sem conta que já está
-- na turma ("sou eu: Zé") e leva o histórico dele.
CREATE OR REPLACE FUNCTION public.entrar_na_turma(p_crew_id UUID, p_member_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para entrar na turma.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crews c WHERE c.id = p_crew_id) THEN
    RAISE EXCEPTION 'Essa turma não existe mais.';
  END IF;

  SELECT cm.id INTO v_id FROM public.crew_members cm WHERE cm.crew_id = p_crew_id AND cm.user_id = v_uid;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  IF p_member_id IS NOT NULL THEN
    UPDATE public.crew_members cm SET user_id = v_uid
    WHERE cm.id = p_member_id AND cm.crew_id = p_crew_id AND cm.user_id IS NULL
    RETURNING cm.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Esse jogador já está ligado a outra conta.';
    END IF;
    RETURN v_id;
  END IF;

  INSERT INTO public.crew_members (crew_id, user_id, nome)
  SELECT p_crew_id, v_uid, p.nome_exibicao FROM public.profiles p WHERE p.id = v_uid
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.entrar_na_turma(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entrar_na_turma(UUID, UUID) TO authenticated;

-- Sai da turma. O histórico fica na turma como jogador sem conta (só o nome).
CREATE OR REPLACE FUNCTION public.sair_da_turma(p_crew_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.crew_members cm SET user_id = NULL
  WHERE cm.crew_id = p_crew_id AND cm.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.sair_da_turma(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sair_da_turma(UUID) TO authenticated;

-- Dono liga um jogador sem conta a uma conta. Se a conta já é da turma,
-- junta os dois históricos num só.
CREATE OR REPLACE FUNCTION public.vincular_membro(p_member_id UUID, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_crew UUID;
  v_destino UUID;
BEGIN
  SELECT cm.crew_id INTO v_crew
  FROM public.crew_members cm
  JOIN public.crews c ON c.id = cm.crew_id
  WHERE cm.id = p_member_id AND cm.user_id IS NULL AND c.dono_id = auth.uid();
  IF v_crew IS NULL THEN
    RAISE EXCEPTION 'Só o dono da turma vincula jogadores sem conta.';
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
REVOKE ALL ON FUNCTION public.vincular_membro(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_membro(UUID, UUID) TO authenticated;

-- Turmas em que estou (como dono ou jogador), com o resumo do mês pra tela inicial.
CREATE OR REPLACE FUNCTION public.minhas_turmas()
RETURNS TABLE (
  crew_id UUID,
  nome TEXT,
  sou_dono BOOLEAN,
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
      (SELECT cm.id FROM public.crew_members cm WHERE cm.crew_id = c.id AND cm.user_id = auth.uid()) AS meu_membro
    FROM public.crews c
    WHERE c.dono_id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.crew_members cm WHERE cm.crew_id = c.id AND cm.user_id = auth.uid())
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
