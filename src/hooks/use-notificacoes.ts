import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida_em: string | null;
  criado_em: string;
};

/**
 * As notificações da pessoa (as 80 mais novas) e quantas ainda não foram lidas. O banco
 * avisa na hora quando chega uma nova, e a lista se atualiza sozinha.
 */
export function useNotificacoes(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const chave = ["notificacoes", userId];

  const consulta = useQuery({
    queryKey: chave,
    enabled: !!userId,
    queryFn: async (): Promise<Notificacao[]> => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, tipo, titulo, corpo, link, lida_em, criado_em")
        .order("criado_em", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const canal = supabase
      // nome único: duas telas abertas ao mesmo tempo não brigam pelo mesmo canal
      .channel(`notificacoes-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ["notificacoes", userId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId, queryClient]);

  async function marcarLida(id: string) {
    queryClient.setQueryData<Notificacao[]>(chave, (lista) =>
      lista?.map((n) =>
        n.id === id && !n.lida_em ? { ...n, lida_em: new Date().toISOString() } : n,
      ),
    );
    await supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", id)
      .is("lida_em", null);
  }

  async function marcarTodas() {
    const agora = new Date().toISOString();
    queryClient.setQueryData<Notificacao[]>(chave, (lista) =>
      lista?.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })),
    );
    await supabase.from("notificacoes").update({ lida_em: agora }).is("lida_em", null);
  }

  const lista = consulta.data ?? [];
  return {
    lista,
    carregando: consulta.isLoading,
    naoLidas: lista.filter((n) => !n.lida_em).length,
    marcarLida,
    marcarTodas,
  };
}
