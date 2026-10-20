-- Notas por posição, no estilo das cartinhas de videogame. Cada posição tem cinco
-- habilidades próprias, mais Comportamento (que passa a juntar comportamento e
-- pontualidade). As que se repetem entre posições são a mesma nota (o "Passe" do volante
-- soma com o "Passe" de quando ele jogou de meia).
--
--   GOL: reflexo, posicionamento, elasticidade, reposicao, jogo_pes (como já era)
--   ZAG: marcacao, desarme, jogo_aereo, fisico, passe
--   LAT: velocidade, marcacao, passe, fisico, drible
--   VOL: desarme, marcacao, passe, fisico, visao
--   MEI: passe, visao, drible, finalizacao, controle
--   ATA: finalizacao, velocidade, drible, passe, controle
--
-- Nota geral = média das cinco da posição + comportamento, com pesos iguais.
-- As avaliações antigas são preenchidas sem recalcular a nota geral: o overall de ninguém muda.

-- 1. COLUNAS NOVAS
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS posicao TEXT
    CHECK (posicao IS NULL OR posicao IN ('GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA')),
  ADD COLUMN IF NOT EXISTS marcacao NUMERIC,
  ADD COLUMN IF NOT EXISTS desarme NUMERIC,
  ADD COLUMN IF NOT EXISTS jogo_aereo NUMERIC,
  ADD COLUMN IF NOT EXISTS fisico NUMERIC,
  ADD COLUMN IF NOT EXISTS passe NUMERIC,
  ADD COLUMN IF NOT EXISTS visao NUMERIC,
  ADD COLUMN IF NOT EXISTS finalizacao NUMERIC,
  ADD COLUMN IF NOT EXISTS controle NUMERIC;

-- quem avaliou grava e corrige as notas novas, como as antigas
GRANT INSERT (posicao, marcacao, desarme, jogo_aereo, fisico, passe, visao, finalizacao, controle)
  ON public.evaluations TO authenticated;
GRANT UPDATE (posicao, marcacao, desarme, jogo_aereo, fisico, passe, visao, finalizacao, controle)
  ON public.evaluations TO authenticated;

