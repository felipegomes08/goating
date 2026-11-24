import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { ouvirLinksNoApp } from "@/lib/nativo";

/**
 * Dentro do app de celular: link do goating.com.br (ex.: o de avaliar a pelada mandado no
 * grupo) abre direto a tela dele no app, em vez do site. No navegador não faz nada.
 */
export function LinksNoApp() {
  const router = useRouter();

  useEffect(() => {
    let parar: (() => void) | undefined;
    let cancelado = false;
    void ouvirLinksNoApp((caminho) => {
      const atual = `${router.state.location.pathname}${router.state.location.searchStr ?? ""}`;
      if (caminho !== atual) router.history.push(caminho);
    }).then((f) => {
      if (cancelado) f();
      else parar = f;
    });
    return () => {
      cancelado = true;
      parar?.();
    };
  }, [router]);

  return null;
}
