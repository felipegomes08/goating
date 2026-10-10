-- Jogador sem conta nunca é administrador.
--
-- Quando uma conta é excluída, o jogador dela vira "sem conta" (user_id nulo) em cada
-- turma. Se ele era admin, a marca ficava no nome solto — e quem fosse vinculado a esse
-- nome depois herdaria o cargo sem o dono ter dado. O gatilho fecha isso em qualquer
-- caminho que zere a conta do jogador (excluir conta, sair da turma, o que vier).

CREATE OR REPLACE FUNCTION public.crew_members_sem_conta_sem_admin()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.admin := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.crew_members_sem_conta_sem_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crew_members_sem_conta_sem_admin ON public.crew_members;
CREATE TRIGGER crew_members_sem_conta_sem_admin
BEFORE INSERT OR UPDATE ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.crew_members_sem_conta_sem_admin();
