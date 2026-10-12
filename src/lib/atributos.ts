import { supabase } from "@/integrations/supabase/client";
import { paraEscalaCard } from "@/lib/tiers";

/**
 * As notas de uma avaliação. Jogador de linha e goleiro têm cinco habilidades técnicas
 * diferentes; comportamento e pontualidade valem pros dois. As cinco primeiras de cada
 * lista são as que aparecem na cartinha; o radar mostra as sete.
 */
type Definicao = {
  /** coluna em `evaluations` */
  chave: string;
  /** nome inteiro, na tela de avaliar e nas barras do cartão */
  nome: string;
  /** nome curto, nas pontas do radar */
  radar: string;
  /** três letras, na cartinha */
  sigla: string;
};

const EM_COMUM: Definicao[] = [
  { chave: "comportamento", nome: "Comportamento", radar: "Postura", sigla: "COM" },
  { chave: "pontualidade", nome: "Pontualidade", radar: "Pontual", sigla: "PON" },
];

export const ATRIBUTOS_LINHA: Definicao[] = [
  { chave: "chute", nome: "Chute", radar: "Chute", sigla: "CHU" },
  { chave: "drible", nome: "Drible", radar: "Drible", sigla: "DRI" },
  { chave: "velocidade", nome: "Velocidade", radar: "Velocidade", sigla: "VEL" },
  { chave: "toque", nome: "Toque de bola", radar: "Toque", sigla: "TOQ" },
  { chave: "posicionamento", nome: "Posicionamento", radar: "Posição", sigla: "POS" },
  ...EM_COMUM,
];

export const ATRIBUTOS_GOLEIRO: Definicao[] = [
  { chave: "reflexo", nome: "Reflexo", radar: "Reflexo", sigla: "REF" },
  { chave: "posicionamento", nome: "Posicionamento", radar: "Posição", sigla: "POS" },
  { chave: "elasticidade", nome: "Elasticidade", radar: "Elasticidade", sigla: "ELA" },
  { chave: "reposicao", nome: "Reposição", radar: "Reposição", sigla: "REP" },
  { chave: "jogo_pes", nome: "Jogo com os pés", radar: "Pés", sigla: "PÉS" },
  ...EM_COMUM,
];

/** Todas as colunas de nota que existem em `evaluations` (as de linha e as de goleiro). */
export const COLUNAS_DE_NOTA = [
  ...new Set([...ATRIBUTOS_LINHA, ...ATRIBUTOS_GOLEIRO].map((a) => a.chave)),
];

export const ehGoleiro = (posicao: string | null | undefined) => posicao === "GOL";

export const atributosDe = (goleiro: boolean) => (goleiro ? ATRIBUTOS_GOLEIRO : ATRIBUTOS_LINHA);

/** Um atributo pronto pra mostrar, já na escala 0–100 da cartinha. */
export type AtributoExibido = Definicao & { valor: number };

export const atributosZerados = (goleiro: boolean): AtributoExibido[] =>
  atributosDe(goleiro).map((a) => ({ ...a, valor: 0 }));

/**
 * Médias do radar/carta de um jogador, como goleiro ou como jogador de linha. Vêm prontas
 * do banco (função `medias_do_jogador`): as avaliações são privadas, ninguém lê a nota que
 * cada pessoa deu.
 *
 * Avaliação rápida grava só a nota geral, e um goleiro pode ter sido avaliado só como
 * jogador de linha (ou o contrário): atributo sem nenhuma nota própria mostra a média
 * das notas gerais.
 */
export async function carregarMedias(userId: string, goleiro: boolean): Promise<AtributoExibido[]> {
  const { data, error } = await supabase.rpc("medias_do_jogador", { p_user_id: userId });
  if (error) throw error;
  const medias = data[0] as Record<string, number | null> | undefined;
  if (!medias || Number(medias["total"]) === 0 || medias["nota_geral"] == null) {
    return atributosZerados(goleiro);
  }
  const geral = Number(medias["nota_geral"]);
  return atributosDe(goleiro).map((a) => {
    // "posicionamento" existe nos dois tipos, com médias separadas
    const coluna = goleiro && a.chave === "posicionamento" ? "posicionamento_goleiro" : a.chave;
    return { ...a, valor: paraEscalaCard(Number(medias[coluna] ?? geral)) };
  });
}
