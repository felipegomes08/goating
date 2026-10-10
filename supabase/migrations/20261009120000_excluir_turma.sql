-- Excluir uma turma (só o dono) sem tirar de ninguém o que já foi jogado.
--
-- Apagar a linha da turma levava os jogadores em cascata e, com eles, o elenco e os autores
-- dos gols das peladas antigas. Então a turma é só marcada como excluída e some do app:
--   - as peladas que ainda não aconteceram são apagadas;
--   - as finalizadas ficam, soltas da turma, com placar, elenco, gols, avaliações e XP;
--   - os jogadores continuam guardados só pra essas peladas antigas saberem quem jogou.

ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS excluida_em TIMESTAMPTZ;

-- turma excluída não aparece em lugar nenhum (lista de turmas, página, nome no feed)
DROP POLICY IF EXISTS "crews_select_auth" ON public.crews;
CREATE POLICY "crews_select_auth" ON public.crews FOR SELECT TO authenticated
  USING (excluida_em IS NULL);

CREATE OR REPLACE FUNCTION public.excluir_turma(p_crew_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = p_crew_id AND c.dono_id = auth.uid() AND c.excluida_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Só o dono exclui a turma.';
  END IF;
  DELETE FROM public.matches WHERE crew_id = p_crew_id AND status <> 'finalizada';
  UPDATE public.matches SET crew_id = NULL WHERE crew_id = p_crew_id;
  UPDATE public.crew_members SET admin = false WHERE crew_id = p_crew_id AND admin;
  UPDATE public.crews SET excluida_em = now() WHERE id = p_crew_id;
END;
$$;
REVOKE ALL ON FUNCTION public.excluir_turma(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_turma(UUID) TO authenticated;

-- dono ou admin de turma excluída não gere mais nada nela
CREATE OR REPLACE FUNCTION public.gere_turma(p_crew_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
        SELECT 1 FROM public.crews c
        WHERE c.id = p_crew_id AND c.dono_id = auth.uid() AND c.excluida_em IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.crew_members cm
        JOIN public.crews c ON c.id = cm.crew_id
        WHERE cm.crew_id = p_crew_id AND cm.user_id = auth.uid() AND cm.admin
          AND c.excluida_em IS NULL
      );
$function$;
