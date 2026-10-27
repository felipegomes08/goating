import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

/**
 * Um ouvinte só, no app inteiro: mensagem nova (ou apagada) em qualquer chat das turmas da
 * pessoa atualiza os contadores de não lidas (aba Turmas, cartões e botão do chat).
 * A RLS já filtra: só chegam as mensagens das turmas de que ela participa.
 */
export function ChatAoVivo() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const atualizar = () =>
      void queryClient.invalidateQueries({ queryKey: ["chats-nao-lidos", userId] });
    const canal = supabase
      .channel(`chats-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens_da_turma" },
        atualizar,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensagens_da_turma" },
        atualizar,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId, queryClient]);

  return null;
}
