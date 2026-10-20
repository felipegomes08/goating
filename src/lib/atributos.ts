import { supabase } from "@/integrations/supabase/client";
import { paraEscalaCard } from "@/lib/tiers";

/**
 * As notas de uma avaliação. Cada posição tem cinco habilidades próprias (as que aparecem
 * na cartinha), e todo mundo tem Comportamento (que entra no radar e na nota geral). As que
 * se repetem entre posições são a mesma nota: o "Passe" do volante soma com o "Passe" de
 * quando ele jogou de meia. O banco usa as mesmas listas (gatilho `normalizar_nota_geral`).
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

export const POSICOES_DE_AVALIACAO = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"] as const;
export type Posicao = (typeof POSICOES_DE_AVALIACAO)[number];

export const NOME_DA_POSICAO: Record<Posicao, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LAT: "Lateral",
  VOL: "Volante",
  MEI: "Meia",
  ATA: "Atacante",
};

const NOTA = {
  marcacao: { chave: "marcacao", nome: "Marcação", radar: "Marcação", sigla: "MAR" },
  desarme: { chave: "desarme", nome: "Desarme", radar: "Desarme", sigla: "DES" },
  jogo_aereo: { chave: "jogo_aereo", nome: "Jogo aéreo", radar: "Aéreo", sigla: "AER" },
  fisico: { chave: "fisico", nome: "Físico", radar: "Físico", sigla: "FIS" },
  passe: { chave: "passe", nome: "Passe", radar: "Passe", sigla: "PAS" },
  velocidade: { chave: "velocidade", nome: "Velocidade", radar: "Velocidade", sigla: "VEL" },
  drible: { chave: "drible", nome: "Drible", radar: "Drible", sigla: "DRI" },
  visao: { chave: "visao", nome: "Visão de jogo", radar: "Visão", sigla: "VIS" },
  finalizacao: { chave: "finalizacao", nome: "Finalização", radar: "Finalização", sigla: "FIN" },
  controle: { chave: "controle", nome: "Controle de bola", radar: "Controle", sigla: "CON" },
  reflexo: { chave: "reflexo", nome: "Reflexo", radar: "Reflexo", sigla: "REF" },
  posicionamento: {
    chave: "posicionamento",
    nome: "Posicionamento",
    radar: "Posição",
    sigla: "POS",
  },
  elasticidade: {
    chave: "elasticidade",
    nome: "Elasticidade",
    radar: "Elasticidade",
    sigla: "ELA",
  },
  reposicao: { chave: "reposicao", nome: "Reposição", radar: "Reposição", sigla: "REP" },
  jogo_pes: { chave: "jogo_pes", nome: "Jogo com os pés", radar: "Pés", sigla: "PÉS" },
  comportamento: {
    chave: "comportamento",
    nome: "Comportamento",
    radar: "Postura",
    sigla: "COM",
  },
} satisfies Record<string, Definicao>;

/** As cinco habilidades de cada posição, na ordem em que aparecem na cartinha. */
const HABILIDADES: Record<Posicao, Definicao[]> = {
  GOL: [NOTA.reflexo, NOTA.posicionamento, NOTA.elasticidade, NOTA.reposicao, NOTA.jogo_pes],
  ZAG: [NOTA.marcacao, NOTA.desarme, NOTA.jogo_aereo, NOTA.fisico, NOTA.passe],
  LAT: [NOTA.velocidade, NOTA.marcacao, NOTA.passe, NOTA.fisico, NOTA.drible],
  VOL: [NOTA.desarme, NOTA.marcacao, NOTA.passe, NOTA.fisico, NOTA.visao],
  MEI: [NOTA.passe, NOTA.visao, NOTA.drible, NOTA.finalizacao, NOTA.controle],
  ATA: [NOTA.finalizacao, NOTA.velocidade, NOTA.drible, NOTA.passe, NOTA.controle],
};

/** Todas as colunas de nota que o app grava em `evaluations`. */
export const COLUNAS_DE_NOTA = Object.values(NOTA).map((n) => n.chave);

/** Posição válida, ou meia (quem não escolheu posição no perfil é avaliado como meia). */
export const posicaoDe = (posicao: string | null | undefined): Posicao =>
  (POSICOES_DE_AVALIACAO as readonly string[]).includes(posicao ?? "")
    ? (posicao as Posicao)
    : "MEI";

export const ehGoleiro = (posicao: string | null | undefined) => posicao === "GOL";

/** As notas de uma posição: as cinco habilidades e o comportamento. */
export const atributosDe = (posicao: string | null | undefined): Definicao[] => [
  ...HABILIDADES[posicaoDe(posicao)],
  NOTA.comportamento,
];

/** Um atributo pronto pra mostrar, já na escala 0–100 da cartinha. */
export type AtributoExibido = Definicao & { valor: number };

export const atributosZerados = (posicao: string | null | undefined): AtributoExibido[] =>
  atributosDe(posicao).map((a) => ({ ...a, valor: 0 }));

/**
 * Médias do radar/carta de um jogador, nas notas da posição dele. Vêm prontas do banco
 * (função `medias_do_jogador`): as avaliações são privadas, ninguém lê a nota que cada
 * pessoa deu.
 *
 * Avaliação rápida grava só a nota geral, e o jogador pode ter sido avaliado em outra
 * posição: nota sem nenhum valor próprio mostra a média das notas gerais.
 */
export async function carregarMedias(
  userId: string,
  posicao: string | null | undefined,
): Promise<AtributoExibido[]> {
  const { data, error } = await supabase.rpc("medias_do_jogador", { p_user_id: userId });
  if (error) throw error;
  const medias = data[0] as Record<string, number | null> | undefined;
  if (!medias || Number(medias["total"]) === 0 || medias["nota_geral"] == null) {
    return atributosZerados(posicao);
  }
  const geral = Number(medias["nota_geral"]);
  const goleiro = ehGoleiro(posicao);
  return atributosDe(posicao).map((a) => {
    // "posicionamento" de goleiro vem numa coluna própria
    const coluna = goleiro && a.chave === "posicionamento" ? "posicionamento_goleiro" : a.chave;
    return { ...a, valor: paraEscalaCard(Number(medias[coluna] ?? geral)) };
  });
}
