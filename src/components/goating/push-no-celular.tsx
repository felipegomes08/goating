import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { ligarPushNoApp, noApp } from "@/lib/nativo";

/**
 * Dentro do app de celular, com alguém logado: pede permissão pros avisos, registra o
 * celular e, ao tocar num aviso, abre a tela dele. No navegador não faz nada.
 */
export function PushNoCelular() {
  const { userId } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!userId || !noApp()) return;
    void ligarPushNoApp((link) => router.history.push(link));
  }, [userId, router]);

  return null;
}
