-- Premium, disputa: foto semanal das posições do ranking (pras setinhas de subiu/caiu e o
-- histórico) e a coluna de MVPs no ranking da turma.

-- 1. FOTO SEMANAL DO RANKING
-- Toda segunda de madrugada guarda a posição de cada jogador no ranking geral e no da cidade,
-- na mesma ordem da tela: tier, depois XP, depois overall (só quem já tem o mínimo de avaliações).
CREATE TABLE IF NOT EXISTS public.ranking_semanal (
  semana DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  posicao_geral INT NOT NULL,
  posicao_cidade INT,
  PRIMARY KEY (semana, user_id)
);
CREATE INDEX IF NOT EXISTS ranking_semanal_user_idx ON public.ranking_semanal (user_id, semana);
ALTER TABLE public.ranking_semanal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranking_semanal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ranking_semanal TO authenticated;
GRANT ALL ON public.ranking_semanal TO service_role;
DROP POLICY IF EXISTS ranking_semanal_ler ON public.ranking_semanal;
CREATE POLICY ranking_semanal_ler ON public.ranking_semanal
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fotografar_ranking()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH elegiveis AS (
    SELECT
      p.id,
      p.cidade,
      p.xp,
      p.overall,
      CASE p.tier_reconhecido
        WHEN 'Bronze' THEN 1 WHEN 'Prata' THEN 2 WHEN 'Ouro' THEN 3
        WHEN 'Platina' THEN 4 WHEN 'Lendário' THEN 5 WHEN 'GOAT' THEN 6 ELSE 0
      END AS ordem_tier
    FROM public.profiles p
    WHERE p.avaliacoes_recebidas >= 3
  )
  INSERT INTO public.ranking_semanal (semana, user_id, posicao_geral, posicao_cidade)
  SELECT
    date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date,
    e.id,
    row_number() OVER (ORDER BY e.ordem_tier DESC, e.xp DESC, e.overall DESC, e.id),
    CASE WHEN e.cidade IS NOT NULL THEN
      row_number() OVER (
        PARTITION BY e.cidade ORDER BY e.ordem_tier DESC, e.xp DESC, e.overall DESC, e.id
      )
    END
  FROM elegiveis e
  ON CONFLICT (semana, user_id) DO UPDATE
    SET posicao_geral = EXCLUDED.posicao_geral, posicao_cidade = EXCLUDED.posicao_cidade;
$$;
REVOKE ALL ON FUNCTION public.fotografar_ranking() FROM PUBLIC, anon, authenticated;

-- segunda, 3h da manhã (horário de Brasília)
SELECT cron.unschedule('ranking-semanal')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ranking-semanal');
SELECT cron.schedule('ranking-semanal', '0 6 * * 1', 'SELECT public.fotografar_ranking();');

-- primeira foto já agora, pra ter com o que comparar
SELECT public.fotografar_ranking();

-- 2. MVPs NO RANKING DA TURMA
-- crew_stats ganha a coluna mvps (quantas vezes foi MVP de pelada da turma no período).
DROP FUNCTION IF EXISTS public.crew_stats(uuid, date, date);
CREATE FUNCTION public.crew_stats(p_crew_id uuid, p_desde date DEFAULT NULL, p_ate date DEFAULT NULL)
RETURNS TABLE (
  member_id uuid, user_id uuid, nome text, foto_url text, peladas bigint, jogos bigint,
  gols bigint, vitorias bigint, empates bigint, derrotas bigint,
  assistencias bigint, defesas bigint, amarelos bigint, azuis bigint, vermelhos bigint,
  mvps bigint
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
    COALESCE(sum(mp.vermelhos), 0),
    count(*) FILTER (WHERE cm.user_id IS NOT NULL AND m.mvp_id = cm.user_id)
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
