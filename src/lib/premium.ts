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
