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
      // escudo e capa vêm direto da turma (a função do resumo não devolve as fotos)
      const { data: fotos } = data.length
        ? await supabase
            .from("crews")
            .select("id, escudo_url, capa_url, nota, avaliacoes")
            .in(
              "id",
              data.map((t) => t.crew_id),
            )
        : { data: [] };
      return data.map((t) => {
        const foto = (fotos ?? []).find((f) => f.id === t.crew_id);
        return {
          ...t,
          escudo_url: foto?.escudo_url ?? null,
          capa_url: foto?.capa_url ?? null,
          nota: foto?.nota ?? null,
          avaliacoes: foto?.avaliacoes ?? 0,
        };
      });
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

type LinhaDoCrewStats = { jogos: number; vitorias: number; empates: number; gols: number };

const comMedias = <T extends LinhaDoCrewStats>(l: T) => ({
  ...l,
  // 3 pontos por vitória, 1 por empate, sobre o máximo possível
  aproveitamento:
    l.jogos > 0 ? Math.round(((l.vitorias * 3 + l.empates) / (l.jogos * 3)) * 100) : 0,
  media: l.jogos > 0 ? l.gols / l.jogos : 0,
});

/**
 * Ranking da turma no período antes da última pelada com placar (pra setinha de subiu/caiu).
 * Nulo quando não tem pelada anterior no período pra comparar.
 */
export function useRankingAntesDaUltima(crewId: string | null, periodo: Periodo, ligado = true) {
  return useQuery({
    queryKey: ["turma-ranking-anterior", crewId, periodo],
    enabled: !!crewId && ligado,
    queryFn: async () => {
      const desde = inicioDoPeriodo(periodo);
      const { data: ultima, error: erroUltima } = await supabase
        .from("matches")
        .select("data")
        .eq("crew_id", crewId!)
        .not("placar_finalizado_em", "is", null)
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (erroUltima) throw erroUltima;
      if (!ultima) return null;
      const vespera = new Date(`${ultima.data}T12:00:00`);
      vespera.setDate(vespera.getDate() - 1);
      const ate = vespera.toLocaleDateString("sv-SE");
      if (desde && ate < desde) return null;
      const { data, error } = await supabase.rpc("crew_stats", {
        p_crew_id: crewId!,
        p_ate: ate,
        ...(desde ? { p_desde: desde } : {}),
      });
      if (error) throw error;
      return data.length ? data.map(comMedias) : null;
    },
  });
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
      return data.map(comMedias);
    },
  });
}
