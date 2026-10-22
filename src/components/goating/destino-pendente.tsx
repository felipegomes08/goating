import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Quem cria a conta por um convite (link de turma ou de pelada) guarda o destino na conta
 * (`destino` nos dados do cadastro). Na primeira vez que a pessoa entra, inclusive depois de
 * confirmar o e-mail em outro navegador, ela vai pra lá e o destino é apagado.
 */
export function DestinoPendente() {
  const router = useRouter();
  const feito = useRef(false);

  useEffect(() => {
    async function seguir(destino: unknown) {
      if (feito.current || typeof destino !== "string" || !destino.startsWith("/")) return;
      feito.current = true;
      await supabase.auth.updateUser({ data: { destino: null } });
      if (window.location.pathname + window.location.search !== destino) {
        router.history.replace(destino);
      }
    }
    void supabase.auth.getSession().then(({ data }) => {
      void seguir(data.session?.user.user_metadata?.["destino"]);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sessao) => {
      void seguir(sessao?.user.user_metadata?.["destino"]);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  return null;
}
