import { Link, useRouterState } from "@tanstack/react-router";
import { House, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const item = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-card">
      <div className="relative mx-auto flex w-full max-w-[480px] items-stretch">
        <Link to="/" className={item(pathname === "/")}>
          <House className="size-5" strokeWidth={2} />
          Feed
        </Link>

        <div className="flex flex-1 justify-center">
          <Link
            to="/criar"
            aria-label="Criar pelada"
            className="absolute -top-6 flex size-[52px] items-center justify-center rounded-full border-4 border-card bg-primary shadow-[var(--shadow-float)]"
          >
            <Plus className="size-6 text-mint" strokeWidth={2.5} />
          </Link>
          <span className="pt-9 pb-3 text-[11px] font-medium text-muted-foreground">Criar</span>
        </div>

        <Link to="/perfil" className={item(pathname.startsWith("/perfil"))}>
          <User className="size-5" strokeWidth={2} />
          Perfil
        </Link>
      </div>
    </nav>
  );
}
