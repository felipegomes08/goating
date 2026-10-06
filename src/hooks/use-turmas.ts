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

/** "você é o 3º · 4 gols no mês" */
export function minhaSituacao(turma: TurmaResumo) {
  if (turma.minha_posicao === null) {
    return turma.peladas === 0
      ? "Nenhuma pelada com placar ainda"
      : "Você ainda não jogou esse mês";
  }
  const gols = `${turma.meus_gols} ${turma.meus_gols === 1 ? "gol" : "gols"} no mês`;
  return turma.meus_gols > 0 ? `Você é o ${turma.minha_posicao}º · ${gols}` : `Você · ${gols}`;
}
