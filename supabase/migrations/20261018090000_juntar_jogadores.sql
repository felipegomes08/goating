-- Juntar dois jogadores da turma que são a mesma pessoa (cadastro duplicado: a lista veio
-- com o nome escrito de outro jeito, ou criaram o mesmo nome duas vezes). O histórico de um
-- (peladas, jogos e gols) passa pro outro, e o cadastro que ficou vazio some.
--
-- Só o dono ou um administrador da turma. O que some tem que ser um jogador sem conta:
-- pra juntar com uma conta existe o "vincular conta". Não junta quem aparece na mesma
-- pelada, porque aí são duas pessoas.
CREATE OR REPLACE FUNCTION public.juntar_membros(p_origem UUID, p_destino UUID)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew UUID;
BEGIN
  IF p_origem = p_destino THEN
    RAISE EXCEPTION 'Escolha outro jogador pra juntar.';
  END IF;

  SELECT cm.crew_id INTO v_crew
  FROM public.crew_members cm
  WHERE cm.id = p_origem AND cm.user_id IS NULL AND public.gere_turma(cm.crew_id);
  IF v_crew IS NULL THEN
    RAISE EXCEPTION 'Só o dono ou um administrador junta jogadores, e o que some precisa ser um jogador sem conta.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crew_members cm WHERE cm.id = p_destino AND cm.crew_id = v_crew) THEN
    RAISE EXCEPTION 'Os dois jogadores precisam ser da mesma turma.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players a
    JOIN public.match_players b ON b.match_id = a.match_id
    WHERE a.member_id = p_origem AND b.member_id = p_destino
  ) THEN
    RAISE EXCEPTION 'Os dois aparecem na mesma pelada: não são a mesma pessoa.';
  END IF;

  -- (se o que fica tem conta, o gatilho do elenco já confirma a presença dele nessas peladas)
  UPDATE public.match_players SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.game_players SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.goals SET member_id = p_destino WHERE member_id = p_origem;
  UPDATE public.crew_members d
  SET posicao = COALESCE(d.posicao, o.posicao),
      estrelas = COALESCE(d.estrelas, o.estrelas),
      removido_em = NULL
  FROM public.crew_members o
  WHERE d.id = p_destino AND o.id = p_origem;
  DELETE FROM public.crew_members WHERE id = p_origem;
  RETURN p_destino;
END;
$$;
REVOKE ALL ON FUNCTION public.juntar_membros(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.juntar_membros(UUID, UUID) TO authenticated;
