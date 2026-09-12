import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { cn } from "@/lib/utils";
import { overallLiberado, tierDoJogador } from "@/lib/tiers";

export type JogadorResumo = {
  id: string;
  nome_exibicao: string;
  cidade: string | null;
  foto_url: string | null;
  overall: number | string;
  peladas_jogadas: number;
  avaliacoes_recebidas: number;
};

/** Linha de jogador usada na busca e nas listas de seguidores/seguindo. */
export function JogadorItem({ jogador }: { jogador: JogadorResumo }) {
  const foto = useAvatarUrl(jogador.foto_url);
  const liberado = overallLiberado(jogador.avaliacoes_recebidas);
  const overall = liberado ? Math.round(Number(jogador.overall)) : null;
  const tier = liberado ? tierDoJogador(Number(jogador.overall), jogador.peladas_jogadas) : null;

  return (
    <Link
      to="/jogador/$id"
      params={{ id: jogador.id }}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]"
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
  );
}
