import { useSession, usePerfil } from "@/hooks/use-session";
import { ehPremium } from "@/lib/premium";

/** Se a pessoa logada é Premium, e até quando (null = sem prazo). */
export function usePremium() {
  const { userId } = useSession();
  const { data: perfil, isLoading } = usePerfil(userId);
  return {
    premium: ehPremium(perfil),
    ate: perfil?.premium_ate ?? null,
    carregando: isLoading,
  };
}
