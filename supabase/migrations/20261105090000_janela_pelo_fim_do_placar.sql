-- Janela de avaliação contada a partir do fim do placar.
--
-- A pelada é finalizada sozinha no horário de fim salvo (finalizar_peladas_vencidas), e a
-- janela de 2h contava dali. Quando o jogo passa do horário, o placar é encerrado depois e
-- sobrava pouco tempo pra avaliar (26/10: fim salvo 19:45, placar encerrado 21:18, MVP fechou
-- 21:45). Agora encerrar o placar estende avaliacao_ate pra 2h depois do encerramento, e o MVP
-- não fecha enquanto o placar está aberto (com limite de 6h, pra placar esquecido aberto).

CREATE OR REPLACE FUNCTION public.janela_pelo_fim_do_placar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- o fim vale o mais tarde entre: 2h depois da finalização e 2h depois do fim do placar
  -- (placar encerrado antes do horário de fim não encurta a janela)
  IF NEW.placar_finalizado_em IS NOT NULL
     AND NEW.mvp_fechado_em IS NULL
     AND (NEW.placar_finalizado_em IS DISTINCT FROM OLD.placar_finalizado_em
          OR NEW.finalizada_em IS DISTINCT FROM OLD.finalizada_em) THEN
    NEW.avaliacao_ate := GREATEST(
      NEW.avaliacao_ate,
      NEW.finalizada_em + public.janela_de_avaliacao(),
      NEW.placar_finalizado_em + public.janela_de_avaliacao()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_janela_pelo_placar ON public.matches;
CREATE TRIGGER matches_janela_pelo_placar
  BEFORE UPDATE OF placar_finalizado_em, finalizada_em ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.janela_pelo_fim_do_placar();

CREATE OR REPLACE FUNCTION public.fechar_mvps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fechadas INTEGER;
BEGIN
  UPDATE public.matches m
  SET mvp_fechado_em = now(),
      mvp_id = (
        SELECT e.avaliado_id
        FROM public.evaluations e
        WHERE e.match_id = m.id
        GROUP BY e.avaliado_id
        ORDER BY avg(e.nota_geral) DESC, count(*) DESC, e.avaliado_id ASC
        LIMIT 1
      )
  WHERE m.status = 'finalizada'
    AND m.mvp_fechado_em IS NULL
    AND COALESCE(m.avaliacao_ate, m.finalizada_em + public.janela_de_avaliacao(), now()) <= now()
    -- placar ainda rolando: espera encerrar (até 6h depois da finalização)
    AND NOT (
      m.placar_estado IS NOT NULL
      AND m.placar_finalizado_em IS NULL
      AND m.finalizada_em > now() - interval '6 hours'
    );
  GET DIAGNOSTICS v_fechadas = ROW_COUNT;
  RETURN v_fechadas;
END;
$$;
