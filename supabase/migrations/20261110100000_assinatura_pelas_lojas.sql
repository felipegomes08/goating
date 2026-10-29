-- Premium comprado dentro do app, pela Google Play ou pela App Store (via RevenueCat).
--
-- O site continua cobrando pelo Stripe (tabela assinaturas). No app, a compra é da loja: o
-- RevenueCat avisa a função revenuecat-webhook, que confere a assinatura direto com ele e
-- chama sincronizar_assinatura_loja. O Premium vale até o mais tarde entre o Stripe e a loja.

CREATE TABLE public.assinaturas_lojas (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  loja text NOT NULL CHECK (loja IN ('app_store', 'play_store')),
  produto text,
  expira_em timestamptz,
  -- false = a pessoa cancelou a renovação (vale até expira_em)
  renova boolean NOT NULL DEFAULT true,
  problema_no_pagamento boolean NOT NULL DEFAULT false,
  teste boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assinaturas_lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinaturas_lojas_select_own ON public.assinaturas_lojas
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.assinaturas_lojas FROM anon, authenticated;
GRANT SELECT ON public.assinaturas_lojas TO authenticated;

-- Grava o estado da assinatura da loja e recalcula o fim do Premium. Só a função do servidor
-- (chave de serviço) chama.
CREATE OR REPLACE FUNCTION public.sincronizar_assinatura_loja(
  p_user uuid,
  p_loja text,
  p_produto text,
  p_expira_em timestamptz,
  p_renova boolean,
  p_problema boolean,
  p_teste boolean,
  p_aviso text DEFAULT NULL,
  p_chave text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manual boolean;
  v_fim_stripe timestamptz;
  v_fim_loja timestamptz;
  v_nome_loja text := CASE p_loja WHEN 'app_store' THEN 'App Store' ELSE 'Google Play' END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN
    RETURN;
  END IF;

  INSERT INTO public.assinaturas_lojas AS a
    (user_id, loja, produto, expira_em, renova, problema_no_pagamento, teste, atualizado_em)
  VALUES (p_user, p_loja, p_produto, p_expira_em, COALESCE(p_renova, true),
          COALESCE(p_problema, false), COALESCE(p_teste, false), now())
  ON CONFLICT (user_id) DO UPDATE SET
    loja = EXCLUDED.loja,
    produto = EXCLUDED.produto,
    expira_em = EXCLUDED.expira_em,
    renova = EXCLUDED.renova,
    problema_no_pagamento = EXCLUDED.problema_no_pagamento,
    teste = EXCLUDED.teste,
    atualizado_em = now();

  -- Premium ligado à mão (sem data de fim) não é mexido pela cobrança
  SELECT plano = 'premium' AND premium_ate IS NULL INTO manual
  FROM public.profiles WHERE id = p_user;

  IF NOT COALESCE(manual, false) THEN
    -- o que o Stripe garante (assinatura do site ainda valendo)
    SELECT CASE
             WHEN s.status IN ('active', 'trialing', 'past_due') THEN s.periodo_fim + interval '2 days'
             WHEN s.status = 'canceled' THEN s.periodo_fim
           END
    INTO v_fim_stripe
    FROM public.assinaturas s WHERE s.user_id = p_user;

    -- 1 dia de folga na loja: a renovação pode chegar com um pouco de atraso
    v_fim_loja := p_expira_em + CASE WHEN COALESCE(p_renova, true) THEN interval '1 day' ELSE interval '0' END;

    UPDATE public.profiles
    SET plano = 'premium',
        premium_ate = GREATEST(COALESCE(v_fim_stripe, v_fim_loja), COALESCE(v_fim_loja, v_fim_stripe))
    WHERE id = p_user AND (v_fim_loja IS NOT NULL OR v_fim_stripe IS NOT NULL);
  END IF;

  IF p_aviso = 'novo' THEN
    PERFORM public.notificar(p_user, 'premium', 'Bem-vindo ao Premium 👑',
      'Sua carta completa, molduras e o ranking inteiro já estão liberados.', '/perfil',
      p_chave, true);
  ELSIF p_aviso = 'renovou' THEN
    PERFORM public.notificar(p_user, 'premium', 'Seu Premium foi renovado 👑',
      'Valeu por continuar no Goating Premium.', '/premium', p_chave, true);
  ELSIF p_aviso = 'falhou' THEN
    PERFORM public.notificar(p_user, 'premium', 'O pagamento do Premium não passou',
      'Confira a forma de pagamento na ' || v_nome_loja || ' pra não perder o Premium.',
      '/premium', p_chave, true);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sincronizar_assinatura_loja(uuid, text, text, timestamptz, boolean, boolean, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_assinatura_loja(uuid, text, text, timestamptz, boolean, boolean, boolean, text, text)
  TO service_role;
