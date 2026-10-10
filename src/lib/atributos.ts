import { supabase } from "@/integrations/supabase/client";
import { paraEscalaCard } from "@/lib/tiers";

export const CHAVES_ATRIBUTOS = [
  "chute",
  "drible",
  "velocidade",
  "toque",
  "posicionamento",
  "comportamento",
  "pontualidade",
] as const;

export type ChaveAtributo = (typeof CHAVES_ATRIBUTOS)[number];
export type MediasAtributos = Record<ChaveAtributo, number>;

type LinhaAvaliacao = { nota_geral: number } & Record<ChaveAtributo, number | null>;

/**
 * Médias do radar/carta de um jogador. Vêm prontas do banco (função `medias_do_jogador`):
 * as avaliações são privadas, ninguém lê a nota que cada pessoa deu.
 */
export async function carregarMedias(userId: string): Promise<MediasAtributos> {
  const { data, error } = await supabase.rpc("medias_do_jogador", { p_user_id: userId });
  if (error) throw error;
  const medias = data[0];
  if (!medias || Number(medias.total) === 0 || medias.nota_geral === null) {
    return { ...MEDIAS_ZERADAS };
  }
  const resultado = { ...MEDIAS_ZERADAS };
  for (const chave of CHAVES_ATRIBUTOS) {
    // atributo sem nenhuma avaliação detalhada mostra a média das notas gerais
    resultado[chave] = paraEscalaCard(Number(medias[chave] ?? medias.nota_geral));
  }
  return resultado;
}

/**
 * Quantas avaliações detalhadas um atributo precisa para usar só elas.
 * Abaixo disso, o atributo mostra a média das notas gerais (avaliações rápidas).
 */
export const MIN_DETALHADAS = 1;

export const MEDIAS_ZERADAS: MediasAtributos = {
  chute: 0,
  drible: 0,
  velocidade: 0,
  toque: 0,
  posicionamento: 0,
  comportamento: 0,
  pontualidade: 0,
};

function media(valores: number[]) {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/**
 * Médias do radar/carta. Avaliação rápida grava só `nota_geral` (atributos nulos);
 * a detalhada grava os atributos. Cada atributo prioriza as notas detalhadas e,
 * se não houver o suficiente, cai para a média das notas gerais.
 */
export function mediasAtributos(linhas: LinhaAvaliacao[]): MediasAtributos {
  if (linhas.length === 0) return { ...MEDIAS_ZERADAS };
  const mediaGeral = media(linhas.map((l) => Number(l.nota_geral)));

  const resultado = { ...MEDIAS_ZERADAS };
  for (const chave of CHAVES_ATRIBUTOS) {
    const detalhadas = linhas
      .map((l) => l[chave])
      .filter((v): v is number => v !== null && v !== undefined)
      .map(Number);
    const valor = detalhadas.length >= MIN_DETALHADAS ? media(detalhadas) : mediaGeral;
    resultado[chave] = paraEscalaCard(valor);
  }
  return resultado;
}
