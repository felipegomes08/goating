import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cadeado dourado de recurso Premium. Tocar abre uma folha explicando o que é e levando pra
 * tela do Premium. Sem `children`, mostra só o ícone; com `children`, envolve o conteúdo
 * (uma aba, uma coluna) e o toque nele abre a folha.
 */
export function Cadeado({
  recurso,
  children,
  className,
}: {
  /** o que está trancado, em poucas palavras: "Ranking completo", "Ordenar por gols" */
  recurso: string;
  children?: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`${recurso}: Premium`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberto(true);
        }}
        className={cn("inline-flex items-center gap-1", className)}
      >
        {children}
        <Lock className="size-3 shrink-0 text-tier-ouro" />
      </button>
      {aberto && <FolhaPremium recurso={recurso} onFechar={() => setAberto(false)} />}
    </>
  );
}

/** Folha "Isso é Premium": diz o que está trancado e leva pra tela do Premium. */
export function FolhaPremium({ recurso, onFechar }: { recurso: string; onFechar: () => void }) {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Recurso Premium"
        className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6 text-center"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-tier-ouro/20">
          <Crown className="size-6 fill-tier-ouro text-tier-ouro" />
        </span>
        <h2 className="text-lg font-extrabold text-foreground">{recurso} é Premium</h2>
        <p className="text-sm text-muted-foreground">
          Com o Goating Premium você mostra sua carta completa, vê o ranking inteiro e acompanha sua
          evolução.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onFechar}>
            Agora não
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onFechar();
              void navigate({ to: "/premium" });
            }}
          >
            Conhecer o Premium
          </Button>
        </div>
      </div>
    </div>
  );
}
