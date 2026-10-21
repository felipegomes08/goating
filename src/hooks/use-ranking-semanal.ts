import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Segunda-feira desta semana (horário local), "aaaa-mm-dd": a semana da foto do ranking. */
function inicioDaSemana() {
  const hoje = new Date();
  const dia = (hoje.getDay() + 6) % 7; // segunda = 0
  hoje.setDate(hoje.getDate() - dia);
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

/**
 * Posições da última foto do ranking (tirada toda segunda): pra setinha de subiu/caiu. Compara
 * com a semana passada; sem ela ainda, com a foto desta semana.
 */
export function usePosicoesDaSemana(escopo: "geral" | "cidade", ligado: boolean) {
  return useQuery({
    queryKey: ["ranking-semanal", escopo],
    enabled: ligado,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const esta = inicioDaSemana();
      const { data: anterior } = await supabase
        .from("ranking_semanal")
        .select("semana")
        .lt("semana", esta)
        .order("semana", { ascending: false })
        .limit(1)
        .maybeSingle();
      const semana = anterior?.semana ?? esta;
      const { data, error } = await supabase
        .from("ranking_semanal")
        .select("user_id, posicao_geral, posicao_cidade")
        .eq("semana", semana);
      if (error) throw error;
      return new Map(
        data.map((l) => [l.user_id, escopo === "geral" ? l.posicao_geral : l.posicao_cidade]),
      );
    },
  });
}

/** As últimas semanas de uma pessoa no ranking (da mais antiga pra mais nova). */
export function useHistoricoNoRanking(userId: string | null, ligado: boolean) {
  return useQuery({
    queryKey: ["ranking-historico", userId],
    enabled: !!userId && ligado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ranking_semanal")
        .select("semana, posicao_geral, posicao_cidade")
        .eq("user_id", userId!)
        .order("semana", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data.reverse();
    },
  });
}
