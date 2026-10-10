import { supabase } from "@/integrations/supabase/client";

const BUCKET = "turmas";

/** Tamanho final de cada foto: escudo quadrado (aparece redondo), capa deitada. */
const FORMATOS = {
  escudo: { largura: 512, altura: 512 },
  capa: { largura: 1500, altura: 750 },
} as const;

export type TipoDeFoto = keyof typeof FORMATOS;

/** Endereço público da foto guardada (o banco guarda só o caminho dentro do bucket). */
export function urlDaFotoDaTurma(caminho: string | null | undefined) {
  if (!caminho) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

/**
 * Corta a foto pelo meio no formato certo e reduz o tamanho antes de enviar:
 * foto de celular tem vários MB, e aqui ela vira algumas centenas de KB.
 */
async function prepararFoto(arquivo: File, tipo: TipoDeFoto) {
  const { largura, altura } = FORMATOS[tipo];
  // respeita a rotação que a câmera do celular grava no arquivo
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.max(largura / imagem.width, altura / imagem.height);
  const lw = imagem.width * escala;
  const lh = imagem.height * escala;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Esse navegador não desenha imagens.");
  // capa: um pouco acima do centro, porque em foto de time as cabeças ficam em cima
  ctx.drawImage(imagem, (largura - lw) / 2, (altura - lh) * (tipo === "capa" ? 0.35 : 0.5), lw, lh);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86),
  );
  if (!blob) throw new Error("Não deu pra preparar a foto.");
  return blob;
}

/** Envia a foto nova, grava na turma e apaga a anterior. Devolve o caminho novo. */
export async function trocarFotoDaTurma(
  crewId: string,
  tipo: TipoDeFoto,
  arquivo: File,
  anterior: string | null,
) {
  const blob = await prepararFoto(arquivo, tipo);
  // nome novo a cada troca: o endereço muda e nenhum aparelho fica mostrando a foto velha
  const caminho = `${crewId}/${tipo}-${Date.now()}.jpg`;
  const { error: erroEnvio } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (erroEnvio) throw erroEnvio;
  const coluna = tipo === "escudo" ? { escudo_url: caminho } : { capa_url: caminho };
  const { error } = await supabase.from("crews").update(coluna).eq("id", crewId);
  if (error) throw error;
  if (anterior) await supabase.storage.from(BUCKET).remove([anterior]);
  return caminho;
}

export async function tirarFotoDaTurma(crewId: string, tipo: TipoDeFoto, atual: string) {
  const coluna = tipo === "escudo" ? { escudo_url: null } : { capa_url: null };
  const { error } = await supabase.from("crews").update(coluna).eq("id", crewId);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([atual]);
}
