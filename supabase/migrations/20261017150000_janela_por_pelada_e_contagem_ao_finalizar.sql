-- 1. JANELA POR PELADA. A janela normal é de 2h depois de finalizada, mas uma pelada pode
--    ter um fim combinado (ex.: reabrir até meio-dia porque muita gente vinculou a conta
--    depois). Vazio = prazo normal. Só o sistema grava essa coluna.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS avaliacao_ate TIMESTAMPTZ;

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
      AND COALESCE(m.avaliacao_ate, m.finalizada_em + public.janela_de_avaliacao()) > now()
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
    AND COALESCE(m.avaliacao_ate, m.finalizada_em + public.janela_de_avaliacao(), now()) <= now();
  GET DIAGNOSTICS v_fechadas = ROW_COUNT;
  RETURN v_fechadas;
END;
$$;

-- 2. CONTAGEM AO FINALIZAR. "Peladas jogadas" e os 10 XP da pelada só eram recalculados
--    quando a presença da pessoa mudava. Quem confirmou antes de a pelada ser finalizada
--    (o caso normal) ficava sem a pelada no perfil até acontecer outra coisa com ele.
--    Agora, finalizou a pelada, recalcula todo mundo que jogou.
CREATE OR REPLACE FUNCTION public.matches_recalcula_quem_jogou()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET peladas_jogadas = (
        SELECT count(*) FROM public.match_participants mp
        JOIN public.matches m ON m.id = mp.match_id
        WHERE mp.user_id = p.id AND mp.status = 'aprovado' AND m.status = 'finalizada'
      ),
      xp = public.calcular_xp(p.id)
  WHERE p.id IN (
    SELECT mp.user_id FROM public.match_participants mp
    WHERE mp.match_id = NEW.id AND mp.status = 'aprovado'
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_recalcula_quem_jogou() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS matches_recalcula_quem_jogou ON public.matches;
CREATE TRIGGER matches_recalcula_quem_jogou
AFTER UPDATE OF status, finalizada_em ON public.matches
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.finalizada_em IS DISTINCT FROM OLD.finalizada_em)
EXECUTE FUNCTION public.matches_recalcula_quem_jogou();

-- quem já estava com a contagem atrasada: acerta agora
UPDATE public.profiles p
SET peladas_jogadas = r.n, xp = public.calcular_xp(p.id)
FROM (
  SELECT pr.id, (
    SELECT count(*) FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE mp.user_id = pr.id AND mp.status = 'aprovado' AND m.status = 'finalizada'
  ) AS n
  FROM public.profiles pr
) r
WHERE r.id = p.id AND (p.peladas_jogadas <> r.n OR p.xp <> public.calcular_xp(p.id));
