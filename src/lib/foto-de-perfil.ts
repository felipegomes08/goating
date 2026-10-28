import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";

/**
 * Lado maior da foto de perfil depois de reduzida. Fica nítida na carta e leve nas listas:
 * foto de celular tem vários MB, e aqui ela vira algo perto de 100 KB.
 */
const LADO_MAIOR = 720;

/** Reduz a foto mantendo a proporção. Devolve null se o navegador não conseguir abrir o arquivo. */
async function reduzir(arquivo: File) {
  try {
    // respeita a rotação que a câmera do celular grava no arquivo
    const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAIOR / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  } catch {
    return null;
  }
}

/** Envia a foto nova (reduzida), grava no perfil e apaga a anterior. */
export async function trocarFotoDePerfil(
  userId: string,
  arquivo: File,
  anterior: string | null | undefined,
) {
  const reduzida = await reduzir(arquivo);
  // formato que o navegador não abre (ex.: HEIC no Android): vai o arquivo original, como antes
  const caminho = reduzida
    ? `${userId}/avatar-${Date.now()}.jpg`
    : `${userId}/avatar-${Date.now()}.${arquivo.name.split(".").pop() ?? "jpg"}`;
  const { error: erroEnvio } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, reduzida ?? arquivo, reduzida ? { contentType: "image/jpeg" } : {});
  if (erroEnvio) throw erroEnvio;
  const { error } = await supabase.from("profiles").update({ foto_url: caminho }).eq("id", userId);
  if (error) throw error;
  // a foto velha não aparece em lugar nenhum: sem apagar, ela só ocupa espaço
  if (anterior && anterior !== caminho && anterior.startsWith(`${userId}/`)) {
    await supabase.storage.from(BUCKET).remove([anterior]);
  }
  return caminho;
}
