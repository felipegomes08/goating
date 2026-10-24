-- Assinaturas do Premium pelo Stripe. O Premium continua sendo profiles.plano + premium_ate;
-- quem cuida desses campos agora é a cobrança (funções criar-assinatura e stripe-webhook).

-- 1. UMA LINHA POR PESSOA: o cliente e a assinatura dela no Stripe
CREATE TABLE IF NOT EXISTS public.assinaturas (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plano TEXT CHECK (plano IN ('mensal', 'anual')),
  status TEXT NOT NULL DEFAULT 'sem_assinatura',
  periodo_fim TIMESTAMPTZ,
  cancela_no_fim BOOLEAN NOT NULL DEFAULT false,
  usou_promocao BOOLEAN NOT NULL DEFAULT false,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assinaturas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
DROP POLICY IF EXISTS assinaturas_ler_a_sua ON public.assinaturas;
CREATE POLICY assinaturas_ler_a_sua ON public.assinaturas
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. O STRIPE AVISOU: guarda a assinatura, liga ou desliga o Premium e avisa no sino.
--    Chamada só pela função stripe-webhook (chave de serviço).
CREATE OR REPLACE FUNCTION public.sincronizar_assinatura(
  p_user UUID,
  p_customer TEXT,
  p_subscription TEXT,
  p_plano TEXT,
  p_status TEXT,
  p_periodo_fim TIMESTAMPTZ,
  p_cancela_no_fim BOOLEAN,
  p_usou_promocao BOOLEAN,
  p_aviso TEXT DEFAULT NULL,     -- 'novo' | 'renovou' | 'falhou'
  p_chave TEXT DEFAULT NULL      -- pra o mesmo aviso não sair duas vezes
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ativa BOOLEAN := p_status IN ('active', 'trialing', 'past_due');
  manual BOOLEAN;
BEGIN
  INSERT INTO public.assinaturas AS a (
    user_id, stripe_customer_id, stripe_subscription_id, plano, status, periodo_fim,
    cancela_no_fim, usou_promocao, atualizado_em
  )
  VALUES (
    p_user, p_customer, p_subscription, p_plano, p_status, p_periodo_fim,
    COALESCE(p_cancela_no_fim, false), COALESCE(p_usou_promocao, false), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plano = EXCLUDED.plano,
    status = EXCLUDED.status,
    periodo_fim = EXCLUDED.periodo_fim,
    cancela_no_fim = EXCLUDED.cancela_no_fim,
    -- usou a promoção uma vez, fica marcado pra sempre
    usou_promocao = a.usou_promocao OR EXCLUDED.usou_promocao,
    atualizado_em = now();

  -- Premium ligado à mão (sem data de fim) não é mexido pela cobrança
  SELECT plano = 'premium' AND premium_ate IS NULL INTO manual
  FROM public.profiles WHERE id = p_user;

  IF NOT COALESCE(manual, false) THEN
    IF ativa THEN
      -- 2 dias de folga: a renovação do cartão pode atrasar um pouco
      UPDATE public.profiles
      SET plano = 'premium', premium_ate = p_periodo_fim + interval '2 days'
      WHERE id = p_user;
    ELSIF p_status = 'canceled' THEN
      -- cancelada: vale até o fim do que já foi pago
      UPDATE public.profiles
      SET premium_ate = LEAST(COALESCE(premium_ate, p_periodo_fim), p_periodo_fim)
      WHERE id = p_user AND plano = 'premium';
    ELSIF p_status IN ('unpaid', 'incomplete_expired') THEN
      UPDATE public.profiles SET premium_ate = now() WHERE id = p_user AND plano = 'premium';
    END IF;
  END IF;

  IF p_aviso = 'novo' THEN
    PERFORM public.notificar(p_user, 'premium', 'Bem-vindo ao Premium 👑',
      'Sua carta completa, molduras e o ranking inteiro já estão liberados.', '/perfil',
      p_chave, true);
  ELSIF p_aviso = 'renovou' THEN
    PERFORM public.notificar(p_user, 'premium', 'Seu Premium foi renovado 👑',
      'Valeu por continuar no Goating Premium.', '/premium', p_chave, true);
  ELSIF p_aviso = 'falhou' THEN
    PERFORM public.notificar(p_user, 'premium', 'Não conseguimos cobrar seu cartão',
      'Atualize o cartão pra não perder o Premium.', '/premium', p_chave, true);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sincronizar_assinatura(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_assinatura(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO service_role;
