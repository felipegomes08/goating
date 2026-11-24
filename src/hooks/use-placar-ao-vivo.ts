import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ehEstadoPlacar, type EstadoPlacar } from "@/lib/placar/estado";

/** O que a tela ao vivo recebe do banco (função placar_ao_vivo): só placar, lances e nomes. */
export type PlacarAoVivo = {
  id: string;
  titulo: string;
  status: string;
  data: string;
  horario: string;
  nomes_times: string[] | null;
  cores_times: (string | null)[] | null;
  minutos_tempo: number | null;
  tempos: number | null;
  estado: EstadoPlacar | null;
  /** hora da última mudança do placar (servidor) */
  atualizado_em: string | null;
  /** nome de quem está marcando */
  marcador: string | null;
  jogadores: Record<string, { nome: string; foto: string | null }>;
  /** diferença entre o relógio do servidor e o do aparelho, em ms */
  ajusteDoRelogio: number;
};

/**
 * Placar de uma pelada pra quem assiste: busca uma vez e refaz a cada mudança da pelada no banco
 * (o marcador salva o placar a cada 2s). `ligado` desliga a escuta (ex.: card fora do ao vivo).
 */
export function usePlacarAoVivo(matchId: string, ligado = true) {
  const queryClient = useQueryClient();
  const chave = ["placar-ao-vivo", matchId];

  const consulta = useQuery({
    queryKey: chave,
    enabled: ligado,
    queryFn: async (): Promise<PlacarAoVivo | null> => {
      const antes = Date.now();
      const { data, error } = await supabase.rpc("placar_ao_vivo", { p_match_id: matchId });
      if (error) throw error;
      if (!data || typeof data !== "object") return null;
      const bruto = data as unknown as Omit<PlacarAoVivo, "ajusteDoRelogio" | "estado"> & {
        estado: unknown;
        agora: string;
      };
      const meio = (antes + Date.now()) / 2;
      return {
        ...bruto,
        estado: ehEstadoPlacar(bruto.estado) ? bruto.estado : null,
        jogadores: bruto.jogadores ?? {},
        ajusteDoRelogio: new Date(bruto.agora).getTime() - meio,
      };
    },
  });

  useEffect(() => {
    if (!ligado) return;
    const atualizar = () => void queryClient.invalidateQueries({ queryKey: chave });
    const canal = supabase
      .channel(`ao-vivo-${matchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        atualizar,
      )
      .subscribe();
    // voltou pro app depois de um tempo: busca de novo (o canal pode ter caído no meio)
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, ligado, queryClient]);

  return consulta;
}
