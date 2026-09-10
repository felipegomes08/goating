-- 1. Corrige a política de entrada em peladas (comparava o status da pelada em vez do status do participante)
DROP POLICY IF EXISTS participants_insert_self ON public.match_participants;

CREATE POLICY participants_insert_self ON public.match_participants
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_participants.match_id
      AND m.status = 'agendada'
      AND (
        (m.tipo = 'aberta' AND match_participants.status = 'aprovado')
        OR (m.tipo = 'fechada' AND match_participants.status = 'pendente')
        OR m.organizador_id = auth.uid()
      )
      AND (
        SELECT count(*) FROM public.match_participants p
        WHERE p.match_id = m.id AND p.status = 'aprovado'
      ) < m.quantidade_vagas
  )
);

-- 2. Contabiliza MVP no perfil quando o organizador elege o melhor da partida
CREATE OR REPLACE FUNCTION public.contabilizar_mvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mvp_id IS DISTINCT FROM OLD.mvp_id THEN
    IF OLD.mvp_id IS NOT NULL THEN
      UPDATE public.profiles SET vezes_mvp = GREATEST(0, vezes_mvp - 1) WHERE id = OLD.mvp_id;
    END IF;
    IF NEW.mvp_id IS NOT NULL THEN
      UPDATE public.profiles SET vezes_mvp = vezes_mvp + 1 WHERE id = NEW.mvp_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.contabilizar_mvp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_mvp_count ON public.matches;
CREATE TRIGGER matches_mvp_count
AFTER UPDATE OF mvp_id ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.contabilizar_mvp();