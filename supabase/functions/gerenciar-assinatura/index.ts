// Leva a pessoa logada pro Portal do cliente do Stripe: cancelar, trocar o cartão, ver faturas.
//
// Recebe { origem } (pra onde voltar). Segredo necessário: STRIPE_SECRET_KEY.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

// o endereço antigo da Vercel continua aceito durante a troca de domínio
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
  if (!sessao.user) return resposta({ erro: "Entre na sua conta." }, 401);

  const { origem } = (await req.json().catch(() => ({}))) as { origem?: string };
  const site = ORIGENS.includes(origem ?? "") ? origem! : ORIGENS[0]!;

  const { data: assinatura } = await banco
    .from("assinaturas")
    .select("stripe_customer_id")
    .eq("user_id", sessao.user.id)
    .maybeSingle();
  if (!assinatura) return resposta({ erro: "Você ainda não tem assinatura." }, 404);

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const portal = await stripe.billingPortal.sessions.create({
    customer: assinatura.stripe_customer_id,
    return_url: `${site}/premium`,
  });
  return resposta({ url: portal.url });
});
