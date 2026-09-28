import type { CSSProperties } from "react";
import type { TierConfig } from "@/lib/tiers";

/**
 * Fundo do topo do perfil: brilho, raios girando e partículas subindo na cor do tier.
 * Quanto maior o tier, mais partículas e mais forte o brilho.
 */
export function AuraTier({ tier }: { tier: TierConfig | null }) {
  const cor = tier?.cor ?? "var(--mint)";
  const ordem = tier?.ordem ?? 0;
  const quantidade = 6 + ordem * 3;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={
        {
          "--aura": cor,
          background: `radial-gradient(ellipse 80% 50% at 50% 45%, color-mix(in oklch, ${cor} ${32 + ordem * 7}%, transparent), transparent 72%), linear-gradient(180deg, oklch(0.2 0.045 163), var(--primary) 55%, oklch(0.24 0.05 163))`,
        } as CSSProperties
      }
    >
      <div className="aura-raios" style={{ opacity: 0.35 + ordem * 0.08 }} />
      {Array.from({ length: quantidade }, (_, i) => {
        // Posições "aleatórias" mas fixas por índice, pra não pular a cada render.
        const semente = (i * 9301 + 49297) % 233280;
        const aleatorio = semente / 233280;
        const tamanho = 3 + ((i * 7) % 4);
        return (
          <span
            key={i}
            className="aura-particula"
            style={{
              left: `${(i * 37 + aleatorio * 23) % 100}%`,
              bottom: `${(i * 13) % 45}%`,
              width: tamanho,
              height: tamanho,
              animationDuration: `${5 + ((i * 11) % 6)}s`,
              animationDelay: `-${(i * 0.7) % 6}s`,
            }}
          />
        );
      })}
    </div>
  );
}
