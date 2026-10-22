import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cadeado dourado de recurso Premium. Tocar leva direto pra tela do Premium, que abre dizendo
 * o que a pessoa tentou ver. Sem `children`, mostra só o ícone; com `children`, envolve o
 * conteúdo (uma aba, uma coluna) e o toque nele leva pro Premium.
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
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label={`${recurso}: Premium`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void navigate({ to: "/premium", search: { recurso } });
      }}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {children}
      <Lock className="size-3 shrink-0 text-tier-ouro" />
    </button>
  );
}

/**
 * Leva pra tela do Premium assim que aparece (quem tocou num recurso trancado vai direto pra
 * onde assina, sem passo no meio). `onFechar` limpa o estado de quem abriu.
 */
export function FolhaPremium({ recurso, onFechar }: { recurso: string; onFechar: () => void }) {
  const navigate = useNavigate();
  const foi = useRef(false);
  useEffect(() => {
    if (foi.current) return;
    foi.current = true;
    onFechar();
    void navigate({ to: "/premium", search: { recurso } });
  }, [navigate, onFechar, recurso]);
  return null;
}
