import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Quem entra com Google e ainda não tem foto ganha a foto da conta Google no perfil (a função
 * foto-do-google copia pro Goating). Roda uma vez por conta neste aparelho.
 */
export function FotoDoGoogle() {
  const queryClient = useQueryClient();

  useEffect(() => {
    async function copiar(usuario: {
      id: string;
      app_metadata?: { providers?: string[]; provider?: string };
    }) {
      const provedores = usuario.app_metadata?.providers ?? [usuario.app_metadata?.provider];
      if (!provedores.includes("google")) return;
      const chave = `goating-foto-google-${usuario.id}`;
      try {
        if (localStorage.getItem(chave)) return;
        localStorage.setItem(chave, "1");
      } catch {
        // sem armazenamento: tenta mesmo assim (a função não troca foto que já existe)
      }
      const { data } = await supabase.functions.invoke<{ feito?: boolean }>("foto-do-google");
      if (data?.feito) void queryClient.invalidateQueries({ queryKey: ["perfil", usuario.id] });
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void copiar(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_IN" && sessao) void copiar(sessao.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return null;
}
