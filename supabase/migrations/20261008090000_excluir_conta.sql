-- Excluir a própria conta (exigência da App Store e da Play Store para apps com cadastro).
--
-- Apagar o usuário em auth.users leva junto, por cascata: perfil, presenças,
-- avaliações dadas e recebidas, seguidores e as peladas que ele organizou.
-- O que NÃO pode sumir junto é a história dos outros:
--
-- - Nas turmas em que ele só jogava, o jogador vira "sem conta": o nome e os
--   números ficam no ranking (crew_members.user_id já é ON DELETE SET NULL).
-- - Turma da qual ele é dono e que tem mais alguém com conta: passa pra um
--   administrador (ou, sem admin, pro jogador com conta mais antigo), junto com
--   as peladas dela. Ninguém perde o ranking porque o dono saiu.
-- - Turma só dele (ninguém mais com conta): é apagada com ele.
--
-- As fotos do perfil ficam num bucket de arquivos; quem apaga é o app, antes de
-- chamar esta função (apagar arquivo por SQL deixa lixo no armazenamento).

CREATE OR REPLACE FUNCTION public.excluir_minha_conta()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_turma RECORD;
  v_herdeiro UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para excluí-la.';
  END IF;

  FOR v_turma IN SELECT c.id FROM public.crews c WHERE c.dono_id = v_uid LOOP
    SELECT cm.user_id INTO v_herdeiro
    FROM public.crew_members cm
    WHERE cm.crew_id = v_turma.id AND cm.user_id IS NOT NULL AND cm.user_id <> v_uid
    ORDER BY cm.admin DESC, cm.criado_em ASC
    LIMIT 1;

    -- sem herdeiro a turma cai na cascata, junto com as peladas dela
    IF v_herdeiro IS NOT NULL THEN
      UPDATE public.crews SET dono_id = v_herdeiro WHERE id = v_turma.id;
      UPDATE public.crew_members SET admin = false
      WHERE crew_id = v_turma.id AND user_id = v_herdeiro;
      UPDATE public.matches SET organizador_id = v_herdeiro
      WHERE crew_id = v_turma.id AND organizador_id = v_uid;
    END IF;
  END LOOP;

  -- pelada que ele criou em turma de outra pessoa (era admin): fica com o dono da turma
  UPDATE public.matches m SET organizador_id = c.dono_id
  FROM public.crews c
  WHERE m.crew_id = c.id AND m.organizador_id = v_uid AND c.dono_id <> v_uid;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
REVOKE ALL ON FUNCTION public.excluir_minha_conta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta() TO authenticated;
