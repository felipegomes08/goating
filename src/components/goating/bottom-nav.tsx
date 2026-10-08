import { Link, useRouterState } from "@tanstack/react-router";
import { House, Plus, Trophy, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrar } from "@/lib/placar/alarme";

/** Barra de abas no estilo iOS: fundo translúcido, cinco espaços iguais, criar no meio sem saltar pra fora. */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const aba = (ativa: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors active:opacity-60",
      ativa ? "font-semibold text-primary" : "font-medium text-muted-foreground",
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
      className="sticky bottom-0 z-30 border-t border-border/60 bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 w-full max-w-[480px] items-stretch">
        <Link to="/" className={aba(noFeed)}>
          <House className="size-[22px]" strokeWidth={traco(noFeed)} />
          Feed
        </Link>

        <Link to="/turmas" className={aba(nasTurmas)}>
          <Users className="size-[22px]" strokeWidth={traco(nasTurmas)} />
          Turmas
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <Link
            to="/criar"
            aria-label="Criar pelada"
            className="flex h-9 w-12 items-center justify-center rounded-full bg-primary transition-transform active:scale-90"
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
