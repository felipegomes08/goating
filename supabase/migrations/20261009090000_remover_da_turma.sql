-- Tirar alguém da turma, mesmo quem já jogou.
--
-- Apagar a linha de quem já jogou levaria junto o elenco das peladas antigas (cascata) e
-- deixaria os gols sem autor. Então quem tem histórico é só "aposentado": sai da lista de
-- jogadores e do ranking, perde o vínculo com a conta, e as peladas passadas ficam intactas.
-- Se o nome voltar numa lista colada, o jogador volta pra turma com tudo o que tinha.

ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS removido_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.remover_da_turma(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membro public.crew_members%ROWTYPE;
  v_dono UUID;
BEGIN
  SELECT cm.* INTO v_membro FROM public.crew_members cm WHERE cm.id = p_member_id;
  IF v_membro.id IS NULL OR NOT public.gere_turma(v_membro.crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma tira jogadores.';
  END IF;
  SELECT c.dono_id INTO v_dono FROM public.crews c WHERE c.id = v_membro.crew_id;
  IF v_membro.user_id = v_dono THEN
    RAISE EXCEPTION 'O dono não pode ser tirado da própria turma.';
  END IF;
  IF v_membro.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Pra sair da turma, use a opção de sair.';
  END IF;
  IF v_membro.admin AND auth.uid() <> v_dono THEN
    RAISE EXCEPTION 'Só o dono da turma tira um administrador.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.match_players mp WHERE mp.member_id = p_member_id) THEN
    UPDATE public.crew_members
    SET removido_em = now(), user_id = NULL, admin = false
    WHERE id = p_member_id;
  ELSE
    DELETE FROM public.crew_members WHERE id = p_member_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.remover_da_turma(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_da_turma(UUID) TO authenticated;

-- Entrou no elenco de uma pelada de novo: volta pra turma.
CREATE OR REPLACE FUNCTION public.reativar_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crew_members SET removido_em = NULL
  WHERE id = NEW.member_id AND removido_em IS NOT NULL;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS match_players_reativa_membro ON public.match_players;
CREATE TRIGGER match_players_reativa_membro
AFTER INSERT ON public.match_players
FOR EACH ROW EXECUTE FUNCTION public.reativar_membro();

-- RANKING DA TURMA: quem foi tirado não aparece.
CREATE OR REPLACE FUNCTION public.crew_stats(p_crew_id uuid, p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, user_id uuid, nome text, foto_url text, peladas bigint, jogos bigint, gols bigint, vitorias bigint, empates bigint, derrotas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    AND cm.removido_em IS NULL
    AND (p_desde IS NULL OR m.data >= p_desde)
    AND (p_ate IS NULL OR m.data <= p_ate)
  GROUP BY cm.id, cm.user_id, cm.nome, p.foto_url;
$function$;

-- MINHAS TURMAS: contagem de jogadores e artilheiro do mês sem quem foi tirado.
CREATE OR REPLACE FUNCTION public.minhas_turmas()
 RETURNS TABLE(crew_id uuid, nome text, sou_dono boolean, sou_admin boolean, membros bigint, peladas bigint, meus_gols bigint, minha_posicao bigint, artilheiro text, artilheiro_gols bigint, proxima_id uuid, proxima_data date, proxima_horario time without time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    JOIN public.crew_members cm ON cm.id = mp.member_id
    WHERE m.crew_id IN (SELECT t.id FROM minhas t)
      AND m.placar_finalizado_em IS NOT NULL
      AND mp.jogos > 0
      AND cm.removido_em IS NULL
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
    (SELECT count(*) FROM public.crew_members cm WHERE cm.crew_id = t.id AND cm.removido_em IS NULL),
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
$function$;
