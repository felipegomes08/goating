// Recebe os avisos do Stripe sobre as assinaturas e liga ou desliga o Premium no banco.
//
// Não precisa de login: só aceita aviso com a assinatura do Stripe (STRIPE_WEBHOOK_SECRET).
// Em cada aviso busca a assinatura atualizada no Stripe e chama sincronizar_assinatura.
//
// Segredos necessários: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const cripto = Stripe.createSubtleCryptoProvider();

const banco = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const idDe = (v: string | { id: string } | null | undefined) =>
  typeof v === "string" ? v : (v?.id ?? null);

/** Guarda a assinatura no banco e liga/desliga o Premium (com aviso opcional no sino). */
async function sincronizar(
  idDaAssinatura: string,
  aviso: "novo" | "renovou" | "falhou" | null,
  chave: string | null,
) {
  const sub = await stripe.subscriptions.retrieve(idDaAssinatura);
  const cliente = idDe(sub.customer)!;
  let usuario = sub.metadata?.["user_id"] ?? null;
  if (!usuario) {
    const { data } = await banco
      .from("assinaturas")
      .select("user_id")
      .eq("stripe_customer_id", cliente)
      .maybeSingle();
    usuario = data?.user_id ?? null;
  }
  if (!usuario) {
    console.error("assinatura sem dono", sub.id);
    return;
  }
  const item = sub.items.data[0];
  // nas versões novas da API o fim do período fica no item da assinatura
  const fim =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    Math.floor(Date.now() / 1000);
  const plano = item?.price.recurring?.interval === "year" ? "anual" : "mensal";
  const usouPromocao =
    (sub.discount?.coupon?.id ?? null) === "LANCAMENTO099" || (sub.discounts ?? []).length > 0;

  const { error } = await banco.rpc("sincronizar_assinatura", {
    p_user: usuario,
    p_customer: cliente,
    p_subscription: sub.id,
    p_plano: plano,
    p_status: sub.status,
    p_periodo_fim: new Date(fim * 1000).toISOString(),
    p_cancela_no_fim: sub.cancel_at_period_end,
    p_usou_promocao: usouPromocao,
    p_aviso: aviso,
    p_chave: chave,
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  const assinatura = req.headers.get("Stripe-Signature");
  const corpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(
      corpo,
      assinatura ?? "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cripto,
    );
  } catch {
    return new Response("assinatura do Stripe inválida", { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const sessao = evento.data.object;
        const sub = idDe(sessao.subscription);
        if (sub) await sincronizar(sub, "novo", `premium-novo-${sub}`);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await sincronizar(evento.data.object.id, null, null);
        break;
      case "invoice.paid": {
        const fatura = evento.data.object;
        const sub = idDe(
          (fatura as unknown as { subscription?: string | { id: string } }).subscription,
        );
        // só a renovação ganha aviso; a 1ª cobrança já tem o "Bem-vindo"
        const renovou = fatura.billing_reason === "subscription_cycle";
        if (sub) await sincronizar(sub, renovou ? "renovou" : null, `premium-fatura-${fatura.id}`);
        break;
      }
      case "invoice.payment_failed": {
        const fatura = evento.data.object;
        const sub = idDe(
          (fatura as unknown as { subscription?: string | { id: string } }).subscription,
        );
        if (sub) await sincronizar(sub, "falhou", `premium-falhou-${fatura.id}`);
        break;
      }
    }
  } catch (erro) {
    console.error(evento.type, erro);
    // 500: o Stripe tenta de novo mais tarde
    return new Response("erro ao processar", { status: 500 });
  }
  return new Response("ok");
});
