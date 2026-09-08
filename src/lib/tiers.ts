export type TierNome = "Bronze" | "Prata" | "Ouro" | "Platina" | "Lendário" | "GOAT";

export type TierConfig = {
  nome: TierNome;
  overallMinimo: number;
  peladasMinimas: number;
  ordem: number;
  /** classe de cor de texto usada nos números do card */
  textClass: string;
  chipClass: string;
  /** caminho do molde PNG dentro do bucket card-moldes */
  molde: string;
  /** ajuste vertical (px) do bloco de nome/atributos por molde */
  offsetY: number;
};

export const TIERS: TierConfig[] = [
  {
    nome: "Bronze",
    overallMinimo: 0,
    peladasMinimas: 5,
    ordem: 1,
    textClass: "text-tier-bronze",
    chipClass: "bg-tier-bronze/15 text-tier-bronze",
    molde: "bronze.png",
    offsetY: 0,
  },
  {
    nome: "Prata",
    overallMinimo: 60,
    peladasMinimas: 8,
    ordem: 2,
    textClass: "text-tier-prata",
    chipClass: "bg-tier-prata/20 text-tier-prata",
    molde: "prata.png",
    offsetY: 0,
  },
  {
    nome: "Ouro",
    overallMinimo: 70,
    peladasMinimas: 25,
    ordem: 3,
    textClass: "text-tier-ouro",
    chipClass: "bg-tier-ouro/20 text-tier-ouro",
    molde: "ouro.png",
    offsetY: -2,
  },
  {
    nome: "Platina",
    overallMinimo: 80,
    peladasMinimas: 50,
    ordem: 4,
    textClass: "text-tier-platina",
    chipClass: "bg-tier-platina/20 text-tier-platina",
    molde: "platina.png",
    offsetY: -2,
  },
  {
    nome: "Lendário",
    overallMinimo: 90,
    peladasMinimas: 100,
    ordem: 5,
    textClass: "text-tier-lendario",
    chipClass: "bg-tier-lendario/25 text-tier-lendario",
    molde: "lendario.png",
    offsetY: -4,
  },
  {
    nome: "GOAT",
    overallMinimo: 95,
    peladasMinimas: 180,
    ordem: 6,
    textClass: "text-tier-goat",
    chipClass: "bg-tier-goat/20 text-tier-goat",
    molde: "goat.png",
    offsetY: -4,
  },
];

export const MIN_AVALIACOES = 3;

/** Tier é sempre derivado: overall E peladas precisam bater o mínimo. */
export function tierDoJogador(overall: number, peladasJogadas: number): TierConfig | null {
  let atual: TierConfig | null = null;
  for (const t of TIERS) {
    if (overall >= t.overallMinimo && peladasJogadas >= t.peladasMinimas) atual = t;
  }
  return atual;
}

export function proximoTier(overall: number, peladasJogadas: number): TierConfig | null {
  const atual = tierDoJogador(overall, peladasJogadas);
  const ordem = atual?.ordem ?? 0;
  return TIERS.find((t) => t.ordem === ordem + 1) ?? null;
}

/** 0–10 (avaliação) -> 0–100 (exibição estilo FIFA) */
export function paraEscalaCard(nota0a10: number | null | undefined): number {
  if (nota0a10 == null) return 0;
  return Math.round(nota0a10 * 10);
}

export function overallLiberado(avaliacoesRecebidas: number) {
  return avaliacoesRecebidas >= MIN_AVALIACOES;
}

export function avaliacoesFaltando(avaliacoesRecebidas: number) {
  return Math.max(0, MIN_AVALIACOES - avaliacoesRecebidas);
}
