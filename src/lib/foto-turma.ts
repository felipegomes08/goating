import { supabase } from "@/integrations/supabase/client";

const BUCKET = "turmas";

/** Tamanho final de cada foto: escudo quadrado (aparece redondo), capa deitada. */
const FORMATOS = {
  escudo: { largura: 512, altura: 512 },
  capa: { largura: 1500, altura: 750 },
} as const;

export type TipoDeFoto = keyof typeof FORMATOS;

/** Lado da miniatura do escudo, usada nos cartões de pelada (aparece com uns 20px). */
const LADO_DA_MINIATURA = 96;

/** A miniatura mora ao lado do escudo, com "-p" no nome: "escudo-123.jpg" -> "escudo-123-p.jpg". */
const caminhoDaMiniatura = (caminho: string) => caminho.replace(/\.jpg$/, "-p.jpg");

/** Endereço da miniatura do escudo. Escudo enviado antes de existir miniatura não tem uma. */
export function urlDaMiniaturaDoEscudo(caminho: string | null | undefined) {
  return caminho ? urlDaFotoDaTurma(caminhoDaMiniatura(caminho)) : null;
}

/** Endereço público da foto guardada (o banco guarda só o caminho dentro do bucket). */
export function urlDaFotoDaTurma(caminho: string | null | undefined) {
  if (!caminho) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

/**
 * Corta a foto pelo meio no formato certo e reduz o tamanho antes de enviar:
 * foto de celular tem vários MB, e aqui ela vira algumas centenas de KB.
 */
async function prepararFoto(
  arquivo: File,
  tipo: TipoDeFoto,
  { largura, altura }: { largura: number; altura: number } = FORMATOS[tipo],
) {
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
  if (tipo === "escudo") {
    // se a miniatura falhar o cartão cai no escudo inteiro: não vale travar a troca por ela
    const mini = await prepararFoto(arquivo, tipo, {
      largura: LADO_DA_MINIATURA,
      altura: LADO_DA_MINIATURA,
    });
    await supabase.storage.from(BUCKET).upload(caminhoDaMiniatura(caminho), mini, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
  }
  const coluna = tipo === "escudo" ? { escudo_url: caminho } : { capa_url: caminho };
  const { error } = await supabase.from("crews").update(coluna).eq("id", crewId);
  if (error) throw error;
  if (anterior) await apagarArquivos(tipo, anterior);
  return caminho;
}

export async function tirarFotoDaTurma(crewId: string, tipo: TipoDeFoto, atual: string) {
  const coluna = tipo === "escudo" ? { escudo_url: null } : { capa_url: null };
  const { error } = await supabase.from("crews").update(coluna).eq("id", crewId);
  if (error) throw error;
  await apagarArquivos(tipo, atual);
}

const apagarArquivos = (tipo: TipoDeFoto, caminho: string) =>
  supabase.storage
    .from(BUCKET)
    .remove(tipo === "escudo" ? [caminho, caminhoDaMiniatura(caminho)] : [caminho]);
