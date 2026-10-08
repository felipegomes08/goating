import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrar } from "@/lib/placar/alarme";

/** Quanto precisa puxar (em px na tela) pra soltar e atualizar. */
const LIMITE = 64;
const MAXIMO = 96;

/**
 * Puxar a tela pra baixo, no topo, recarrega os dados da página.
 * Basta colocar dentro da tela: não recebe nada e não envolve o conteúdo.
 */
export function PuxarParaAtualizar() {
  const queryClient = useQueryClient();
  const [puxada, setPuxada] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  // os ouvintes ficam presos na janela; estes refs dão a eles o valor atual sem reinscrever a cada toque
  const inicio = useRef<number | null>(null);
  const distancia = useRef(0);
  const ocupado = useRef(false);

  useEffect(() => {
    const aoTocar = (e: TouchEvent) => {
      inicio.current =
        window.scrollY <= 0 && !ocupado.current ? (e.touches[0]?.clientY ?? null) : null;
      distancia.current = 0;
    };
    const aoMover = (e: TouchEvent) => {
      if (inicio.current === null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - inicio.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (distancia.current !== 0) setPuxada(0);
        distancia.current = 0;
        return;
      }
      // resistência: a bolinha anda menos que o dedo
      distancia.current = Math.min(MAXIMO, dy * 0.5);
      setPuxada(distancia.current);
    };
    const aoSoltar = async () => {
      const puxou = distancia.current;
      inicio.current = null;
      distancia.current = 0;
      if (puxou < LIMITE) {
        setPuxada(0);
        return;
      }
      ocupado.current = true;
      setAtualizando(true);
      setPuxada(LIMITE);
      vibrar(10);
      // meio segundo no mínimo: sumir na hora parece que nada aconteceu
      await Promise.all([
        queryClient.refetchQueries({ type: "active" }),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
      ocupado.current = false;
      setAtualizando(false);
      setPuxada(0);
    };

    window.addEventListener("touchstart", aoTocar, { passive: true });
    window.addEventListener("touchmove", aoMover, { passive: true });
    window.addEventListener("touchend", aoSoltar);
    window.addEventListener("touchcancel", aoSoltar);
    return () => {
      window.removeEventListener("touchstart", aoTocar);
      window.removeEventListener("touchmove", aoMover);
      window.removeEventListener("touchend", aoSoltar);
      window.removeEventListener("touchcancel", aoSoltar);
    };
  }, [queryClient]);

  if (puxada === 0 && !atualizando) return null;

  const pronto = puxada >= LIMITE;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{ transform: `translateY(${puxada - 28}px)`, opacity: Math.min(1, puxada / 40) }}
      role="status"
      aria-label={atualizando ? "Atualizando" : "Puxe para atualizar"}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-card shadow-[var(--shadow-float)]">
        <RefreshCw
          className={cn(
            "size-4",
            pronto ? "text-primary" : "text-muted-foreground",
            atualizando && "animate-spin",
          )}
          style={atualizando ? undefined : { transform: `rotate(${puxada * 3}deg)` }}
        />
      </span>
    </div>
  );
}
