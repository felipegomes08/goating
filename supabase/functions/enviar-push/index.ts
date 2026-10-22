// Manda uma notificação do sino pros celulares de quem recebeu, pelo Firebase (FCM).
//
// É chamada pelo banco a cada notificação nova, só com o id dela. Não precisa de login: a
// função lê a notificação com a chave de serviço e só envia se ela acabou de ser criada e
// ainda não foi enviada (quem chamar de novo com o mesmo id não consegue reenviar).
//
// Segredo necessário (painel do Supabase > Edge Functions > Secrets):
//   FCM_SERVICE_ACCOUNT = o JSON da conta de serviço do Firebase.
import { createClient } from "jsr:@supabase/supabase-js@2";

/** Cada tipo de aviso pertence a um grupo que a pessoa pode desligar no perfil. */
const GRUPO: Record<string, string> = {
  nova_pelada: "peladas",
  lembrete: "peladas",
  mudou: "peladas",
  cancelada: "peladas",
  tirado: "peladas",
  pedido_aceito: "peladas",
  confirmou: "organizador",
  pedido_pelada: "organizador",
  lotou: "organizador",
  desistiu: "organizador",
  lembrete_org: "organizador",
  entrou_turma: "turma",
  pedido_turma: "turma",
  pedido_aceito_turma: "turma",
  admin: "turma",
  avaliar: "avaliacao",
  avaliar_fim: "avaliacao",
  mvp: "avaliacao",
  mvp_voce: "avaliacao",
  subiu: "conquistas",
  colega_subiu: "conquistas",
  conquista: "conquistas",
  seguidor: "social",
  comentario: "social",
};

type ContaDeServico = { client_email: string; private_key: string; project_id: string };

const base64url = (dados: ArrayBuffer | string) =>
  btoa(typeof dados === "string" ? dados : String.fromCharCode(...new Uint8Array(dados)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Token de acesso do Google pra API do Firebase, assinado com a chave da conta de serviço. */
async function tokenDoGoogle(conta: ContaDeServico) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const pem = conta.private_key.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    "",
  );
  const chave = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    chave,
    new TextEncoder().encode(`${cabecalho}.${corpo}`),
  );
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecalho}.${corpo}.${base64url(assinatura)}`,
    }),
  });
  if (!resposta.ok) throw new Error(`token do Google: ${resposta.status}`);
  return ((await resposta.json()) as { access_token: string }).access_token;
}

Deno.serve(async (req) => {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return new Response("sem id", { status: 400 });

  const banco = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // marca como enviada antes de enviar: chamar de novo com o mesmo id não reenvia
  const { data: aviso } = await banco
    .from("notificacoes")
    .update({ push_enviado_em: new Date().toISOString() })
    .eq("id", id)
    .is("push_enviado_em", null)
    .gt("criado_em", new Date(Date.now() - 5 * 60_000).toISOString())
    .select("user_id, tipo, titulo, corpo, link")
    .maybeSingle();
  if (!aviso) return new Response("nada a enviar");

  const { data: perfil } = await banco
    .from("profiles")
    .select("push_desligados")
    .eq("id", aviso.user_id)
    .maybeSingle();
  const grupo = GRUPO[aviso.tipo] ?? "outros";
  if ((perfil?.push_desligados ?? []).includes(grupo)) return new Response("desligado");

  const { data: celulares } = await banco
    .from("dispositivos")
    .select("token")
    .eq("user_id", aviso.user_id);
  if (!celulares?.length) return new Response("sem celular");

  const segredo = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!segredo) return new Response("falta o segredo FCM_SERVICE_ACCOUNT", { status: 500 });
  const conta = JSON.parse(segredo) as ContaDeServico;
  const acesso = await tokenDoGoogle(conta);

  for (const { token } of celulares) {
    const resposta = await fetch(
      `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: aviso.titulo, body: aviso.corpo ?? "" },
            data: { link: aviso.link ?? "/notificacoes" },
            android: {
              priority: "high",
              notification: {
                channel_id: "goating",
                icon: "ic_stat_goating",
                color: "#5EF28E",
              },
            },
          },
        }),
      },
    );
    // celular que desinstalou o app ou trocou de token: sai da lista (outros erros não apagam)
    if (resposta.status === 404 || resposta.status === 400) {
      const erro = await resposta.text();
      if (/UNREGISTERED|registration token is not a valid/i.test(erro)) {
        await banco.from("dispositivos").delete().eq("token", token);
      }
    }
  }
  return new Response("ok");
});
