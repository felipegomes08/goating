import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Liga = Tables<"ligas">;
export type Premio = Tables<"premios_de_liga">;

export type LinhaDaLiga = {
  posicao: number;
  member_id: string;
  user_id: string | null;
  nome: string;
  foto_url: string | null;
  pontos: number;
  peladas: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols: number;
  assistencias: number;
  defesas: number;
  mvps: number;
};

/** As ligas da turma, da mais nova pra mais antiga, com os prêmios das que acabaram. */
export function useLigasDaTurma(crewId: string | null, ligado = true) {
  return useQuery({
    queryKey: ["ligas-da-turma", crewId],
    enabled: !!crewId && ligado,
    queryFn: async () => {
      const { data: ligas, error } = await supabase
        .from("ligas")
        .select("*")
        .eq("crew_id", crewId!)
        .order("inicio", { ascending: false });
      if (error) throw error;
      const encerradas = ligas.filter((l) => l.encerrada_em).map((l) => l.id);
      const { data: premios } = encerradas.length
        ? await supabase.from("premios_de_liga").select("*").in("liga_id", encerradas)
        : { data: [] as Premio[] };
      return { ligas, premios: premios ?? [] };
    },
  });
}

export function useLiga(ligaId: string) {
  return useQuery({
    queryKey: ["liga", ligaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ligas")
        .select("*")
        .eq("id", ligaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** A tabela da liga (crew_stats no período, com os pontos dela). */
export function useTabelaDaLiga(ligaId: string | null) {
  return useQuery({
    queryKey: ["tabela-da-liga", ligaId],
    enabled: !!ligaId,
    queryFn: async (): Promise<LinhaDaLiga[]> => {
      const { data, error } = await supabase.rpc("tabela_da_liga", { p_liga_id: ligaId! });
      if (error) throw error;
      return data;
    },
  });
}

/** Rodadas da liga: as peladas da turma com placar encerrado dentro do período. */
export function useRodadasDaLiga(liga: Pick<Liga, "id" | "crew_id" | "inicio" | "fim"> | null) {
  return useQuery({
    queryKey: ["rodadas-da-liga", liga?.id],
    enabled: !!liga,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("crew_id", liga!.crew_id)
        .not("placar_finalizado_em", "is", null)
        .gte("data", liga!.inicio)
        .lte("data", liga!.fim);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function usePremiosDaLiga(ligaId: string, ligado: boolean) {
  return useQuery({
    queryKey: ["premios-da-liga", ligaId],
    enabled: ligado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premios_de_liga")
        .select("*")
        .eq("liga_id", ligaId);
      if (error) throw error;
      return data;
    },
  });
}

/** Os troféus de liga de uma pessoa (perfil e página do jogador). */
export function useTrofeus(userId: string | null) {
  return useQuery({
    queryKey: ["trofeus", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: premios, error } = await supabase
        .from("premios_de_liga")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      if (!premios.length) return [];
      const ids = [...new Set(premios.map((p) => p.liga_id))];
      const { data: ligas } = await supabase
        .from("ligas")
        .select("id, nome, fim, crew_id")
        .in("id", ids);
      const turmasIds = [...new Set((ligas ?? []).map((l) => l.crew_id))];
      const { data: turmas } = turmasIds.length
        ? await supabase.from("crews").select("id, nome").in("id", turmasIds)
        : { data: [] as { id: string; nome: string }[] };
      return premios
        .map((p) => {
          const liga = (ligas ?? []).find((l) => l.id === p.liga_id);
          return {
            ...p,
            liga: liga?.nome ?? "Liga",
            fim: liga?.fim ?? "",
            turma: (turmas ?? []).find((t) => t.id === liga?.crew_id)?.nome ?? null,
          };
        })
        .sort((a, b) => b.fim.localeCompare(a.fim));
    },
  });
}
