// Manda avisos pros celulares pelo Firebase (FCM). É chamada pelo banco de dois jeitos:
//   { id }          uma notificação nova do sino, pro celular de quem recebeu;
//   { mensagem_id } uma mensagem nova no chat da turma, pros celulares dos outros membros.
//
// Não precisa de login: a função lê com a chave de serviço e só envia se o aviso acabou de ser
// criado e ainda não foi enviado (quem chamar de novo com o mesmo id não consegue reenviar).
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
  denuncia_chat: "turma",
  pendente: "organizador",
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

type Aviso = {
  titulo: string;
  corpo: string;
  link: string;
  /** mesma etiqueta = o aviso novo substitui o anterior na bandeja (um por chat de turma) */
  etiqueta?: string;
  /** chat de turma do aviso: com o app aberto nesse chat, o aviso não aparece */
  chat?: string;
};

type Banco = ReturnType<typeof createClient>;

/** Envia o mesmo aviso pra uma lista de celulares e tira da lista os que não existem mais. */
async function enviarParaCelulares(banco: Banco, tokens: string[], aviso: Aviso) {
  if (tokens.length === 0) return;
  const segredo = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!segredo) throw new Error("falta o segredo FCM_SERVICE_ACCOUNT");
  const conta = JSON.parse(segredo) as ContaDeServico;
  const acesso = await tokenDoGoogle(conta);

  await Promise.all(
    tokens.map(async (token) => {
      const resposta = await fetch(
        `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: aviso.titulo, body: aviso.corpo },
              data: { link: aviso.link, ...(aviso.chat ? { chat: aviso.chat } : {}) },
              android: {
                priority: "high",
                notification: {
                  channel_id: "goating",
                  icon: "ic_stat_goating",
                  color: "#5EF28E",
                  ...(aviso.etiqueta ? { tag: aviso.etiqueta } : {}),
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
    }),
  );
}

const limitar = (texto: string, max: number) =>
  texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;

/** Aviso de uma mensagem do chat da turma, pros outros membros (menos quem silenciou). */
async function avisoDoChat(banco: Banco, mensagemId: string) {
  // marca como enviada antes de enviar: chamar de novo com o mesmo id não reenvia
  const { data: msg } = await banco
    .from("mensagens_da_turma")
    .update({ push_enviado_em: new Date().toISOString() })
    .eq("id", mensagemId)
    .is("push_enviado_em", null)
    .is("apagada_em", null)
    .gt("criado_em", new Date(Date.now() - 5 * 60_000).toISOString())
    .select("crew_id, autor_id, tipo, texto, match_id")
    .maybeSingle();
  if (!msg) return "nada a enviar";

  const [turmaRes, membrosRes, silenciadosRes, autorRes, peladaRes] = await Promise.all([
    banco.from("crews").select("nome, dono_id, excluida_em").eq("id", msg.crew_id).maybeSingle(),
    banco
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", msg.crew_id)
      .is("removido_em", null)
      .not("user_id", "is", null),
    banco
      .from("chat_da_turma_leitura")
      .select("user_id")
      .eq("crew_id", msg.crew_id)
      .eq("silenciado", true),
    msg.autor_id
      ? banco.from("profiles").select("nome_exibicao").eq("id", msg.autor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    msg.match_id
      ? banco.from("matches").select("titulo").eq("id", msg.match_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const turma = turmaRes.data;
  if (!turma || turma.excluida_em) return "turma não existe";

  const silenciados = new Set((silenciadosRes.data ?? []).map((s) => s.user_id as string));
  const destino = new Set(
    [...(membrosRes.data ?? []).map((m) => m.user_id as string), turma.dono_id as string].filter(
      (u) => !!u && u !== msg.autor_id && !silenciados.has(u),
    ),
  );
  if (destino.size === 0) return "ninguém pra avisar";

  // quem bloqueou o autor não recebe aviso das mensagens dele
  if (msg.autor_id) {
    const { data: bloquearam } = await banco
      .from("bloqueios")
      .select("user_id")
      .eq("bloqueado_id", msg.autor_id)
      .in("user_id", [...destino]);
    for (const b of bloquearam ?? []) destino.delete(b.user_id as string);
    if (destino.size === 0) return "ninguém pra avisar";
  }

  // quem desligou "Chat das turmas" nos avisos do celular fica de fora
  const { data: perfis } = await banco
    .from("profiles")
    .select("id, push_desligados")
    .in("id", [...destino]);
  for (const p of perfis ?? []) {
    if (((p.push_desligados as string[] | null) ?? []).includes("chat")) destino.delete(p.id);
  }
  if (destino.size === 0) return "todos desligados";

  const { data: celulares } = await banco
    .from("dispositivos")
    .select("token")
    .in("user_id", [...destino]);
  if (!celulares?.length) return "sem celular";

  const autor = (autorRes.data?.nome_exibicao as string | undefined)?.split(" ")[0] ?? "Alguém";
  const pelada = (peladaRes.data?.titulo as string | undefined) ?? "pelada";
  const corpo =
    msg.tipo === "lista"
      ? `📋 Lista: ${pelada}. Toque pra dizer se vai.`
      : msg.tipo === "pagamento"
        ? `💰 Cobrança: ${pelada}. Veja quem já pagou.`
        : `${autor}: ${limitar((msg.texto as string | null) ?? "", 180)}`;

  await enviarParaCelulares(
    banco,
    celulares.map((c) => c.token as string),
    {
      titulo: turma.nome as string,
      corpo,
      link: `/turma/${msg.crew_id}/chat`,
      etiqueta: `chat-${msg.crew_id}`,
      chat: msg.crew_id as string,
    },
  );
  return "ok";
}

/** Aviso de uma notificação do sino, pro celular de quem recebeu. */
async function avisoDoSino(banco: Banco, id: string) {
  // marca como enviada antes de enviar: chamar de novo com o mesmo id não reenvia
  const { data: aviso } = await banco
    .from("notificacoes")
    .update({ push_enviado_em: new Date().toISOString() })
    .eq("id", id)
    .is("push_enviado_em", null)
    .gt("criado_em", new Date(Date.now() - 5 * 60_000).toISOString())
    .select("user_id, tipo, titulo, corpo, link")
    .maybeSingle();
  if (!aviso) return "nada a enviar";

  const { data: perfil } = await banco
    .from("profiles")
    .select("push_desligados")
    .eq("id", aviso.user_id)
    .maybeSingle();
  const grupo = GRUPO[aviso.tipo as string] ?? "outros";
  if (((perfil?.push_desligados as string[] | null) ?? []).includes(grupo)) return "desligado";

  const { data: celulares } = await banco
    .from("dispositivos")
    .select("token")
    .eq("user_id", aviso.user_id);
  if (!celulares?.length) return "sem celular";

  await enviarParaCelulares(
    banco,
    celulares.map((c) => c.token as string),
    {
      titulo: aviso.titulo as string,
      corpo: (aviso.corpo as string | null) ?? "",
      link: (aviso.link as string | null) ?? "/notificacoes",
    },
  );
  return "ok";
}

Deno.serve(async (req) => {
  const { id, mensagem_id } = (await req.json().catch(() => ({}))) as {
    id?: string;
    mensagem_id?: string;
  };
  if (!id && !mensagem_id) return new Response("sem id", { status: 400 });

  const banco = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    return new Response(
      mensagem_id ? await avisoDoChat(banco, mensagem_id) : await avisoDoSino(banco, id!),
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
