import { ehPremium } from "@/lib/premium";

/**
 * Molduras Premium da carta. Ficam em volta da silhueta da carta, sem mudar a cor e o metal do
 * tier (esses continuam sendo conquistados jogando). A mesma lista vale no banco
 * (`profiles_aparencia_premium`): mudou aqui, muda lá.
 *
 * Dois tipos: as de código (borda em degradê girando) e as de arte (`arte`: imagem com o
 * efeito saindo da silhueta, em `public/molduras/`, animada por cima com `animacao`).
 */
export type MolduraId =
  "dourada" | "neon" | "fogo" | "gelo" | "estadio" | "cristais" | "furacao" | "tempestade";

export type Moldura = {
  id: MolduraId;
  nome: string;
  /** cores da borda, na ordem do degradê (e a cor da bolinha na hora de escolher) */
  cores: string[];
  /** cor do brilho em volta */
  brilho: string;
  /** partículas em volta da carta */
  particula: "faisca" | "brasa" | "neve" | "luz" | null;
  /** imagem do efeito (1000 × 1250, carta no mesmo lugar do molde de 1600 × 2000) */
  arte?: string;
  /** como a arte se mexe */
  animacao?: "chama" | "raio" | "cristal" | "vento" | "gelo";
};

/**
 * Onde a arte fica em relação à carta, em % do tamanho dela: o molde tem 1600 × 2000 com a
 * carta (1086 × 1448) no centro.
 */
export const CAIXA_DA_ARTE = {
  esquerda: -257 / 1086,
  topo: -276 / 1448,
  largura: 1600 / 1086,
  altura: 2000 / 1448,
};

export const MOLDURAS: Moldura[] = [
  {
    id: "fogo",
    nome: "Inferno",
    cores: ["#FFE082", "#FF9100", "#FF3D00", "#B71C1C", "#FFE082"],
    brilho: "#FF6D00",
    particula: "brasa",
    arte: "/molduras/inferno.webp",
    animacao: "chama",
  },
  {
    id: "tempestade",
    nome: "Tempestade",
    cores: ["#FFFFFF", "#82B1FF", "#2962FF", "#B388FF", "#FFFFFF"],
    brilho: "#82B1FF",
    particula: null,
    arte: "/molduras/tempestade.webp",
    animacao: "raio",
  },
  {
    id: "cristais",
    nome: "Cristais",
    cores: ["#E1BEE7", "#AB47BC", "#4DD0E1", "#7E57C2", "#E1BEE7"],
    brilho: "#B388FF",
    particula: "faisca",
    arte: "/molduras/cristais.webp",
    animacao: "cristal",
  },
  {
    id: "furacao",
    nome: "Furacão",
    cores: ["#ECEFF1", "#90A4AE", "#37474F", "#90A4AE", "#ECEFF1"],
    brilho: "#B0BEC5",
    particula: null,
    arte: "/molduras/furacao.webp",
    animacao: "vento",
  },
  {
    id: "gelo",
    nome: "Era do Gelo",
    cores: ["#FFFFFF", "#B3E5FC", "#4FC3F7", "#B3E5FC", "#FFFFFF"],
    brilho: "#81D4FA",
    particula: "neve",
    arte: "/molduras/era-gelo.webp",
    animacao: "gelo",
  },
  {
    id: "dourada",
    nome: "Dourada",
    cores: ["#FFF3B0", "#F7D774", "#B8860B", "#F7D774", "#FFF3B0"],
    brilho: "#F7D774",
    particula: "faisca",
  },
  {
    id: "neon",
    nome: "Neon",
    cores: ["#00E5FF", "#7C4DFF", "#FF2BD6", "#7C4DFF", "#00E5FF"],
    brilho: "#B04DFF",
    particula: null,
  },
  {
    id: "estadio",
    nome: "Estádio",
    cores: ["#FFFFFF", "#5EF28E", "#0F3D2E", "#5EF28E", "#FFFFFF"],
    brilho: "#5EF28E",
    particula: "luz",
  },
];

export function molduraPorId(id: string | null | undefined) {
  return MOLDURAS.find((m) => m.id === id) ?? null;
}

/** A moldura que aparece: só vale enquanto o dono da carta for Premium. */
export function molduraDe(
  perfil:
    | { plano?: string | null; premium_ate?: string | null; moldura?: string | null }
    | null
    | undefined,
) {
  return ehPremium(perfil) ? molduraPorId(perfil?.moldura) : null;
}
