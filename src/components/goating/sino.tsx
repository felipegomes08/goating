import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useNotificacoes } from "@/hooks/use-notificacoes";

/** Sino do topo: abre as notificações e mostra quantas ainda não foram lidas. */
export function Sino() {
  const { userId } = useSession();
  const { naoLidas } = useNotificacoes(userId);
  return (
    <Link
      to="/notificacoes"
      aria-label={naoLidas ? `Notificações: ${naoLidas} novas` : "Notificações"}
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-primary-foreground active:opacity-60"
    >
      <Bell className="size-[18px]" />
      {naoLidas > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-tier-ouro px-1 text-[10px] font-black text-primary tabular-nums">
          {naoLidas > 9 ? "9+" : naoLidas}
        </span>
      )}
    </Link>
  );
}
