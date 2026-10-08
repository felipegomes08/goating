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

export type Periodo = "mes" | "ano" | "tudo";

export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "mes", rotulo: "Mês" },
  { id: "ano", rotulo: "Ano" },
  { id: "tudo", rotulo: "Tudo" },
];

function inicioDoPeriodo(periodo: Periodo) {
  const hoje = new Date();
  if (periodo === "tudo") return null;
  const mes = periodo === "mes" ? hoje.getMonth() + 1 : 1;
  return `${hoje.getFullYear()}-${String(mes).padStart(2, "0")}-01`;
}

/** "outubro de 2026", "2026" ou "desde o começo" */
export function rotuloDoPeriodo(periodo: Periodo) {
  return periodo === "mes"
    ? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : periodo === "ano"
      ? String(new Date().getFullYear())
      : "desde o começo";
}

/** Números de cada jogador da turma no período, já com média de gols e aproveitamento. */
export function useRankingDaTurma(crewId: string | null, periodo: Periodo, ligado = true) {
  return useQuery({
    queryKey: ["turma-ranking", crewId, periodo],
    enabled: !!crewId && ligado,
    queryFn: async () => {
      const desde = inicioDoPeriodo(periodo);
      const { data, error } = await supabase.rpc("crew_stats", {
        p_crew_id: crewId!,
        ...(desde ? { p_desde: desde } : {}),
      });
      if (error) throw error;
      return data.map((l) => ({
        ...l,
        // 3 pontos por vitória, 1 por empate, sobre o máximo possível
        aproveitamento:
          l.jogos > 0 ? Math.round(((l.vitorias * 3 + l.empates) / (l.jogos * 3)) * 100) : 0,
        media: l.jogos > 0 ? l.gols / l.jogos : 0,
      }));
    },
  });
}
