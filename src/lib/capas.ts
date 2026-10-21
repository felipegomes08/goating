import { ehPremium } from "@/lib/premium";

/**
 * Capas Premium: o fundo do topo do perfil. A mesma lista vale no banco
 * (`profiles_aparencia_premium`): mudou aqui, muda lá.
 */
export type CapaId = "noite" | "estadio" | "ouro" | "neon" | "campo";

export type Capa = { id: CapaId; nome: string; fundo: string };

export const CAPAS: Capa[] = [
  {
    id: "estadio",
    nome: "Estádio",
    fundo:
      "radial-gradient(ellipse 55% 45% at 15% 0%, rgb(255 255 255 / 0.4), transparent 65%), radial-gradient(ellipse 55% 45% at 85% 0%, rgb(255 255 255 / 0.4), transparent 65%), repeating-linear-gradient(90deg, #1b7a3d 0 44px, #16703a 44px 88px)",
  },
  {
    id: "noite",
    nome: "Noite",
    fundo:
      "radial-gradient(circle, rgb(255 255 255 / 0.5) 0 1px, transparent 1.5px) 0 0 / 36px 36px, radial-gradient(circle, rgb(255 255 255 / 0.3) 0 1px, transparent 1.5px) 18px 18px / 36px 36px, linear-gradient(180deg, #0b1026, #1d2257 60%, #0b1026)",
  },
  {
    id: "ouro",
    nome: "Ouro",
    fundo: "linear-gradient(135deg, #2e2104, #7a5c0e 35%, #e9c45a 52%, #7a5c0e 68%, #2e2104)",
  },
  {
    id: "neon",
    nome: "Neon",
    fundo:
      "radial-gradient(ellipse 60% 50% at 10% 20%, rgb(255 43 214 / 0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 90% 80%, rgb(0 229 255 / 0.4), transparent 70%), linear-gradient(135deg, #14002b, #2a0055 50%, #001f33)",
  },
  {
    id: "campo",
    nome: "Campo",
    fundo:
      "radial-gradient(circle at 50% 50%, transparent 0 22%, rgb(255 255 255 / 0.25) 22.4% 23%, transparent 23.4%), linear-gradient(90deg, transparent 49.7%, rgb(255 255 255 / 0.25) 49.7% 50.3%, transparent 50.3%), repeating-linear-gradient(90deg, #0f3d2e 0 40px, #134a38 40px 80px)",
  },
];

export function capaPorId(id: string | null | undefined) {
  return CAPAS.find((c) => c.id === id) ?? null;
}

/** A capa que aparece: só vale enquanto o dono do perfil for Premium. */
export function capaDe(
  perfil:
    { plano?: string | null; premium_ate?: string | null; capa?: string | null } | null | undefined,
) {
  return ehPremium(perfil) ? capaPorId(perfil?.capa) : null;
}
