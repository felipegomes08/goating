-- Janela de avaliação cai de 24h pra 2h. A galera avalia na hora, logo depois do jogo, e
-- quer saber o MVP ainda no mesmo dia; com 24h o povo já tinha esquecido da pelada.
--
-- O tamanho da janela passa a morar num lugar só: quem avalia (pode_avaliar) e quem fecha
-- o MVP (fechar_mvps) leem daqui. Pra mudar de novo, é só trocar este número.
CREATE OR REPLACE FUNCTION public.janela_de_avaliacao()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '2 hours' $$;
REVOKE ALL ON FUNCTION public.janela_de_avaliacao() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pode_avaliar(_match_id uuid, _avaliador uuid, _avaliado uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id
      AND m.status = 'finalizada'
      AND m.finalizada_em IS NOT NULL
      AND m.finalizada_em > now() - public.janela_de_avaliacao()
      AND EXISTS (SELECT 1 FROM public.match_participants p WHERE p.match_id = m.id AND p.user_id = _avaliador AND p.status = 'aprovado')
      AND EXISTS (SELECT 1 FROM public.match_participants p WHERE p.match_id = m.id AND p.user_id = _avaliado AND p.status = 'aprovado')
      AND NOT EXISTS (SELECT 1 FROM public.profiles a WHERE a.id = _avaliador AND a.eh_convidado)
  );
$$;

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
    AND (m.finalizada_em IS NULL OR m.finalizada_em <= now() - public.janela_de_avaliacao());
  GET DIAGNOSTICS v_fechadas = ROW_COUNT;
  RETURN v_fechadas;
END;
$$;
