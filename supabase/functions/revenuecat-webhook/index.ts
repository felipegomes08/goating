// Recebe os avisos do RevenueCat sobre o Premium comprado no app (Google Play e App Store) e
// liga ou desliga o Premium no banco.
//
// Não confia no que vem no aviso: só usa ele pra saber QUEM mudou e busca o estado atual da
// assinatura direto na API do RevenueCat (assim a ordem dos avisos não importa).
//
// Segredos necessários (painel do Supabase > Edge Functions > Secrets):
//   REVENUECAT_WEBHOOK_SECRET = o mesmo texto colocado em "Authorization header" no webhook do
//                               RevenueCat (a função recusa avisos sem ele);
//   REVENUECAT_SECRET_KEY     = a chave secreta da API do RevenueCat (começa com "sk_").
import { createClient } from "jsr:@supabase/supabase-js@2";

/** O "entitlement" configurado no RevenueCat que representa o Premium. */
const ENTITLEMENT = "premium";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Evento = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

type Assinatura = {
  store?: string;
  expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  is_sandbox?: boolean;
};

type Cliente = {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string }>;
    subscriptions?: Record<string, Assinatura>;
  };
};

const AVISO: Record<string, string> = {
  INITIAL_PURCHASE: "novo",
  RENEWAL: "renovou",
  BILLING_ISSUE: "falhou",
};

async function clienteNoRevenueCat(appUserId: string) {
  const chave = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!chave) throw new Error("falta o segredo REVENUECAT_SECRET_KEY");
  const resposta = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" } },
  );
  if (!resposta.ok) throw new Error(`RevenueCat respondeu ${resposta.status}`);
  return (await resposta.json()) as Cliente;
}

Deno.serve(async (req) => {
  const segredo = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!segredo || req.headers.get("Authorization") !== `Bearer ${segredo}`) {
    return new Response("não autorizado", { status: 401 });
  }

  const corpo = (await req.json().catch(() => ({}))) as { event?: Evento };
  const evento = corpo.event ?? {};
  if (evento.type === "TEST") return new Response("ok (teste)");

  // todo mundo que esse aviso pode ter mexido (no Goating, o id do RevenueCat é o id da conta)
  const pessoas = [
    ...new Set(
      [
        evento.app_user_id,
        evento.original_app_user_id,
        ...(evento.aliases ?? []),
        ...(evento.transferred_from ?? []),
        ...(evento.transferred_to ?? []),
      ].filter((id): id is string => !!id && UUID.test(id)),
    ),
  ];
  if (pessoas.length === 0) return new Response("sem conta do Goating no aviso");

  const banco = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    for (const pessoa of pessoas) {
      const cliente = await clienteNoRevenueCat(pessoa);
      const direito = cliente.subscriber?.entitlements?.[ENTITLEMENT];
      const produto = direito?.product_identifier ?? null;
      const assinatura = produto ? cliente.subscriber?.subscriptions?.[produto] : undefined;
      const loja = assinatura?.store;
      // só cuida do que foi comprado nas lojas (o Stripe do site tem o próprio webhook)
      if (!direito || (loja !== "app_store" && loja !== "play_store")) continue;

      const { error } = await banco.rpc("sincronizar_assinatura_loja", {
        p_user: pessoa,
        p_loja: loja,
        p_produto: produto,
        p_expira_em: direito.expires_date ?? assinatura?.expires_date ?? null,
        p_renova: !assinatura?.unsubscribe_detected_at,
        p_problema: !!assinatura?.billing_issues_detected_at,
        p_teste: !!assinatura?.is_sandbox,
        p_aviso: pessoa === evento.app_user_id ? (AVISO[evento.type ?? ""] ?? null) : null,
        p_chave: evento.id ? `rc:${evento.id}` : null,
      });
      if (error) throw new Error(error.message);
    }
    return new Response("ok");
  } catch (e) {
    // erro: o RevenueCat tenta de novo mais tarde
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
