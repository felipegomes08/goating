import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * O link de recuperação de senha nem sempre volta para /redefinir-senha:
 * quando o endereço de retorno não bate com o configurado no backend, o
 * Supabase joga a pessoa na raiz do site com os dados no fragmento (#) da URL.
 *
 * Aqui a gente lê esse fragmento e manda a pessoa para o lugar certo:
 * - token de recuperação  -> /redefinir-senha (mantendo o fragmento)
 * - erro (link expirado)  -> /auth com uma mensagem em português
 */
export function RecuperacaoRedirect() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const query = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
    if (!hash && !query) return;

    const params = new URLSearchParams(hash || query);
    const erro = params.get("error") || params.get("error_code");
    const tipo = params.get("type");
    const temToken = params.get("access_token") || params.get("token_hash") || params.get("code");

    if (erro) {
      const codigo = params.get("error_code") || params.get("error") || "";
      window.history.replaceState(null, "", window.location.pathname);
      navigate({ to: "/auth", search: { erro: codigo }, replace: true });
      return;
    }

    if (tipo === "recovery" && temToken && pathname !== "/redefinir-senha") {
      window.location.replace(`/redefinir-senha${window.location.search}${window.location.hash}`);
    }
  }, [navigate, pathname]);

  return null;
}
