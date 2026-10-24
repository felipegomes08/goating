/**
 * Premium: vale enquanto `plano` for "premium" e a data de `premium_ate` não tiver passado
 * (sem data = sem prazo). O banco confere a mesma regra em `eh_premium`.
 */
export function ehPremium(
  perfil: { plano?: string | null; premium_ate?: string | null } | null | undefined,
) {
  if (!perfil || perfil.plano !== "premium") return false;
  return !perfil.premium_ate || new Date(perfil.premium_ate).getTime() > Date.now();
}

/** Preços do Premium (os mesmos do Stripe) e a promoção de lançamento. */
export const PRECOS_PREMIUM = {
  mensal: "R$ 9,90",
  anual: "R$ 79,90",
  anualPorMes: "R$ 6,66",
  promocao: "R$ 0,99",
};

/** Quem assinar o mensal até 30/11/2026 (23h59 de Brasília) paga R$ 0,99 no 1º mês. */
export const FIM_DA_PROMOCAO = Date.parse("2026-11-30T23:59:59-03:00");

export const promocaoNoAr = () => Date.now() <= FIM_DA_PROMOCAO;
