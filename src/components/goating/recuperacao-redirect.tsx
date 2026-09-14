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
// Capturado na importação do módulo: o client do Supabase limpa o fragmento
// da URL assim que é criado, então precisamos guardar antes disso.
const HASH_INICIAL = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
const QUERY_INICIAL = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";

export function RecuperacaoRedirect() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = HASH_INICIAL;
    const query = QUERY_INICIAL;
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
      const sufixo = hash ? `#${hash}` : `?${query}`;
      window.location.replace(`/redefinir-senha${sufixo}`);
    }
  }, [navigate, pathname]);

  return null;
}
