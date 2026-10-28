import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useChatsNaoLidos } from "@/hooks/use-chat";

/** O tempo real aceita no máximo 100 valores num filtro "in". */
const MAX_TURMAS = 100;

/**
 * Um ouvinte só, no app inteiro: mensagem nova (ou apagada) em qualquer chat das turmas da
 * pessoa atualiza os contadores de não lidas (aba Turmas, cartões e botão do chat).
 * O filtro pelas turmas dela faz o servidor só olhar as mensagens que interessam, em vez de
 * conferir cada mensagem do app inteiro contra cada pessoa online.
 */
export function ChatAoVivo() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const { turmas } = useChatsNaoLidos(userId);
  // texto estável: o contador recarrega a cada mensagem e não pode refazer a inscrição
  const filtro = [...turmas].sort().slice(0, MAX_TURMAS).join(",");

  useEffect(() => {
    if (!userId || !filtro) return;
    const atualizar = () =>
      void queryClient.invalidateQueries({ queryKey: ["chats-nao-lidos", userId] });
    const canal = supabase
      .channel(`chats-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_da_turma",
          filter: `crew_id=in.(${filtro})`,
        },
        atualizar,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensagens_da_turma",
          filter: `crew_id=in.(${filtro})`,
        },
        // só mensagem apagada muda o contador (as outras mudanças, como marcar o aviso
        // do celular como enviado, não)
        (payload: { new: { apagada_em?: string | null } }) => {
          if (payload.new.apagada_em) atualizar();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId, filtro, queryClient]);

  return null;
}
