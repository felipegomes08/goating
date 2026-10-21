import { ehPremium } from "@/lib/premium";

/**
 * Molduras Premium da carta. Ficam em volta da silhueta da carta, sem mudar a cor e o metal do
 * tier (esses continuam sendo conquistados jogando). A mesma lista vale no banco
 * (`profiles_aparencia_premium`): mudou aqui, muda lá.
 */
export type MolduraId = "dourada" | "neon" | "fogo" | "gelo" | "estadio";

export type Moldura = {
  id: MolduraId;
  nome: string;
  /** cores da borda, na ordem do degradê (a imagem compartilhada usa as mesmas) */
  cores: string[];
  /** cor do brilho em volta */
  brilho: string;
  /** partículas em volta da carta */
  particula: "faisca" | "brasa" | "neve" | "luz" | null;
};

export const MOLDURAS: Moldura[] = [
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
    id: "fogo",
    nome: "Fogo",
    cores: ["#FFE082", "#FF9100", "#FF3D00", "#B71C1C"],
    brilho: "#FF6D00",
    particula: "brasa",
  },
  {
    id: "gelo",
    nome: "Gelo",
    cores: ["#FFFFFF", "#B3E5FC", "#4FC3F7", "#B3E5FC", "#FFFFFF"],
    brilho: "#81D4FA",
    particula: "neve",
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
