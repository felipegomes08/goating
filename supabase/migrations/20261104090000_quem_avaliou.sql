-- "Ver avaliações da pelada" e "Quem te avaliou" (Premium), depois que o MVP fecha.
--
-- Até aqui ninguém via a nota que cada pessoa deu. A partir desta mudança, quem é Premium vê
-- quem deu cada nota que recebeu, mas só nas avaliações feitas na tela nova de avaliar, que
-- avisa disso (identificavel = true). As avaliações antigas continuam anônimas pra sempre, e
-- os comentários nunca entram aqui.

ALTER TABLE public.evaluations ADD COLUMN identificavel boolean NOT NULL DEFAULT false;

-- Todos os avaliados da pelada, com a média da nota geral. Nada de quem avaliou.
CREATE OR REPLACE FUNCTION public.avaliacoes_da_pelada(p_match_id uuid)
RETURNS TABLE(
  user_id uuid,
  nome_exibicao text,
  handle text,
  foto_url text,
  posicao_preferida text,
  nota numeric,
  avaliacoes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome_exibicao, p.handle, p.foto_url, p.posicao_preferida,
         round(avg(e.nota_geral), 1), count(*)::integer
  FROM public.matches m
  JOIN public.evaluations e ON e.match_id = m.id
  JOIN public.profiles p ON p.id = e.avaliado_id
  WHERE m.id = p_match_id AND m.mvp_fechado_em IS NOT NULL AND auth.uid() IS NOT NULL
  GROUP BY p.id
  ORDER BY avg(e.nota_geral) DESC, count(*) DESC, p.nome_exibicao;
$$;

-- As avaliações que quem chama recebeu na pelada. Quem avaliou só vem pra quem é Premium e
-- só nas identificáveis; sem isso, só as notas. Ordem pela nota, pra ordem não entregar ninguém.
CREATE OR REPLACE FUNCTION public.quem_me_avaliou(p_match_id uuid)
RETURNS TABLE(
  nota_geral numeric,
  posicao text,
  notas jsonb,
  identificavel boolean,
  avaliador_id uuid,
  nome text,
  handle text,
  foto_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eu AS (SELECT auth.uid() AS id, public.eh_premium(auth.uid()) AS premium)
  SELECT e.nota_geral, e.posicao,
    jsonb_strip_nulls(jsonb_build_object(
      'reflexo', e.reflexo, 'posicionamento', e.posicionamento, 'elasticidade', e.elasticidade,
      'reposicao', e.reposicao, 'jogo_pes', e.jogo_pes, 'saida_gol', e.saida_gol,
      'marcacao', e.marcacao, 'desarme', e.desarme, 'velocidade', e.velocidade,
      'fisico', e.fisico, 'passe', e.passe, 'jogo_aereo', e.jogo_aereo, 'drible', e.drible,
      'cruzamento', e.cruzamento, 'visao', e.visao, 'finalizacao', e.finalizacao,
      'chute', e.chute, 'controle', e.controle, 'toque', e.toque,
      'comportamento', e.comportamento, 'pontualidade', e.pontualidade
    )),
    e.identificavel,
    CASE WHEN eu.premium AND e.identificavel THEN e.avaliador_id END,
    CASE WHEN eu.premium AND e.identificavel THEN p.nome_exibicao END,
    CASE WHEN eu.premium AND e.identificavel THEN p.handle END,
    CASE WHEN eu.premium AND e.identificavel THEN p.foto_url END
  FROM eu
  JOIN public.matches m ON m.id = p_match_id AND m.mvp_fechado_em IS NOT NULL
  JOIN public.evaluations e ON e.match_id = m.id AND e.avaliado_id = eu.id
  LEFT JOIN public.profiles p ON p.id = e.avaliador_id
  WHERE eu.id IS NOT NULL
  ORDER BY e.nota_geral DESC, e.id;
$$;

REVOKE ALL ON FUNCTION public.avaliacoes_da_pelada(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quem_me_avaliou(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avaliacoes_da_pelada(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quem_me_avaliou(uuid) TO authenticated;
