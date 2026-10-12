-- Quem está no elenco de uma pelada e tem conta passa a contar como presença confirmada.
--
-- O perfil (peladas jogadas, XP), o direito de avaliar e a aba "Finalizadas" olham a lista
-- de presenças confirmadas (match_participants). Só que o organizador monta o elenco pela
-- lista do WhatsApp, e esse elenco (match_players) é ligado ao jogador da turma, não à conta.
-- Resultado: quem jogou pela lista e depois vinculou a conta aparecia no ranking da turma,
-- mas ficava com 0 peladas no perfil.
--
-- Agora as duas listas andam juntas: entrou no elenco com conta, ou vinculou a conta a um
-- jogador que já tinha jogado, vira presença confirmada naquelas peladas.

-- confirma a presença, na pelada, da conta ligada a um jogador do elenco
CREATE OR REPLACE FUNCTION public.confirmar_presenca_do_elenco(p_member_id UUID, p_match_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.match_participants (match_id, user_id, status)
  SELECT mp.match_id, cm.user_id, 'aprovado'
  FROM public.match_players mp
  JOIN public.crew_members cm ON cm.id = mp.member_id
  WHERE mp.member_id = p_member_id
    AND cm.user_id IS NOT NULL
    AND (p_match_id IS NULL OR mp.match_id = p_match_id)
  ON CONFLICT (match_id, user_id) DO UPDATE SET status = 'aprovado'
  WHERE public.match_participants.status <> 'aprovado';
$$;
REVOKE ALL ON FUNCTION public.confirmar_presenca_do_elenco(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- 1. entrou no elenco de uma pelada
CREATE OR REPLACE FUNCTION public.match_players_confirma_presenca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.confirmar_presenca_do_elenco(NEW.member_id, NEW.match_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.match_players_confirma_presenca() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS match_players_confirma_presenca ON public.match_players;
CREATE TRIGGER match_players_confirma_presenca
AFTER INSERT ON public.match_players
FOR EACH ROW EXECUTE FUNCTION public.match_players_confirma_presenca();

-- 2. o jogador da turma ganhou uma conta (vinculou, ou entrou na turma escolhendo o próprio nome)
CREATE OR REPLACE FUNCTION public.crew_members_confirma_presencas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    PERFORM public.confirmar_presenca_do_elenco(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crew_members_confirma_presencas() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crew_members_confirma_presencas ON public.crew_members;
CREATE TRIGGER crew_members_confirma_presencas
AFTER UPDATE OF user_id ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.crew_members_confirma_presencas();

-- 3. quem já estava nessa situação: acerta agora (os gatilhos das presenças recalculam
--    peladas jogadas e XP de cada um)
INSERT INTO public.match_participants (match_id, user_id, status)
SELECT mp.match_id, cm.user_id, 'aprovado'
FROM public.match_players mp
JOIN public.crew_members cm ON cm.id = mp.member_id
WHERE cm.user_id IS NOT NULL
ON CONFLICT (match_id, user_id) DO UPDATE SET status = 'aprovado'
WHERE public.match_participants.status <> 'aprovado';
