import { ehPremium } from "@/lib/premium";

/**
 * Capas Premium: o fundo do topo do perfil e do cartão compartilhado. A mesma lista vale no
 * banco (`profiles_aparencia_premium`): mudou aqui, muda lá.
 *
 * As de imagem (`imagem`, em `public/capas/`) também viram o fundo do cartão compartilhado.
 */
export type CapaId = "noite" | "estadio" | "ouro" | "neon" | "campo" | "coletiva" | "galaxia";

export type Capa = { id: CapaId; nome: string; fundo: string; imagem?: string };

/** Fundo de imagem com um véu escuro, pra o texto branco do topo continuar legível. */
const comImagem = (url: string) =>
  `linear-gradient(180deg, rgb(3 16 11 / 0.55), rgb(3 16 11 / 0.15) 40%, rgb(3 16 11 / 0.6)), url(${url}) center / cover no-repeat`;

export const CAPAS: Capa[] = [
  {
    id: "estadio",
    nome: "Estádio",
    fundo: comImagem("/capas/estadio.webp"),
    imagem: "/capas/estadio.webp",
  },
  {
    id: "coletiva",
    nome: "Coletiva",
    fundo: comImagem("/capas/coletiva.webp"),
    imagem: "/capas/coletiva.webp",
  },
  {
    id: "galaxia",
    nome: "Galáxia",
    fundo: comImagem("/capas/galaxia.webp"),
    imagem: "/capas/galaxia.webp",
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
