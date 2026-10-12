-- Goleiro é avaliado como goleiro: reflexo, posicionamento, elasticidade, reposição e jogo
-- com os pés, no lugar de chute, drible, velocidade e toque. Comportamento e pontualidade
-- continuam valendo pra todo mundo.
--
-- Quem avalia marca "jogou no gol hoje" (o padrão vem da posição do perfil), então a mesma
-- pessoa pode ter avaliações dos dois tipos. O overall não muda: segue sendo a média das
-- notas gerais, de qualquer tipo.

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS como_goleiro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reflexo NUMERIC CHECK (reflexo >= 0 AND reflexo <= 10),
  ADD COLUMN IF NOT EXISTS elasticidade NUMERIC CHECK (elasticidade >= 0 AND elasticidade <= 10),
  ADD COLUMN IF NOT EXISTS reposicao NUMERIC CHECK (reposicao >= 0 AND reposicao <= 10),
  ADD COLUMN IF NOT EXISTS jogo_pes NUMERIC CHECK (jogo_pes >= 0 AND jogo_pes <= 10);

-- quem avaliou pode corrigir as notas novas também (a janela de 24h continua na regra de acesso)
GRANT UPDATE (como_goleiro, reflexo, elasticidade, reposicao, jogo_pes)
  ON public.evaluations TO authenticated;

-- Nota geral = média das sete notas do tipo da avaliação. As notas do outro tipo são
-- apagadas, pra uma avaliação de goleiro nunca entrar na média de chute, e vice-versa.
CREATE OR REPLACE FUNCTION public.normalizar_nota_geral()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.como_goleiro THEN
    NEW.chute := NULL;
    NEW.drible := NULL;
    NEW.velocidade := NULL;
    NEW.toque := NULL;
    IF NEW.reflexo IS NOT NULL AND NEW.posicionamento IS NOT NULL AND NEW.elasticidade IS NOT NULL
       AND NEW.reposicao IS NOT NULL AND NEW.jogo_pes IS NOT NULL
       AND NEW.comportamento IS NOT NULL AND NEW.pontualidade IS NOT NULL THEN
      NEW.nota_geral := round(
        (NEW.reflexo + NEW.posicionamento + NEW.elasticidade + NEW.reposicao + NEW.jogo_pes
         + NEW.comportamento + NEW.pontualidade) / 7.0,
        2
      );
    END IF;
  ELSE
    NEW.reflexo := NULL;
    NEW.elasticidade := NULL;
    NEW.reposicao := NULL;
    NEW.jogo_pes := NULL;
    IF NEW.chute IS NOT NULL AND NEW.drible IS NOT NULL AND NEW.velocidade IS NOT NULL
       AND NEW.toque IS NOT NULL AND NEW.posicionamento IS NOT NULL
       AND NEW.comportamento IS NOT NULL AND NEW.pontualidade IS NOT NULL THEN
      NEW.nota_geral := round(
        (NEW.chute + NEW.drible + NEW.velocidade + NEW.toque
         + NEW.posicionamento + NEW.comportamento + NEW.pontualidade) / 7.0,
        2
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Médias do jogador: as de linha só com avaliações de linha, as de goleiro só com as de
-- goleiro. A função muda de formato (colunas novas), então é recriada.
DROP FUNCTION IF EXISTS public.medias_do_jogador(UUID);
CREATE FUNCTION public.medias_do_jogador(p_user_id UUID)
RETURNS TABLE (
  total BIGINT, total_goleiro BIGINT, nota_geral NUMERIC,
  chute NUMERIC, drible NUMERIC, velocidade NUMERIC, toque NUMERIC, posicionamento NUMERIC,
  reflexo NUMERIC, posicionamento_goleiro NUMERIC, elasticidade NUMERIC, reposicao NUMERIC,
  jogo_pes NUMERIC, comportamento NUMERIC, pontualidade NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE e.como_goleiro),
    avg(e.nota_geral),
    avg(e.chute), avg(e.drible), avg(e.velocidade), avg(e.toque),
    avg(e.posicionamento) FILTER (WHERE NOT e.como_goleiro),
    avg(e.reflexo),
    avg(e.posicionamento) FILTER (WHERE e.como_goleiro),
    avg(e.elasticidade), avg(e.reposicao), avg(e.jogo_pes),
    avg(e.comportamento), avg(e.pontualidade)
  FROM public.evaluations e
  WHERE e.avaliado_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.medias_do_jogador(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medias_do_jogador(UUID) TO authenticated;
