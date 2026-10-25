// Copia a foto da conta Google pro perfil, na primeira entrada com Google.
//
// Só age se o perfil ainda não tem foto e a foto vem do Google (googleusercontent.com). Baixa
// numa resolução maior, guarda no bucket avatars e preenche profiles.foto_url.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  if (!usuario) return resposta({ erro: "sem login" }, 401);

  const { data: perfil } = await banco
    .from("profiles")
    .select("foto_url")
    .eq("id", usuario.id)
    .maybeSingle();
  if (!perfil || perfil.foto_url) return resposta({ feito: false, motivo: "já tem foto" });

  const original = String(
    usuario.user_metadata?.["avatar_url"] ?? usuario.user_metadata?.["picture"] ?? "",
  );
  let endereco: URL;
  try {
    endereco = new URL(original);
  } catch {
    return resposta({ feito: false, motivo: "sem foto do Google" });
  }
  if (!endereco.hostname.endsWith("googleusercontent.com")) {
    return resposta({ feito: false, motivo: "foto de fora do Google" });
  }
  // a foto padrão vem pequena ("=s96-c"); pede uma maior
  const grande = original.replace(/=s\d+-c$/, "=s400-c");
  const imagem = await fetch(grande);
  if (!imagem.ok) return resposta({ feito: false, motivo: "não baixou" });
  const tipo = imagem.headers.get("content-type") ?? "image/jpeg";
  if (!tipo.startsWith("image/")) return resposta({ feito: false, motivo: "não é imagem" });

  const caminho = `${usuario.id}/avatar-google-${Date.now()}.jpg`;
  const { error } = await banco.storage
    .from("avatars")
    .upload(caminho, await imagem.arrayBuffer(), { contentType: tipo, upsert: true });
  if (error) return resposta({ feito: false, motivo: error.message }, 500);

  await banco
    .from("profiles")
    .update({ foto_url: caminho })
    .eq("id", usuario.id)
    .is("foto_url", null);
  return resposta({ feito: true });
});
