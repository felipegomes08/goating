import { Link } from "@tanstack/react-router";
import { User, UserMinus, UserPlus } from "lucide-react";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { cn } from "@/lib/utils";
import { overallLiberado, tierPorNome } from "@/lib/tiers";

export type JogadorResumo = {
  id: string;
  nome_exibicao: string;
  cidade: string | null;
  foto_url: string | null;
  overall: number | string;
  peladas_jogadas: number;
  xp: number;
  tier_reconhecido: string | null;
  avaliacoes_recebidas: number;
};

type Props = {
  jogador: JogadorResumo;
  /** Número de posição (ranking). Quando presente, aparece à esquerda do avatar. */
  posicao?: number;
  /** Quando presente, mostra o botão de seguir/deixar de seguir à direita. */
  seguindo?: boolean;
  onAlternarSeguir?: () => void;
  ocupado?: boolean;
};

/** Linha de jogador usada na busca/comunidade, no ranking e nas listas de seguidores/seguindo. */
export function JogadorItem({ jogador, posicao, seguindo, onAlternarSeguir, ocupado }: Props) {
  const foto = useAvatarUrl(jogador.foto_url);
  const liberado = overallLiberado(jogador.avaliacoes_recebidas);
  const overall = liberado ? Math.round(Number(jogador.overall)) : null;
  const tier = liberado ? tierPorNome(jogador.tier_reconhecido) : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      {posicao != null && (
        <span
          className={cn(
            "w-5 shrink-0 text-center text-sm font-extrabold",
            posicao === 1
              ? "text-tier-ouro"
              : posicao === 2
                ? "text-muted-foreground"
                : posicao === 3
                  ? "text-tier-bronze"
                  : "text-muted-foreground",
          )}
        >
          {posicao}
        </span>
      )}

      <Link
        to="/jogador/$id"
        params={{ id: jogador.id }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {foto ? (
            <img src={foto} alt="" className="size-full object-cover" />
          ) : (
            <User className="size-5 text-muted-foreground" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">
            {jogador.nome_exibicao}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {jogador.cidade ?? "Cidade não informada"}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {tier && (
            <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", tier.chipClass)}>
              {tier.nome}
            </span>
          )}
          <span className="text-lg font-extrabold text-foreground">{overall ?? "—"}</span>
        </span>
      </Link>

      {onAlternarSeguir && (
        <button
          type="button"
          disabled={ocupado}
          onClick={onAlternarSeguir}
          aria-label={seguindo ? `Deixar de seguir ${jogador.nome_exibicao}` : `Seguir ${jogador.nome_exibicao}`}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors",
            seguindo ? "bg-mint/15 text-mint" : "bg-mint text-mint-foreground",
          )}
        >
          {seguindo ? <UserMinus className="size-3.5" /> : <UserPlus className="size-3.5" />}
          {seguindo ? "Seguindo" : "Seguir"}
        </button>
      )}
    </div>
  );
}
