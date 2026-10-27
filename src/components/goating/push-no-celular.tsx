import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { ligarPushNoApp, noApp } from "@/lib/nativo";

/**
 * Dentro do app de celular, com alguém logado: pede permissão pros avisos, registra o
 * celular e, ao tocar num aviso, abre a tela dele. Aviso que chega com o app aberto vira um
 * toast com "Ver" (menos o do chat que a pessoa já está olhando). No navegador não faz nada.
 */
export function PushNoCelular() {
  const { userId } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!userId || !noApp()) return;
    void ligarPushNoApp(
      (link) => router.history.push(link),
      (aviso) => {
        if (aviso.link && router.state.location.pathname === aviso.link) return;
        toast(aviso.titulo, {
          description: aviso.corpo,
          ...(aviso.link
            ? { action: { label: "Ver", onClick: () => router.history.push(aviso.link!) } }
            : {}),
        });
      },
    );
  }, [userId, router]);

  return null;
}
