export type TierNome = "Bronze" | "Prata" | "Ouro" | "Platina" | "Lendário" | "GOAT";

/** Caixa em % da carta (x/w sobre a largura, y/h sobre a altura). */
export type CaixaCarta = { x: number; y: number; w: number; h: number };

export type LayoutCarta = {
  /** hexágono do overall + posição */
  hex: CaixaCarta;
  /** recorte transparente onde a foto aparece */
  escudo: CaixaCarta;
  /** faixa do nome */
  nome: CaixaCarta;
  /** caixa dos 5 atributos */
  atrib: CaixaCarta;
};

export type TierConfig = {
  nome: TierNome;
  overallMinimo: number;
  xpMinimo: number;
  ordem: number;
  /** classe de cor de texto usada nos números do card */
  textClass: string;
  /** cor do tier como valor CSS — usada no brilho do fundo, partículas e barra de XP */
  cor: string;
  /** cor legível em cima de fundo claro (texto e barra de XP) — só difere no Lendário, que é quase branco */
  destaque: string;
  chipClass: string;
  /** molde da cartinha (public/card-moldes), com o escudo da foto vazado */
  molde: string;
  /** onde cada área do molde fica — cada tier tem um desenho um pouco diferente */
  layout: LayoutCarta;
  /** iconezinho do tier (public/tier-badges), usado na frente do nome do jogador */
  icone: string;
};

/**
 * xpMinimo calibrado pra manter o mesmo tempo médio de progressão que existia
 * com o critério antigo (peladas jogadas), assumindo ~38xp por pelada média
 * (10xp fixo + ~3 avaliações recebidas com nota ~7 + chance de MVP):
 * peladas mínimas antigas × 38, arredondado.
 */
