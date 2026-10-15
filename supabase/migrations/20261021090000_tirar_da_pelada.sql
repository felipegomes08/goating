-- O organizador (ou um administrador da turma) tira da pelada alguém que confirmou e
-- depois avisou que não vai. Sai da lista de confirmados e do elenco do dia de uma vez,
-- senão a tela de times traria a pessoa de volta (quem confirma entra no elenco sozinho).
CREATE OR REPLACE FUNCTION public.tirar_da_pelada(p_match_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma tira alguém da pelada.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches m WHERE m.id = p_match_id AND m.status = 'finalizada') THEN
    RAISE EXCEPTION 'A pelada já foi finalizada: quem jogou fica no histórico.';
  END IF;

  DELETE FROM public.match_participants WHERE match_id = p_match_id AND user_id = p_user_id;
  DELETE FROM public.match_players mp
  USING public.crew_members cm
  WHERE mp.match_id = p_match_id AND cm.id = mp.member_id AND cm.user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tirar_da_pelada(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tirar_da_pelada(UUID, UUID) TO authenticated;
