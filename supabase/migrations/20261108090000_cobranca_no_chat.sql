-- Cobrança da pelada no chat da turma.
--
-- Depois da pelada, o organizador ou ADM manda a cobrança (valor por pessoa e, se quiser, a
-- chave Pix). Ela vira uma mensagem do tipo 'pagamento' com { valor, pix } em dados, e o cartão
-- mostra quem jogou e quem já pagou. Só o organizador ou ADM marca e desmarca o pago.
--
-- Quem entra na cobrança: o elenco do dia (match_players), que inclui jogador sem conta. Sem
-- elenco montado, os confirmados na pelada que estão na turma.

CREATE TABLE public.pagamentos_da_pelada (
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.crew_members (id) ON DELETE CASCADE,
  -- nulo = marcado e depois desmarcado (a linha fica pra a mudança chegar em tempo real)
  pago_em timestamptz,
  marcado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  PRIMARY KEY (match_id, member_id)
);
ALTER TABLE public.pagamentos_da_pelada ENABLE ROW LEVEL SECURITY;
CREATE POLICY pagamentos_select_turma ON public.pagamentos_da_pelada
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = pagamentos_da_pelada.match_id AND m.crew_id IS NOT NULL
      AND public.membro_da_turma(m.crew_id)
  ));
REVOKE ALL ON public.pagamentos_da_pelada FROM anon, authenticated;
GRANT SELECT ON public.pagamentos_da_pelada TO authenticated;

-- quem entra na cobrança da pelada (ids de crew_members)
CREATE OR REPLACE FUNCTION public.quem_paga(p_match_id uuid)
RETURNS TABLE(member_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mp.member_id FROM public.match_players mp WHERE mp.match_id = p_match_id
  UNION
  SELECT cm.id
  FROM public.match_participants p
  JOIN public.matches m ON m.id = p.match_id
  JOIN public.crew_members cm ON cm.crew_id = m.crew_id AND cm.user_id = p.user_id
  WHERE p.match_id = p_match_id AND p.status = 'aprovado'
    AND NOT EXISTS (SELECT 1 FROM public.match_players x WHERE x.match_id = p_match_id);
$$;
REVOKE ALL ON FUNCTION public.quem_paga(uuid) FROM PUBLIC, anon, authenticated;

-- o organizador ou ADM manda a cobrança no chat (valor por pessoa em centavos, Pix opcional)
CREATE OR REPLACE FUNCTION public.enviar_cobranca(p_match_id uuid, p_valor integer, p_pix text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
  v_pix text := NULLIF(btrim(COALESCE(p_pix, '')), '');
  v_id uuid;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF m.id IS NULL OR m.crew_id IS NULL THEN
    RAISE EXCEPTION 'Essa pelada não é de uma turma.';
  END IF;
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma cobra a pelada.';
  END IF;
  IF m.status <> 'finalizada' THEN
    RAISE EXCEPTION 'A cobrança vai depois que a pelada termina.';
  END IF;
  IF p_valor IS NULL OR p_valor < 100 OR p_valor > 100000 THEN
    RAISE EXCEPTION 'Valor por pessoa entre R$ 1,00 e R$ 1.000,00.';
  END IF;
  IF v_pix IS NOT NULL AND char_length(v_pix) > 140 THEN
    RAISE EXCEPTION 'Chave Pix grande demais.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quem_paga(p_match_id)) THEN
    RAISE EXCEPTION 'Ninguém jogou essa pelada pra cobrar.';
  END IF;
  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id, dados)
  VALUES (m.crew_id, auth.uid(), 'pagamento', p_match_id,
          jsonb_build_object('valor', p_valor, 'pix', v_pix))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- o organizador ou ADM marca (ou desmarca) quem pagou
CREATE OR REPLACE FUNCTION public.marcar_pago(p_match_id uuid, p_member_id uuid, p_pago boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.gere_pelada(p_match_id) THEN
    RAISE EXCEPTION 'Só o organizador ou um administrador da turma marca o pagamento.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quem_paga(p_match_id) q WHERE q.member_id = p_member_id) THEN
    RAISE EXCEPTION 'Esse jogador não está na cobrança dessa pelada.';
  END IF;
  INSERT INTO public.pagamentos_da_pelada (match_id, member_id, pago_em, marcado_por)
  VALUES (p_match_id, p_member_id, CASE WHEN p_pago THEN now() END, auth.uid())
  ON CONFLICT (match_id, member_id) DO UPDATE
    SET pago_em = CASE WHEN p_pago THEN COALESCE(pagamentos_da_pelada.pago_em, now()) END,
        marcado_por = auth.uid();
END;
$$;

-- o cartão da cobrança: a pelada e cada jogador com o pago (ou não)
CREATE OR REPLACE FUNCTION public.cobranca_da_pelada(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT * FROM public.matches
    WHERE id = p_match_id AND crew_id IS NOT NULL AND public.membro_da_turma(crew_id)
  )
  SELECT jsonb_build_object(
    'pelada', jsonb_build_object('id', m.id, 'titulo', m.titulo, 'data', m.data),
    'pode_marcar', public.gere_pelada(m.id),
    'pessoas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', cm.id, 'nome', cm.nome, 'user_id', cm.user_id, 'pago_em', pg.pago_em
      ) ORDER BY pg.pago_em IS NULL, pg.pago_em, cm.nome)
      FROM public.quem_paga(m.id) q
      JOIN public.crew_members cm ON cm.id = q.member_id
      LEFT JOIN public.pagamentos_da_pelada pg ON pg.match_id = m.id AND pg.member_id = cm.id
    ), '[]'::jsonb)
  )
  FROM m;
$$;

REVOKE ALL ON FUNCTION public.enviar_cobranca(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marcar_pago(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cobranca_da_pelada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_cobranca(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_pago(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cobranca_da_pelada(uuid) TO authenticated;

-- o ✓ de pago aparece na hora pra todo mundo
ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_da_pelada;
