-- Premium, dados: as notas de cada habilidade (as 6 da carta e o gráfico de teia) só aparecem
-- quando o dono do perfil é Premium. Quem não é mostra só o overall. E o raio-X das avaliações,
-- que só responde pra quem é Premium, sobre as próprias notas.

-- 1. MÉDIAS DO JOGADOR: as habilidades saem vazias quando o dono não é Premium
DROP FUNCTION IF EXISTS public.medias_do_jogador(uuid);
CREATE FUNCTION public.medias_do_jogador(p_user_id UUID)
RETURNS TABLE (
  total BIGINT, total_goleiro BIGINT, nota_geral NUMERIC, notas_liberadas BOOLEAN,
  marcacao NUMERIC, desarme NUMERIC, jogo_aereo NUMERIC, fisico NUMERIC, passe NUMERIC,
  velocidade NUMERIC, drible NUMERIC, visao NUMERIC, finalizacao NUMERIC, controle NUMERIC,
  cruzamento NUMERIC, reflexo NUMERIC, posicionamento_goleiro NUMERIC, elasticidade NUMERIC,
  reposicao NUMERIC, jogo_pes NUMERIC, saida_gol NUMERIC, comportamento NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH medias AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE e.como_goleiro) AS total_goleiro,
      avg(e.nota_geral) AS nota_geral,
      avg(e.marcacao) AS marcacao, avg(e.desarme) AS desarme, avg(e.jogo_aereo) AS jogo_aereo,
      avg(e.fisico) AS fisico, avg(e.passe) AS passe, avg(e.velocidade) AS velocidade,
      avg(e.drible) AS drible, avg(e.visao) AS visao, avg(e.finalizacao) AS finalizacao,
      avg(e.controle) AS controle, avg(e.cruzamento) AS cruzamento, avg(e.reflexo) AS reflexo,
      avg(e.posicionamento) FILTER (WHERE e.como_goleiro) AS posicionamento_goleiro,
      avg(e.elasticidade) AS elasticidade, avg(e.reposicao) AS reposicao,
      avg(e.jogo_pes) AS jogo_pes, avg(e.saida_gol) AS saida_gol,
      avg(e.comportamento) AS comportamento
    FROM public.evaluations e
    WHERE e.avaliado_id = p_user_id
  ), dono AS (
    SELECT public.eh_premium(p_user_id) AS premium
  )
  SELECT
    m.total, m.total_goleiro, m.nota_geral, d.premium,
    CASE WHEN d.premium THEN m.marcacao END, CASE WHEN d.premium THEN m.desarme END,
    CASE WHEN d.premium THEN m.jogo_aereo END, CASE WHEN d.premium THEN m.fisico END,
    CASE WHEN d.premium THEN m.passe END, CASE WHEN d.premium THEN m.velocidade END,
    CASE WHEN d.premium THEN m.drible END, CASE WHEN d.premium THEN m.visao END,
    CASE WHEN d.premium THEN m.finalizacao END, CASE WHEN d.premium THEN m.controle END,
    CASE WHEN d.premium THEN m.cruzamento END, CASE WHEN d.premium THEN m.reflexo END,
    CASE WHEN d.premium THEN m.posicionamento_goleiro END,
    CASE WHEN d.premium THEN m.elasticidade END, CASE WHEN d.premium THEN m.reposicao END,
    CASE WHEN d.premium THEN m.jogo_pes END, CASE WHEN d.premium THEN m.saida_gol END,
    CASE WHEN d.premium THEN m.comportamento END
  FROM medias m, dono d;
$$;
REVOKE ALL ON FUNCTION public.medias_do_jogador(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medias_do_jogador(UUID) TO authenticated;

-- 2. RAIO-X: as próprias notas, últimos 30 dias contra antes, e a nota de cada pelada.
--    Nunca diz quem deu a nota.
CREATE OR REPLACE FUNCTION public.raio_x_do_jogador()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eu UUID := auth.uid();
  medias jsonb;
  peladas jsonb;
BEGIN
  IF eu IS NULL OR NOT public.eh_premium(eu) THEN
    RAISE EXCEPTION 'O raio-X é do Premium';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'recentes', count(*) FILTER (WHERE e.criado_em >= now() - interval '30 days'),
    'ultimos30', jsonb_build_object(
      'nota_geral', round(avg(e.nota_geral) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'marcacao', round(avg(e.marcacao) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'desarme', round(avg(e.desarme) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'jogo_aereo', round(avg(e.jogo_aereo) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'fisico', round(avg(e.fisico) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'passe', round(avg(e.passe) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'velocidade', round(avg(e.velocidade) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'drible', round(avg(e.drible) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'visao', round(avg(e.visao) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'finalizacao', round(avg(e.finalizacao) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'controle', round(avg(e.controle) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'cruzamento', round(avg(e.cruzamento) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'reflexo', round(avg(e.reflexo) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'posicionamento', round(avg(e.posicionamento) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'elasticidade', round(avg(e.elasticidade) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'reposicao', round(avg(e.reposicao) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'jogo_pes', round(avg(e.jogo_pes) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'saida_gol', round(avg(e.saida_gol) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2),
      'comportamento', round(avg(e.comportamento) FILTER (WHERE e.criado_em >= now() - interval '30 days'), 2)
    ),
    'antes', jsonb_build_object(
      'nota_geral', round(avg(e.nota_geral) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'marcacao', round(avg(e.marcacao) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'desarme', round(avg(e.desarme) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'jogo_aereo', round(avg(e.jogo_aereo) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'fisico', round(avg(e.fisico) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'passe', round(avg(e.passe) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'velocidade', round(avg(e.velocidade) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'drible', round(avg(e.drible) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'visao', round(avg(e.visao) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'finalizacao', round(avg(e.finalizacao) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'controle', round(avg(e.controle) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'cruzamento', round(avg(e.cruzamento) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'reflexo', round(avg(e.reflexo) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'posicionamento', round(avg(e.posicionamento) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'elasticidade', round(avg(e.elasticidade) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'reposicao', round(avg(e.reposicao) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'jogo_pes', round(avg(e.jogo_pes) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'saida_gol', round(avg(e.saida_gol) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2),
      'comportamento', round(avg(e.comportamento) FILTER (WHERE e.criado_em < now() - interval '30 days'), 2)
    )
  )
  INTO medias
  FROM public.evaluations e
  WHERE e.avaliado_id = eu;

  SELECT COALESCE(jsonb_agg(p ORDER BY p.data), '[]'::jsonb)
  INTO peladas
  FROM (
    SELECT m.id, m.titulo, m.data, round(avg(e.nota_geral), 2) AS nota, count(*) AS avaliacoes
    FROM public.evaluations e
    JOIN public.matches m ON m.id = e.match_id
    WHERE e.avaliado_id = eu
    GROUP BY m.id, m.titulo, m.data
    ORDER BY m.data DESC
    LIMIT 12
  ) p;

  RETURN medias || jsonb_build_object('peladas', peladas);
END;
$$;
REVOKE ALL ON FUNCTION public.raio_x_do_jogador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raio_x_do_jogador() TO authenticated;