-- 2. NOTA GERAL PELA POSIÇÃO
-- Só recalcula quando as notas mudam (ou na avaliação nova): apagar um comentário, por
-- exemplo, não mexe na nota geral de uma avaliação antiga.
CREATE OR REPLACE FUNCTION public.normalizar_nota_geral()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_notas NUMERIC[];
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.posicao, NEW.como_goleiro, NEW.comportamento,
      NEW.reflexo, NEW.posicionamento, NEW.elasticidade, NEW.reposicao, NEW.jogo_pes,
      NEW.marcacao, NEW.desarme, NEW.jogo_aereo, NEW.fisico, NEW.passe, NEW.visao,
      NEW.finalizacao, NEW.controle, NEW.velocidade, NEW.drible, NEW.nota_geral)
     IS NOT DISTINCT FROM
     (OLD.posicao, OLD.como_goleiro, OLD.comportamento,
      OLD.reflexo, OLD.posicionamento, OLD.elasticidade, OLD.reposicao, OLD.jogo_pes,
      OLD.marcacao, OLD.desarme, OLD.jogo_aereo, OLD.fisico, OLD.passe, OLD.visao,
      OLD.finalizacao, OLD.controle, OLD.velocidade, OLD.drible, OLD.nota_geral) THEN
    RETURN NEW;
  END IF;

  -- posição do dia; sem ela (site antigo), vale a chave do goleiro
  NEW.posicao := COALESCE(NEW.posicao, CASE WHEN NEW.como_goleiro THEN 'GOL' ELSE 'MEI' END);
  NEW.como_goleiro := NEW.posicao = 'GOL';

  v_notas := CASE NEW.posicao
    WHEN 'GOL' THEN ARRAY[NEW.reflexo, NEW.posicionamento, NEW.elasticidade, NEW.reposicao, NEW.jogo_pes]
    WHEN 'ZAG' THEN ARRAY[NEW.marcacao, NEW.desarme, NEW.jogo_aereo, NEW.fisico, NEW.passe]
    WHEN 'LAT' THEN ARRAY[NEW.velocidade, NEW.marcacao, NEW.passe, NEW.fisico, NEW.drible]
    WHEN 'VOL' THEN ARRAY[NEW.desarme, NEW.marcacao, NEW.passe, NEW.fisico, NEW.visao]
    WHEN 'MEI' THEN ARRAY[NEW.passe, NEW.visao, NEW.drible, NEW.finalizacao, NEW.controle]
    ELSE ARRAY[NEW.finalizacao, NEW.velocidade, NEW.drible, NEW.passe, NEW.controle]
  END;

  -- avaliação detalhada (todas as notas da posição + comportamento): a geral é a média delas.
  -- Avaliação rápida grava só a geral, que fica como veio.
  IF NEW.comportamento IS NOT NULL AND array_position(v_notas, NULL) IS NULL THEN
    NEW.nota_geral := round(
      (v_notas[1] + v_notas[2] + v_notas[3] + v_notas[4] + v_notas[5] + NEW.comportamento) / 6.0,
      2
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. MÉDIAS DO JOGADOR (pra carta e radar). Muda o formato da resposta: a função é recriada.
DROP FUNCTION IF EXISTS public.medias_do_jogador(uuid);
CREATE FUNCTION public.medias_do_jogador(p_user_id UUID)
RETURNS TABLE (
  total BIGINT, total_goleiro BIGINT, nota_geral NUMERIC,
  marcacao NUMERIC, desarme NUMERIC, jogo_aereo NUMERIC, fisico NUMERIC, passe NUMERIC,
  velocidade NUMERIC, drible NUMERIC, visao NUMERIC, finalizacao NUMERIC, controle NUMERIC,
  reflexo NUMERIC, posicionamento_goleiro NUMERIC, elasticidade NUMERIC, reposicao NUMERIC,
  jogo_pes NUMERIC, comportamento NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE e.como_goleiro),
    avg(e.nota_geral),
    avg(e.marcacao), avg(e.desarme), avg(e.jogo_aereo), avg(e.fisico), avg(e.passe),
    avg(e.velocidade), avg(e.drible), avg(e.visao), avg(e.finalizacao), avg(e.controle),
    avg(e.reflexo),
    avg(e.posicionamento) FILTER (WHERE e.como_goleiro),
    avg(e.elasticidade), avg(e.reposicao), avg(e.jogo_pes),
    avg(e.comportamento)
  FROM public.evaluations e
  WHERE e.avaliado_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.medias_do_jogador(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medias_do_jogador(UUID) TO authenticated;

-- 4. AVALIAÇÕES ANTIGAS. Os gatilhos ficam desligados durante a cópia: a nota geral, o
--    overall, o XP e o tier de ninguém mudam.
ALTER TABLE public.evaluations DISABLE TRIGGER evaluations_normalizar_geral;
ALTER TABLE public.evaluations DISABLE TRIGGER evaluations_recalc;
ALTER TABLE public.evaluations DISABLE TRIGGER evaluations_recalc_xp;

-- posição: goleiro se foi avaliado como goleiro, senão a do perfil (sem posição, meia)
UPDATE public.evaluations e
SET posicao = CASE
  WHEN e.como_goleiro THEN 'GOL'
  WHEN p.posicao_preferida IN ('ZAG', 'LAT', 'VOL', 'MEI', 'ATA') THEN p.posicao_preferida
  ELSE 'MEI'
END
FROM public.profiles p
WHERE p.id = e.avaliado_id AND e.posicao IS NULL;
UPDATE public.evaluations SET posicao = CASE WHEN como_goleiro THEN 'GOL' ELSE 'MEI' END
WHERE posicao IS NULL;

-- comportamento único: média do comportamento com a pontualidade
UPDATE public.evaluations
SET comportamento = round((comportamento + pontualidade) / 2.0, 2)
WHERE comportamento IS NOT NULL AND pontualidade IS NOT NULL;
UPDATE public.evaluations
SET comportamento = pontualidade
WHERE comportamento IS NULL AND pontualidade IS NOT NULL;

-- notas da posição: chute vira finalização, toque vira passe, drible e velocidade continuam;
-- as que não existiam recebem a nota geral daquela avaliação
UPDATE public.evaluations e
SET
  finalizacao = CASE WHEN e.posicao IN ('MEI', 'ATA') THEN COALESCE(e.chute, e.nota_geral) ELSE e.finalizacao END,
  passe = CASE WHEN e.posicao IN ('ZAG', 'LAT', 'VOL', 'MEI', 'ATA') THEN COALESCE(e.toque, e.nota_geral) ELSE e.passe END,
  velocidade = CASE WHEN e.posicao IN ('LAT', 'ATA') THEN COALESCE(e.velocidade, e.nota_geral) ELSE e.velocidade END,
  drible = CASE WHEN e.posicao IN ('LAT', 'MEI', 'ATA') THEN COALESCE(e.drible, e.nota_geral) ELSE e.drible END,
  marcacao = CASE WHEN e.posicao IN ('ZAG', 'LAT', 'VOL') THEN e.nota_geral ELSE e.marcacao END,
  desarme = CASE WHEN e.posicao IN ('ZAG', 'VOL') THEN e.nota_geral ELSE e.desarme END,
  jogo_aereo = CASE WHEN e.posicao = 'ZAG' THEN e.nota_geral ELSE e.jogo_aereo END,
  fisico = CASE WHEN e.posicao IN ('ZAG', 'LAT', 'VOL') THEN e.nota_geral ELSE e.fisico END,
  visao = CASE WHEN e.posicao IN ('VOL', 'MEI') THEN e.nota_geral ELSE e.visao END,
  controle = CASE WHEN e.posicao IN ('MEI', 'ATA') THEN e.nota_geral ELSE e.controle END
WHERE e.posicao <> 'GOL';

ALTER TABLE public.evaluations ENABLE TRIGGER evaluations_normalizar_geral;
ALTER TABLE public.evaluations ENABLE TRIGGER evaluations_recalc;
ALTER TABLE public.evaluations ENABLE TRIGGER evaluations_recalc_xp;
