-- Denunciar mensagem e bloquear pessoa no chat da turma (exigência das lojas pra app com
-- conteúdo escrito pelos usuários).
--
-- Denúncia: entra na tabela denuncias (a mesma dos comentários), os gestores da turma recebem
-- aviso e, com 3 denúncias de pessoas diferentes, a mensagem some pra todo mundo.
-- Bloqueio: as mensagens de quem você bloqueou não aparecem pra você e não te avisam no celular.

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_tipo_check;
ALTER TABLE public.denuncias ADD CONSTRAINT denuncias_tipo_check
  CHECK (tipo IN ('comentario_jogador', 'comentario_turma', 'mensagem_chat'));

CREATE OR REPLACE FUNCTION public.denunciar_mensagem(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.mensagens_da_turma;
  v_turma text;
  v_qtd int;
  u uuid;
BEGIN
  SELECT * INTO v_msg FROM public.mensagens_da_turma WHERE id = p_id;
  IF v_msg.id IS NULL OR v_msg.apagada_em IS NOT NULL OR NOT public.membro_da_turma(v_msg.crew_id) THEN
    RAISE EXCEPTION 'Essa mensagem não existe mais.';
  END IF;
  IF v_msg.autor_id = v_uid THEN
    RAISE EXCEPTION 'Essa mensagem é sua. Se quiser, é só apagar.';
  END IF;
  IF (SELECT count(*) FROM public.denuncias d
      WHERE d.denunciante_id = v_uid AND d.criado_em > now() - interval '24 hours') >= 15 THEN
    RAISE EXCEPTION 'Você já denunciou bastante por hoje. Tenta de novo amanhã.';
  END IF;

  INSERT INTO public.denuncias (tipo, alvo_id, denunciante_id, motivo)
  VALUES ('mensagem_chat', p_id, v_uid, nullif(btrim(left(p_motivo, 200)), ''))
  ON CONFLICT (tipo, alvo_id, denunciante_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 3 pessoas diferentes denunciaram: a mensagem some pra todo mundo
  SELECT count(*) INTO v_qtd FROM public.denuncias
  WHERE tipo = 'mensagem_chat' AND alvo_id = p_id;
  IF v_qtd >= 3 THEN
    UPDATE public.mensagens_da_turma SET apagada_em = now(), texto = NULL, dados = NULL
    WHERE id = p_id AND apagada_em IS NULL;
  END IF;

  -- os gestores da turma ficam sabendo (e podem apagar a mensagem ou tirar a pessoa)
  SELECT nome INTO v_turma FROM public.crews WHERE id = v_msg.crew_id;
  FOR u IN
    SELECT c.dono_id FROM public.crews c WHERE c.id = v_msg.crew_id
    UNION
    SELECT cm.user_id FROM public.crew_members cm
    WHERE cm.crew_id = v_msg.crew_id AND cm.admin AND cm.user_id IS NOT NULL AND cm.removido_em IS NULL
  LOOP
    IF u IS DISTINCT FROM v_msg.autor_id THEN
      PERFORM public.notificar(u, 'denuncia_chat', 'Mensagem denunciada no chat da ' || v_turma,
        CASE WHEN v_qtd >= 3 THEN 'Ela teve 3 denúncias e foi escondida.'
             ELSE 'Dá uma olhada e, se precisar, apague.' END,
        '/turma/' || v_msg.crew_id || '/chat', 'denuncia:' || p_id);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.denunciar_mensagem(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.denunciar_mensagem(uuid, text) TO authenticated;

-- quem cada um bloqueou (só a própria pessoa vê e mexe)
CREATE TABLE public.bloqueios (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  bloqueado_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bloqueado_id),
  CHECK (user_id <> bloqueado_id)
);
ALTER TABLE public.bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY bloqueios_select_own ON public.bloqueios
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY bloqueios_insert_own ON public.bloqueios
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY bloqueios_delete_own ON public.bloqueios
  FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.bloqueios FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.bloqueios TO authenticated;

-- mensagem de quem você bloqueou não conta como não lida
CREATE OR REPLACE FUNCTION public.chats_nao_lidos()
RETURNS TABLE(crew_id uuid, nao_lidas integer, silenciado boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH minhas AS (
    SELECT c.id,
      COALESCE(
        l.lida_ate,
        (SELECT min(cm.criado_em) FROM public.crew_members cm
         WHERE cm.crew_id = c.id AND cm.user_id = auth.uid()),
        c.criado_em
      ) AS desde,
      COALESCE(l.silenciado, false) AS silenciado
    FROM public.crews c
    LEFT JOIN public.chat_da_turma_leitura l ON l.crew_id = c.id AND l.user_id = auth.uid()
    WHERE public.membro_da_turma(c.id)
  )
  SELECT t.id,
    (SELECT count(*) FROM public.mensagens_da_turma m
     WHERE m.crew_id = t.id AND m.criado_em > t.desde AND m.apagada_em IS NULL
       AND m.autor_id IS DISTINCT FROM auth.uid()
       AND NOT EXISTS (
         SELECT 1 FROM public.bloqueios b
         WHERE b.user_id = auth.uid() AND b.bloqueado_id = m.autor_id
       ))::integer,
    t.silenciado
  FROM minhas t;
$$;
