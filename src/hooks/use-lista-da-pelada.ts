import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type RespostaDaLista = "vou" | "pendente" | "nao_vou" | null;

export type PessoaDaLista = {
  user_id: string;
  nome: string;
  foto_url: string | null;
  resposta: RespostaDaLista;
};

export type ListaDaPelada = {
  pelada: {
    id: string;
    titulo: string;
    data: string;
    horario: string;
    local: string;
    vagas: number;
    confirmados: number;
    comecou: boolean;
  };
  pessoas: PessoaDaLista[];
};

/**
 * A lista de presença de uma pelada (cartão do chat e barra fixa), atualizada na hora quando
 * alguém responde, e o "Vou"/"Não vou" de quem está vendo.
 */
export function useListaDaPelada(matchId: string, userId: string | null) {
  const queryClient = useQueryClient();
  const [respondendo, setRespondendo] = useState<boolean | null>(null);

  const consulta = useQuery({
    queryKey: ["lista-da-pelada", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lista_da_pelada", { p_match_id: matchId });
      if (error) throw error;
      return data as unknown as ListaDaPelada | null;
    },
  });

  useEffect(() => {
    const atualizar = () =>
      void queryClient.invalidateQueries({ queryKey: ["lista-da-pelada", matchId] });
    const filtro = `match_id=eq.${matchId}`;
    const canal = supabase
      .channel(`lista-${matchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_participants", filter: filtro },
        atualizar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nao_vou", filter: filtro },
        atualizar,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [matchId, queryClient]);

  async function responder(vou: boolean) {
    setRespondendo(vou);
    const { data, error } = await supabase.rpc("responder_lista", {
      p_match_id: matchId,
      p_vou: vou,
    });
    setRespondendo(null);
    if (error) {
      toast.error(
        /Lotou|começou|turma/.test(error.message) ? error.message : "Não deu pra responder.",
      );
      return false;
    }
    toast.success(
      data === "nao_vou" ? "Beleza, fica pra próxima." : "Tá dentro! Seu nome entrou na lista.",
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lista-da-pelada", matchId] }),
      queryClient.invalidateQueries({ queryKey: ["pelada", matchId] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
    ]);
    return true;
  }

  const minha: RespostaDaLista =
    consulta.data?.pessoas.find((p) => p.user_id === userId)?.resposta ?? null;

  return { ...consulta, minha, responder, respondendo };
}