export const TIERS: TierConfig[] = [
  {
    nome: "Bronze",
    overallMinimo: 0,
    xpMinimo: 200,
    ordem: 1,
    textClass: "text-tier-bronze",
    cor: "var(--tier-bronze)",
    destaque: "var(--tier-bronze)",
    chipClass: "bg-tier-bronze/15 text-tier-bronze",
    molde: "/card-moldes/bronze.webp",
    layout: {
      hex: { x: 8.93, y: 10.64, w: 19.43, h: 16.92 },
      escudo: { x: 32.78, y: 16.85, w: 34.44, h: 42.96 },
      nome: { x: 13.54, y: 62.09, w: 72.93, h: 5.59 },
      atrib: { x: 9.3, y: 70.51, w: 81.4, h: 15.68 },
    },
    icone: "/tier-badges/bronze.png",
  },
  {
    nome: "Prata",
    overallMinimo: 60,
    xpMinimo: 300,
    ordem: 2,
    textClass: "text-tier-prata",
    cor: "var(--tier-prata)",
    destaque: "oklch(0.6 0.02 250)",
    chipClass: "bg-tier-prata/20 text-tier-prata",
    molde: "/card-moldes/prata.webp",
    layout: {
      hex: { x: 8.56, y: 10.01, w: 19.89, h: 17.47 },
      escudo: { x: 32.69, y: 16.51, w: 34.71, h: 43.72 },
      nome: { x: 12.98, y: 62.09, w: 73.94, h: 4.7 },
      atrib: { x: 8.84, y: 70.17, w: 82.32, h: 15.88 },
    },
    icone: "/tier-badges/prata.png",
  },
  {
    nome: "Ouro",
    overallMinimo: 70,
    xpMinimo: 950,
    ordem: 3,
    textClass: "text-tier-ouro",
    cor: "var(--tier-ouro)",
    destaque: "oklch(0.72 0.15 80)",
    chipClass: "bg-tier-ouro/20 text-tier-ouro",
    molde: "/card-moldes/ouro.webp",
    layout: {
      hex: { x: 8.29, y: 9.81, w: 18.6, h: 16.99 },
      escudo: { x: 31.77, y: 15.81, w: 35.82, h: 42.89 },
      nome: { x: 12.98, y: 60.84, w: 73.85, h: 4.83 },
      atrib: { x: 8.84, y: 69.41, w: 82.23, h: 15.95 },
    },
    icone: "/tier-badges/ouro.png",
  },
  {
    nome: "Platina",
    overallMinimo: 80,
    xpMinimo: 2000,
    ordem: 4,
    textClass: "text-tier-platina",
    cor: "var(--tier-platina)",
    destaque: "oklch(0.62 0.1 170)",
    chipClass: "bg-tier-platina/20 text-tier-platina",
    molde: "/card-moldes/platina.webp",
    layout: {
      hex: { x: 8.38, y: 9.74, w: 19.34, h: 16.78 },
      escudo: { x: 31.86, y: 15.81, w: 36, h: 42.4 },
      nome: { x: 13.17, y: 60.91, w: 73.3, h: 5.66 },
      atrib: { x: 8.75, y: 69.82, w: 82.23, h: 16.3 },
    },
    icone: "/tier-badges/platina.png",
  },
  {
    nome: "Lendário",
    overallMinimo: 90,
    xpMinimo: 4000,
    ordem: 5,
    textClass: "text-tier-lendario",
    cor: "var(--tier-lendario)",
    destaque: "oklch(0.74 0.12 85)",
    chipClass: "bg-tier-lendario/25 text-tier-lendario",
    molde: "/card-moldes/lendario.webp",
    layout: {
      hex: { x: 9.94, y: 11.46, w: 17.86, h: 15.68 },
      escudo: { x: 32.69, y: 15.68, w: 34.35, h: 44.96 },
      nome: { x: 15.01, y: 62.5, w: 69.8, h: 4.01 },
      atrib: { x: 10.96, y: 71.27, w: 77.99, h: 12.57 },
    },
    icone: "/tier-badges/lendario.png",
  },
  {
    nome: "GOAT",
    overallMinimo: 95,
    xpMinimo: 7000,
    ordem: 6,
    textClass: "text-tier-goat",
    cor: "var(--tier-goat)",
    destaque: "var(--tier-goat)",
    chipClass: "bg-tier-goat/20 text-tier-goat",
    molde: "/card-moldes/goat.webp",
    layout: {
      hex: { x: 9.67, y: 11.12, w: 18.51, h: 15.68 },
      escudo: { x: 33.33, y: 17.13, w: 33.33, h: 43.09 },
      nome: { x: 14.83, y: 62.36, w: 70.26, h: 3.31 },
      atrib: { x: 11.33, y: 71.2, w: 77.26, h: 12.36 },
    },
    icone: "/tier-badges/goat.png",
  },
];

export const MIN_AVALIACOES = 3;

/** XP médio que uma pelada rende (mesma premissa usada na calibragem dos tiers acima). */
export const XP_POR_PELADA_MEDIA = 38;

/** Próximo degrau a partir do tier já reconhecido (null = jogador ainda sem tier). */
export function tierSeguinte(atual: TierConfig | null): TierConfig | null {
  const ordem = atual?.ordem ?? 0;
  return TIERS.find((t) => t.ordem === ordem + 1) ?? null;
}

/** Tier é sempre derivado: overall E xp precisam bater o mínimo. */
export function tierDoJogador(overall: number, xp: number): TierConfig | null {
  let atual: TierConfig | null = null;
  for (const t of TIERS) {
    if (overall >= t.overallMinimo && xp >= t.xpMinimo) atual = t;
  }
  return atual;
}

/** Busca um tier pelo nome — usado pra exibir o tier "reconhecido" (já revelado) do jogador. */
export function tierPorNome(nome: string | null | undefined): TierConfig | null {
  return TIERS.find((t) => t.nome === nome) ?? null;
}

export function proximoTier(overall: number, xp: number): TierConfig | null {
  const atual = tierDoJogador(overall, xp);
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
