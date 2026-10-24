// Abre o pagamento do Premium no Stripe (Checkout de assinatura) pra pessoa logada.
//
// Recebe { plano: "mensal" | "anual", origem }. Até 30/11/2026 o mensal sai com o cupom do
// lançamento (1º mês por R$ 0,99), uma vez por pessoa. Se ela já tem assinatura ativa, devolve
// o portal em vez de cobrar de novo.
//
// Segredo necessário: STRIPE_SECRET_KEY.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRECOS = {
  mensal: "goating_premium_mensal",
  anual: "goating_premium_anual",
} as const;
const CUPOM_LANCAMENTO = "LANCAMENTO099";
/** 30/11/2026 às 23h59 de Brasília */
const FIM_DA_PROMOCAO = Date.parse("2026-11-30T23:59:59-03:00");
/**
 * pra onde o Stripe pode mandar a pessoa de volta (o site e o app em desenvolvimento); o
 * endereço antigo da Vercel continua aceito durante a troca de domínio
 */
const ORIGENS = [
  "https://goating.com.br",
  "https://goating-kappa.vercel.app",
  "http://localhost:5173",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const banco = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: sessao } = await banco.auth.getUser(token);
  const usuario = sessao.user;
  if (!usuario) return resposta({ erro: "Entre na sua conta pra assinar." }, 401);

  const { plano, origem } = (await req.json().catch(() => ({}))) as {
    plano?: string;
    origem?: string;
  };
  if (plano !== "mensal" && plano !== "anual") return resposta({ erro: "Plano inválido." }, 400);
  const site = ORIGENS.includes(origem ?? "") ? origem! : ORIGENS[0]!;

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // cliente no Stripe: um por pessoa, guardado na tabela assinaturas
  const { data: assinatura } = await banco
    .from("assinaturas")
    .select("stripe_customer_id, status, usou_promocao")
    .eq("user_id", usuario.id)
    .maybeSingle();
  let cliente = assinatura?.stripe_customer_id;
  if (!cliente) {
    const novo = await stripe.customers.create({
      email: usuario.email,
      metadata: { user_id: usuario.id },
    });
    cliente = novo.id;
    await banco.from("assinaturas").insert({ user_id: usuario.id, stripe_customer_id: cliente });
  }

  // já assina: manda pro portal em vez de cobrar duas vezes
  if (assinatura && ["active", "trialing", "past_due"].includes(assinatura.status)) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: cliente,
      return_url: `${site}/premium`,
    });
    return resposta({ url: portal.url, jaAssina: true });
  }

  const precos = await stripe.prices.list({ lookup_keys: [PRECOS[plano]], active: true });
  const preco = precos.data[0];
  if (!preco) return resposta({ erro: "Preço não encontrado." }, 500);

  const comPromocao =
    plano === "mensal" && Date.now() <= FIM_DA_PROMOCAO && !assinatura?.usou_promocao;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: cliente,
    line_items: [{ price: preco.id, quantity: 1 }],
    ...(comPromocao ? { discounts: [{ coupon: CUPOM_LANCAMENTO }] } : {}),
    payment_method_types: ["card"],
    locale: "pt-BR",
    client_reference_id: usuario.id,
    subscription_data: { metadata: { user_id: usuario.id, plano } },
    metadata: { user_id: usuario.id, plano },
    success_url: `${site}/premium?assinou=1`,
    cancel_url: `${site}/premium`,
  });
  return resposta({ url: checkout.url });
});
