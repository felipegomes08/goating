-- MVP da partida deixa de ser escolha manual do organizador e passa a ser
-- calculado automaticamente: melhor média de nota_geral entre os participantes
-- da partida, com empate resolvido por quem recebeu mais avaliações.
-- Recalcula a cada nova avaliação; como o app já fecha avaliações 24h após o
-- término da pelada, o valor se estabiliza sozinho quando a janela fecha.

CREATE OR REPLACE FUNCTION public.recalcular_mvp_partida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match_id uuid;
  v_melhor uuid;
BEGIN
  v_match_id := COALESCE(NEW.match_id, OLD.match_id);

  SELECT avaliado_id INTO v_melhor
  FROM public.evaluations
  WHERE match_id = v_match_id
  GROUP BY avaliado_id
  ORDER BY avg(nota_geral) DESC, count(*) DESC, avaliado_id ASC
  LIMIT 1;

  UPDATE public.matches
  SET mvp_id = v_melhor
  WHERE id = v_match_id AND mvp_id IS DISTINCT FROM v_melhor;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_mvp_partida() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS evaluations_recalc_mvp ON public.evaluations;
CREATE TRIGGER evaluations_recalc_mvp
AFTER INSERT ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.recalcular_mvp_partida();
