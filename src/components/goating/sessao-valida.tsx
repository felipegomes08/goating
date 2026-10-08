import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";

/**
 * Tira do app quem está com a sessão de uma conta que não existe mais.
 *
 * O aparelho guarda o "crachá" de login por um tempo. Se a conta foi apagada
 * (pelo próprio usuário em outro aparelho, ou no banco), o crachá continua
 * abrindo o app, só que sem perfil: tela pedindo pra "completar cadastro" de
 * uma conta que nem existe. Aqui a gente confere com o servidor e, se a conta
 * sumiu mesmo, esquece a sessão e manda pra tela de entrar.
 */
export function SessaoValida() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const perfil = usePerfil(userId);
  const conferindo = useRef(false);

  const semPerfil = !!userId && perfil.isSuccess && perfil.data === null;

  useEffect(() => {
    if (!semPerfil || conferindo.current) return;
    conferindo.current = true;
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      // Só desloga com a resposta clara de que a conta não existe. Falha de rede
      // (sem status) não conta: ninguém pode ser deslogado por estar sem sinal.
      const contaSumiu = !data.user && !!error && [401, 403, 404].includes(error.status ?? 0);
      if (contaSumiu) {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut({ scope: "local" });
        toast("Essa conta não existe mais. Entre ou crie uma nova.");
        await navigate({ to: "/auth", replace: true });
      }
      conferindo.current = false;
    })();
  }, [semPerfil, navigate, queryClient]);

  return null;
}
