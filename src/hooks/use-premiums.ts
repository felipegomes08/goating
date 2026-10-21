import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ehPremium } from "@/lib/premium";

/**
 * Quem é Premium numa lista de pessoas (pra mostrar a coroa ao lado do nome nos times, no
 * placar e no resumo). Ids nulos (convidados sem conta) são ignorados.
 */
export function usePremiums(ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((id): id is string => !!id))].sort();
  const { data } = useQuery({
    queryKey: ["premiums", unicos],
    enabled: unicos.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, plano, premium_ate")
        .in("id", unicos);
      if (error) throw error;
      return new Set(data.filter(ehPremium).map((p) => p.id));
    },
  });
  return data ?? new Set<string>();
}
