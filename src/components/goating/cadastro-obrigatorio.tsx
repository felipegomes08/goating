import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSession, usePerfil } from "@/hooks/use-session";
import { cadastroCompleto } from "@/lib/cadastro";

/** Telas que funcionam sem cadastro completo (entrar, senha, textos públicos e o link de convite). */
const LIVRES = [
  "/completar-cadastro",
  "/auth",
  "/redefinir-senha",
  "/privacidade",
  "/sobre",
  "/p/",
];

/**
 * Trava o app pra quem entrou mas ainda não tem nome, cidade e posição: qualquer outra tela
 * manda pra "Complete seu cadastro", que depois devolve pra onde a pessoa ia. Convidado (quem
 * entrou só pelo link de uma pelada, sem conta) não passa por aqui.
 */
export function CadastroObrigatorio() {
  const navigate = useNavigate();
  const { userId } = useSession();
  const { data: perfil } = usePerfil(userId);
  const local = useRouterState({ select: (s) => s.location });

  const livre = LIVRES.some((c) =>
    c.endsWith("/") ? local.pathname.startsWith(c) : local.pathname === c,
  );
  const travar = !!perfil && !perfil.eh_convidado && !cadastroCompleto(perfil) && !livre;

  useEffect(() => {
    if (!travar) return;
    void navigate({
      to: "/completar-cadastro",
      search: { voltar: local.href },
      replace: true,
    });
  }, [travar, local.href, navigate]);

  return null;
}
