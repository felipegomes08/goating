-- Seis notas por posição na cartinha (antes eram cinco), mais Comportamento.
--
--   GOL: reflexo, posicionamento, elasticidade, reposicao, jogo_pes, saida_gol
--   ZAG: marcacao, desarme, velocidade, fisico, passe, jogo_aereo
--   LAT: velocidade, marcacao, passe, fisico, drible, cruzamento
--   VOL: desarme, marcacao, passe, fisico, visao, velocidade
--   MEI: passe, visao, drible, finalizacao, velocidade, fisico
--   ATA: finalizacao, velocidade, drible, passe, fisico, jogo_aereo
--
-- Nota geral = média das seis da posição + comportamento. Controle de bola sai da lista
-- (entra no Drible) e fica guardado. As avaliações antigas ganham as notas que faltam sem
-- recalcular a nota geral: o overall de ninguém muda.

-- 1. COLUNAS NOVAS
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS saida_gol NUMERIC,
  ADD COLUMN IF NOT EXISTS cruzamento NUMERIC;
GRANT INSERT (saida_gol, cruzamento) ON public.evaluations TO authenticated;
GRANT UPDATE (saida_gol, cruzamento) ON public.evaluations TO authenticated;

-- 2. NOTA GERAL PELA POSIÇÃO (só recalcula quando as notas mudam, ou na avaliação nova)
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
      NEW.reflexo, NEW.posicionamento, NEW.elasticidade, NEW.reposicao, NEW.jogo_pes, NEW.saida_gol,
      NEW.marcacao, NEW.desarme, NEW.jogo_aereo, NEW.fisico, NEW.passe, NEW.visao,
      NEW.finalizacao, NEW.cruzamento, NEW.velocidade, NEW.drible, NEW.nota_geral)
     IS NOT DISTINCT FROM
     (OLD.posicao, OLD.como_goleiro, OLD.comportamento,
      OLD.reflexo, OLD.posicionamento, OLD.elasticidade, OLD.reposicao, OLD.jogo_pes, OLD.saida_gol,
      OLD.marcacao, OLD.desarme, OLD.jogo_aereo, OLD.fisico, OLD.passe, OLD.visao,
      OLD.finalizacao, OLD.cruzamento, OLD.velocidade, OLD.drible, OLD.nota_geral) THEN
    RETURN NEW;
  END IF;

  NEW.posicao := COALESCE(NEW.posicao, CASE WHEN NEW.como_goleiro THEN 'GOL' ELSE 'MEI' END);
  NEW.como_goleiro := NEW.posicao = 'GOL';

  v_notas := CASE NEW.posicao
    WHEN 'GOL' THEN ARRAY[NEW.reflexo, NEW.posicionamento, NEW.elasticidade, NEW.reposicao, NEW.jogo_pes, NEW.saida_gol]
    WHEN 'ZAG' THEN ARRAY[NEW.marcacao, NEW.desarme, NEW.velocidade, NEW.fisico, NEW.passe, NEW.jogo_aereo]
    WHEN 'LAT' THEN ARRAY[NEW.velocidade, NEW.marcacao, NEW.passe, NEW.fisico, NEW.drible, NEW.cruzamento]
    WHEN 'VOL' THEN ARRAY[NEW.desarme, NEW.marcacao, NEW.passe, NEW.fisico, NEW.visao, NEW.velocidade]
    WHEN 'MEI' THEN ARRAY[NEW.passe, NEW.visao, NEW.drible, NEW.finalizacao, NEW.velocidade, NEW.fisico]
    ELSE ARRAY[NEW.finalizacao, NEW.velocidade, NEW.drible, NEW.passe, NEW.fisico, NEW.jogo_aereo]
  END;

  IF NEW.comportamento IS NOT NULL AND array_position(v_notas, NULL) IS NULL THEN
    NEW.nota_geral := round(
      (v_notas[1] + v_notas[2] + v_notas[3] + v_notas[4] + v_notas[5] + v_notas[6]
       + NEW.comportamento) / 7.0,
      2
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. MÉDIAS DO JOGADOR, com as duas notas novas
DROP FUNCTION IF EXISTS public.medias_do_jogador(uuid);
CREATE FUNCTION public.medias_do_jogador(p_user_id UUID)
RETURNS TABLE (
  total BIGINT, total_goleiro BIGINT, nota_geral NUMERIC,
  marcacao NUMERIC, desarme NUMERIC, jogo_aereo NUMERIC, fisico NUMERIC, passe NUMERIC,
  velocidade NUMERIC, drible NUMERIC, visao NUMERIC, finalizacao NUMERIC, controle NUMERIC,
  cruzamento NUMERIC, reflexo NUMERIC, posicionamento_goleiro NUMERIC, elasticidade NUMERIC,
  reposicao NUMERIC, jogo_pes NUMERIC, saida_gol NUMERIC, comportamento NUMERIC
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
    avg(e.cruzamento), avg(e.reflexo),
    avg(e.posicionamento) FILTER (WHERE e.como_goleiro),
    avg(e.elasticidade), avg(e.reposicao), avg(e.jogo_pes), avg(e.saida_gol),
    avg(e.comportamento)
  FROM public.evaluations e
  WHERE e.avaliado_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.medias_do_jogador(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medias_do_jogador(UUID) TO authenticated;

-- 4. AVALIAÇÕES ANTIGAS: a nota que falta na lista nova recebe a que já existia ou, sem ela,
--    a nota geral daquela avaliação. Gatilhos desligados: nota geral e overall não mudam.
ALTER TABLE public.evaluations DISABLE TRIGGER evaluations_normalizar_geral;
ALTER TABLE public.evaluations DISABLE TRIGGER evaluations_recalc;
ALTER TABLE public.evaluations DISABLE TRIGGER evaluations_recalc_xp;

UPDATE public.evaluations e
SET
  saida_gol = CASE WHEN e.posicao = 'GOL' THEN COALESCE(e.saida_gol, e.nota_geral) ELSE e.saida_gol END,
  velocidade = CASE WHEN e.posicao IN ('ZAG', 'LAT', 'VOL', 'MEI', 'ATA') THEN COALESCE(e.velocidade, e.nota_geral) ELSE e.velocidade END,
  jogo_aereo = CASE WHEN e.posicao IN ('ZAG', 'ATA') THEN COALESCE(e.jogo_aereo, e.nota_geral) ELSE e.jogo_aereo END,
  cruzamento = CASE WHEN e.posicao = 'LAT' THEN COALESCE(e.cruzamento, e.nota_geral) ELSE e.cruzamento END,
  fisico = CASE WHEN e.posicao IN ('ZAG', 'LAT', 'VOL', 'MEI', 'ATA') THEN COALESCE(e.fisico, e.nota_geral) ELSE e.fisico END;

ALTER TABLE public.evaluations ENABLE TRIGGER evaluations_normalizar_geral;
ALTER TABLE public.evaluations ENABLE TRIGGER evaluations_recalc;
ALTER TABLE public.evaluations ENABLE TRIGGER evaluations_recalc_xp;
