import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Turmas em que o usuário está (como dono ou jogador), com o resumo do mês. */
export function useMinhasTurmas(userId: string | null) {
  return useQuery({
    queryKey: ["minhas-turmas-resumo", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("minhas_turmas");
      if (error) throw error;
      return data;
    },
  });
}

export type TurmaResumo = NonNullable<ReturnType<typeof useMinhasTurmas>["data"]>[number];
