-- MVP só quando a janela de avaliação fecha.
--
-- Antes o MVP era recalculado a cada nota: a pessoa abria a pelada, se via MVP, e horas
-- depois era outro. O contador de MVPs e o XP do perfil subiam e desciam junto.
-- Agora a pelada fica sem MVP durante as 24h de avaliação, e uma tarefa agendada escolhe
-- o MVP uma vez só, quando a janela fecha. A regra é a mesma: maior média de nota geral,
-- empate pra quem recebeu mais notas.

-- quando o MVP dessa pelada foi fechado (vazio = a janela ainda está aberta)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS mvp_fechado_em TIMESTAMPTZ;

-- 1. sai o cálculo a cada nota
DROP TRIGGER IF EXISTS evaluations_recalc_mvp ON public.evaluations;
DROP FUNCTION IF EXISTS public.recalcular_mvp_partida();

-- 2. o que já existe: pelada com a janela fechada fica como está, com o MVP que tem;
--    pelada ainda na janela perde o MVP provisório e ganha o definitivo no fechamento.
--    (os gatilhos da pelada acertam o contador de MVPs e o XP de quem perdeu o provisório)
UPDATE public.matches
SET mvp_fechado_em = COALESCE(finalizada_em + interval '24 hours', now())
WHERE status = 'finalizada' AND mvp_fechado_em IS NULL
  AND (finalizada_em IS NULL OR finalizada_em <= now() - interval '24 hours');

UPDATE public.matches
SET mvp_id = NULL
WHERE status = 'finalizada' AND mvp_fechado_em IS NULL AND mvp_id IS NOT NULL;

-- 3. fecha o MVP das peladas cuja janela acabou. Pelada sem nota nenhuma fecha sem MVP.
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
    AND (m.finalizada_em IS NULL OR m.finalizada_em <= now() - interval '24 hours');
  GET DIAGNOSTICS v_fechadas = ROW_COUNT;
  RETURN v_fechadas;
END;
$$;
REVOKE ALL ON FUNCTION public.fechar_mvps() FROM PUBLIC, anon, authenticated;

-- a cada 5 minutos, igual à tarefa que finaliza as peladas vencidas
SELECT cron.unschedule('fechar-mvps') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fechar-mvps');
SELECT cron.schedule('fechar-mvps', '*/5 * * * *', 'SELECT public.fechar_mvps();');

-- 4. A nota que o MVP recebeu na pelada, pro cartão de compartilhar. Só sai depois do
--    fechamento, e é só a média e a quantidade: nunca quem deu qual nota.
CREATE OR REPLACE FUNCTION public.mvp_da_partida(p_match_id UUID)
RETURNS TABLE (mvp_id UUID, nota NUMERIC, avaliacoes INTEGER)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.mvp_id, round(avg(e.nota_geral), 1), count(*)::integer
  FROM public.matches m
  JOIN public.evaluations e ON e.match_id = m.id AND e.avaliado_id = m.mvp_id
  WHERE m.id = p_match_id AND m.mvp_fechado_em IS NOT NULL AND auth.uid() IS NOT NULL
  GROUP BY m.mvp_id;
$$;
REVOKE ALL ON FUNCTION public.mvp_da_partida(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mvp_da_partida(UUID) TO authenticated;
