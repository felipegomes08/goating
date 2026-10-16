import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NumerosDoJogador = {
  gols: number;
  assistencias: number;
  defesas: number;
  vitorias: number;
  jogos: number;
};

/**
 * Números da carreira inteira de um jogador: tudo que ele fez em todas as turmas e peladas
 * (somando os placares salvos). Pelada sem placar finalizado tem tudo zerado, então não pesa.
 */
export function useNumerosDoJogador(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["numeros-do-jogador", userId],
    enabled: !!userId,
    queryFn: async (): Promise<NumerosDoJogador> => {
      // o jogador aparece na lista de cada turma em que joga; o placar é ligado a essa linha
      const { data: cadastros, error } = await supabase
        .from("crew_members")
        .select("id")
        .eq("user_id", userId!);
      if (error) throw error;
      const zerado = { gols: 0, assistencias: 0, defesas: 0, vitorias: 0, jogos: 0 };
      if (!cadastros.length) return zerado;
      const { data: linhas, error: erroLinhas } = await supabase
        .from("match_players")
        .select("gols, assistencias, defesas, vitorias, jogos")
        .in(
          "member_id",
          cadastros.map((c) => c.id),
        );
      if (erroLinhas) throw erroLinhas;
      return linhas.reduce(
        (total, l) => ({
          gols: total.gols + l.gols,
          assistencias: total.assistencias + l.assistencias,
          defesas: total.defesas + l.defesas,
          vitorias: total.vitorias + l.vitorias,
          jogos: total.jogos + l.jogos,
        }),
        zerado,
      );
    },
  });
}
