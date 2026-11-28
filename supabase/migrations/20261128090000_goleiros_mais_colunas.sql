-- Tabela dos goleiros com mais números: vitórias com ele no gol, defesas épicas marcadas
-- no placar e jogos sem sofrer gol. Serve pra turma (período do ranking) e pra liga
-- (o período da liga: início e fim).

DROP FUNCTION IF EXISTS public.crew_goleiros(uuid, date, date);
CREATE FUNCTION public.crew_goleiros(p_crew_id uuid, p_desde date DEFAULT NULL, p_ate date DEFAULT NULL)
RETURNS TABLE (
  member_id uuid, user_id uuid, nome text, foto_url text,
  peladas bigint, jogos bigint, sofridos bigint, vitorias bigint, defesas bigint,
  sem_sofrer bigint, peladas_no_periodo bigint
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
    SELECT g.id AS game_id, g.match_id, g.goleiro_a AS member_id, g.gols_b AS sofridos,
           (g.vencedor IS NOT NULL AND g.vencedor = g.time_a) AS venceu
    FROM public.games g JOIN peladas p ON p.id = g.match_id
    WHERE g.goleiro_a IS NOT NULL
    UNION ALL
    SELECT g.id, g.match_id, g.goleiro_b, g.gols_a,
           (g.vencedor IS NOT NULL AND g.vencedor = g.time_b)
    FROM public.games g JOIN peladas p ON p.id = g.match_id
    WHERE g.goleiro_b IS NOT NULL
  )
  SELECT
    cm.id, cm.user_id, cm.nome, pr.foto_url,
    count(DISTINCT a.match_id),
    count(*),
    COALESCE(sum(a.sofridos), 0),
    count(*) FILTER (WHERE a.venceu),
    -- defesas épicas dele nos jogos em que estava no gol
    COALESCE(sum((SELECT count(*) FROM public.game_events e
                  WHERE e.game_id = a.game_id AND e.member_id = a.member_id
                    AND e.tipo = 'defesa')), 0),
    count(*) FILTER (WHERE a.sofridos = 0),
    (SELECT count(*) FROM peladas)
  FROM atuacoes a
  JOIN public.crew_members cm ON cm.id = a.member_id
  LEFT JOIN public.profiles pr ON pr.id = cm.user_id
  WHERE cm.removido_em IS NULL
  GROUP BY cm.id, cm.user_id, cm.nome, pr.foto_url;
$$;
REVOKE ALL ON FUNCTION public.crew_goleiros(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_goleiros(uuid, date, date) TO authenticated;
