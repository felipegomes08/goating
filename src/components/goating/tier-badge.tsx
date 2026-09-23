import { cn } from "@/lib/utils";
import type { TierConfig } from "@/lib/tiers";

/**
 * Iconezinho da cartinha do tier, com o overall escrito dentro.
 * Usado na frente do nome do jogador pra reconhecer o card dele de cara
 * (ranking, seguir, confirmados da pelada, organizador no feed).
 * Sem tier (jogador ainda não liberou overall) → não renderiza nada.
 */
export function TierBadge({
  tier,
  overall,
  size = 20,
  className,
}: {
  tier: TierConfig | null;
  overall: number | string | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!tier || overall == null) return null;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <img src={tier.icone} alt={tier.nome} className="size-full object-contain" />
      <span
        className="absolute inset-0 flex items-center justify-center font-extrabold text-white"
        style={{
          fontSize: Math.max(8, Math.round(size * 0.4)),
          WebkitTextStroke: "1px rgba(0,0,0,0.65)",
          paintOrder: "stroke fill",
        }}
      >
        {Math.round(Number(overall))}
      </span>
    </span>
  );
}
