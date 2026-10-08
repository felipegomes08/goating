import { Link } from "@tanstack/react-router";
import { User, UserMinus, UserPlus } from "lucide-react";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { cn } from "@/lib/utils";
import { overallLiberado, tierPorNome } from "@/lib/tiers";
import { TierBadge } from "@/components/goating/tier-badge";

export type JogadorResumo = {
  id: string;
  nome_exibicao: string;
  handle?: string | null;
  cidade: string | null;
  foto_url: string | null;
  overall: number | string;
  peladas_jogadas: number;
  xp: number;
  tier_reconhecido: string | null;
  avaliacoes_recebidas: number;
  posicao_preferida?: string | null;
  vezes_mvp?: number;
};

type Props = {
  jogador: JogadorResumo;
  /** Número de posição (ranking). Quando presente, aparece à esquerda do avatar. */
  posicao?: number | undefined;
  /** Quando presente, mostra o botão de seguir/deixar de seguir à direita. */
  seguindo?: boolean | undefined;
  onAlternarSeguir?: (() => void) | undefined;
  ocupado?: boolean;
};

const COR_DO_PODIO = ["text-tier-ouro", "text-tier-prata", "text-tier-bronze"];

/** Linha de jogador usada na busca/comunidade, no ranking e nas listas de seguidores/seguindo. */
export function JogadorItem({ jogador, posicao, seguindo, onAlternarSeguir, ocupado }: Props) {
  const foto = useAvatarUrl(jogador.foto_url);
  const liberado = overallLiberado(jogador.avaliacoes_recebidas);
  const overall = liberado ? Math.round(Number(jogador.overall)) : null;
  const tier = liberado ? tierPorNome(jogador.tier_reconhecido) : null;

  // o que dá pra saber do jogador num relance: onde joga, quanto joga, quantas vezes foi o melhor
  const detalhes = [
    jogador.posicao_preferida,
    `${jogador.peladas_jogadas} ${jogador.peladas_jogadas === 1 ? "pelada" : "peladas"}`,
    jogador.vezes_mvp ? `${jogador.vezes_mvp} MVP` : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2.5 rounded-3xl bg-card p-3 shadow-[var(--shadow-card)]">
      {posicao != null && (
        <span
          className={cn(
            "w-6 shrink-0 text-center font-black tabular-nums",
            posicao <= 3 ? "text-lg" : "text-sm",
            COR_DO_PODIO[posicao - 1] ?? "text-muted-foreground",
          )}
        >
          {posicao}
        </span>
      )}

      <Link
        to="/jogador/$id"
        params={{ id: jogador.id }}
        className="flex min-w-0 flex-1 items-center gap-3 active:opacity-60"
      >
        {/* o contorno da foto leva a cor do tier do jogador */}
        <span
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-muted"
          style={{ borderColor: tier?.cor ?? "var(--border)" }}
        >
          {foto ? (
            <img src={foto} alt="" className="size-full object-cover" />
          ) : (
            <User className="size-5 text-muted-foreground" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-foreground">
            {jogador.nome_exibicao}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[jogador.handle ? `@${jogador.handle}` : null, jogador.cidade]
              .filter(Boolean)
              .join(" · ") || "Cidade não informada"}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-foreground/70">
            {detalhes.join(" · ")}
          </span>
        </span>

        {/* a cartinha do tier com o overall dentro; sem nota liberada, um traço */}
        <span className="flex w-12 shrink-0 flex-col items-center">
          {tier && overall !== null ? (
            <>
              <TierBadge tier={tier} overall={overall} size={42} />
              <span className="mt-0.5 text-[9px] font-extrabold text-muted-foreground uppercase">
                {tier.nome}
              </span>
            </>
          ) : (
            <>
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-secondary text-lg font-black text-muted-foreground tabular-nums">
                {overall ?? "—"}
              </span>
              <span className="mt-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                {overall === null ? "sem nota" : "overall"}
              </span>
            </>
          )}
        </span>
      </Link>

      {onAlternarSeguir && (
        <button
          type="button"
          disabled={ocupado}
          onClick={onAlternarSeguir}
          aria-label={
            seguindo
              ? `Deixar de seguir ${jogador.nome_exibicao}`
              : `Seguir ${jogador.nome_exibicao}`
          }
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
            seguindo ? "bg-mint-soft text-primary" : "bg-mint text-mint-foreground",
          )}
        >
          {seguindo ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}
        </button>
      )}
    </div>
  );
}
