import { Link, useRouterState } from "@tanstack/react-router";
import { House, Plus, Trophy, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useChatsNaoLidos } from "@/hooks/use-chat";
import { vibrar } from "@/lib/placar/alarme";

/**
 * Barra de abas no estilo bolha do iOS: uma pílula flutuante e translúcida, a aba ativa ganha a
 * sua própria bolha por dentro e o criar fica no meio.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { userId } = useSession();
  const chats = useChatsNaoLidos(userId);

  const aba = (ativa: boolean) =>
    cn(
      "mx-0.5 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] transition-colors active:scale-95",
      ativa ? "bg-mint-soft font-bold text-primary" : "font-medium text-muted-foreground",
    );
  // aba ativa ganha traço mais grosso, como os ícones preenchidos do iOS
  const traco = (ativa: boolean) => (ativa ? 2.4 : 1.8);

  const noFeed = pathname === "/";
  const nasTurmas = pathname.startsWith("/turma");
  const noRanking = pathname.startsWith("/ranking");
  const noPerfil = pathname.startsWith("/perfil");

  return (
    <nav
      onClick={() => vibrar(8)}
      className="pointer-events-none sticky bottom-0 z-30 px-3 pt-2 pb-[max(var(--sa-bottom),0.75rem)]"
    >
      <div className="pointer-events-auto mx-auto flex h-16 w-full max-w-[460px] items-stretch rounded-full border border-border/60 bg-card/80 p-1.5 shadow-[0_8px_30px_rgba(15,61,46,0.18)] backdrop-blur-xl">
        <Link to="/" className={aba(noFeed)}>
          <House className="size-[22px]" strokeWidth={traco(noFeed)} />
          Feed
        </Link>

        <Link to="/turmas" className={aba(nasTurmas)}>
          <span className="relative">
            <Users className="size-[22px]" strokeWidth={traco(nasTurmas)} />
            {/* mensagens não lidas nos chats das turmas */}
            {chats.total > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white">
                {chats.total > 99 ? "99+" : chats.total}
              </span>
            )}
          </span>
          Turmas
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <Link
            to="/criar"
            aria-label="Criar pelada"
            className="flex size-12 items-center justify-center rounded-full bg-primary shadow-md transition-transform active:scale-90"
          >
            <Plus className="size-5 text-mint" strokeWidth={2.75} />
          </Link>
        </div>

        <Link to="/ranking" search={{ aba: "cidade" }} className={aba(noRanking)}>
          <Trophy className="size-[22px]" strokeWidth={traco(noRanking)} />
          Ranking
        </Link>

        <Link to="/perfil" className={aba(noPerfil)}>
          <User className="size-[22px]" strokeWidth={traco(noPerfil)} />
          Perfil
        </Link>
      </div>
    </nav>
  );
}
