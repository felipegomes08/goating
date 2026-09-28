import type { CSSProperties } from "react";
import { Check, Gift, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MIN_AVALIACOES,
  TIERS,
  type TierConfig,
  XP_POR_PELADA_MEDIA,
  tierSeguinte,
} from "@/lib/tiers";

/**
 * Trilha dos 6 tiers + missões pro próximo degrau.
 * O ponto de partida é sempre o tier reconhecido (já revelado).
 */
export function ProgressoTier({
  tier,
  overall,
  xp,
  avaliacoes,
  recompensaPendente,
}: {
  tier: TierConfig | null;
  overall: number;
  xp: number;
  avaliacoes: number;
  recompensaPendente: boolean;
}) {
  const ordemAtual = tier?.ordem ?? 0;
  const proximo = tierSeguinte(tier);
  const cor = proximo?.destaque ?? tier?.destaque ?? "var(--mint)";

  const xpBase = tier?.xpMinimo ?? 0;
  const progresso = proximo
    ? Math.min(100, Math.max(0, ((xp - xpBase) / (proximo.xpMinimo - xpBase)) * 100))
    : 100;
  const xpFaltando = proximo ? Math.max(0, proximo.xpMinimo - xp) : 0;
  const peladasFaltando = Math.ceil(xpFaltando / XP_POR_PELADA_MEDIA);

  const missoes = proximo
    ? [
        ...(avaliacoes < MIN_AVALIACOES
          ? [
              {
                texto: `Receber ${MIN_AVALIACOES} avaliações`,
                detalhe: `${avaliacoes}/${MIN_AVALIACOES}`,
                ok: false,
              },
            ]
          : []),
        // Bronze não exige overall — não faz sentido mostrar "Overall 0+".
        ...(proximo.overallMinimo > 0
          ? [
              {
                texto: `Overall ${proximo.overallMinimo}+`,
                detalhe: `${Math.round(overall)}/${proximo.overallMinimo}`,
                ok: overall >= proximo.overallMinimo,
              },
            ]
          : []),
        {
          texto: `${proximo.xpMinimo.toLocaleString("pt-BR")} XP`,
          detalhe:
            xpFaltando > 0
              ? `faltam ${xpFaltando.toLocaleString("pt-BR")} (~${peladasFaltando} ${peladasFaltando === 1 ? "pelada" : "peladas"})`
              : "feito",
          ok: xpFaltando === 0,
        },
      ]
    : [];

  return (
    <section
      className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
      style={{ "--aura": cor } as CSSProperties}
    >
      {/* Trilha */}
      <div className="relative flex items-start justify-between">
        <div className="absolute inset-x-5 top-5 h-1 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute left-5 top-5 h-1 -translate-y-1/2 rounded-full transition-all duration-700"
          style={{
            width: `calc((100% - 2.5rem) * ${Math.max(0, ordemAtual - 1) / (TIERS.length - 1)})`,
            background: tier?.destaque ?? "transparent",
          }}
        />
        {TIERS.map((t) => {
          const conquistado = t.ordem <= ordemAtual;
          const atual = t.ordem === ordemAtual;
          return (
            <div key={t.nome} className="relative flex flex-col items-center gap-1">
              <div
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full bg-card ring-2",
                  atual && "animate-tier-pulso",
                )}
                style={
                  {
                    "--aura": t.destaque,
                    "--tw-ring-color": conquistado ? t.destaque : "var(--border)",
                  } as CSSProperties
                }
              >
                <img
                  src={t.icone}
                  alt=""
                  className={cn("size-7 object-contain", !conquistado && "opacity-30 grayscale")}
                />
                {!conquistado && (
                  <Lock className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-card p-0.5 text-muted-foreground" />
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] font-bold uppercase",
                  conquistado ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t.nome}
              </span>
            </div>
          );
        })}
      </div>

      {recompensaPendente ? (
        <div className="flex items-center gap-3 rounded-xl bg-mint-soft p-3">
          <Gift className="size-6 shrink-0 text-primary" />
          <p className="text-xs font-semibold text-primary">
            Você subiu de tier! Toque no presente da sua carta pra revelar.
          </p>
        </div>
      ) : proximo ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">
                Rumo ao <span style={{ color: proximo.destaque }}>{proximo.nome}</span>
              </p>
              <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                {xp.toLocaleString("pt-BR")} / {proximo.xpMinimo.toLocaleString("pt-BR")} XP
              </p>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="relative h-full overflow-hidden rounded-full transition-[width] duration-1000 ease-out"
                style={{
                  width: `${progresso}%`,
                  background: `linear-gradient(90deg, color-mix(in oklch, ${cor} 70%, black), ${cor})`,
                }}
              >
                <div className="xp-brilho absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {missoes.map((m) => (
              <li key={m.texto} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    m.ok ? "bg-mint text-mint-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {m.ok ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    <Lock className="size-3" />
                  )}
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    m.ok ? "text-muted-foreground line-through" : "font-semibold text-foreground",
                  )}
                >
                  {m.texto}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{m.detalhe}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-center text-sm font-bold text-foreground">
          Você chegou no topo. <span style={{ color: tier?.destaque }}>GOAT</span> 🐐
        </p>
      )}
    </section>
  );
}
