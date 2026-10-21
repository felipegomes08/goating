import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { TierBadge } from "@/components/goating/tier-badge";
import { SeloPremium } from "@/components/goating/selo-premium";
import type { JogadorResumo } from "@/components/goating/jogador-item";
import { ehPremium } from "@/lib/premium";
import { TIERS, overallLiberado, tierPorNome } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const MEDALHA = [
  { cor: "var(--tier-ouro)", altura: "h-24", foto: "size-20" },
  { cor: "var(--tier-prata)", altura: "h-16", foto: "size-16" },
  { cor: "var(--tier-bronze)", altura: "h-12", foto: "size-16" },
];

/** Pódio do ranking: 2º, 1º e 3º lado a lado, o primeiro maior e mais alto. */
export function PodioDoRanking({
  jogadores,
  userId,
}: {
  jogadores: JogadorResumo[];
  userId: string | null;
}) {
  const [primeiro, segundo, terceiro] = jogadores;
  // ordem na tela: 2º à esquerda, 1º no meio, 3º à direita
  const lugares = [
    segundo ? { jogador: segundo, posicao: 2 } : null,
    primeiro ? { jogador: primeiro, posicao: 1 } : null,
    terceiro ? { jogador: terceiro, posicao: 3 } : null,
  ];

  return (
    <div className="flex items-end gap-2 rounded-3xl bg-primary px-3 pt-5 shadow-[var(--shadow-card)]">
      {lugares.map((l, i) =>
        l ? (
          <Lugar key={l.jogador.id} {...l} eu={l.jogador.id === userId} />
        ) : (
          <div key={i} className="flex-1" />
        ),
      )}
    </div>
  );
}

function Lugar({ jogador, posicao, eu }: { jogador: JogadorResumo; posicao: number; eu: boolean }) {
  const foto = useAvatarUrl(jogador.foto_url);
  const medalha = MEDALHA[posicao - 1]!;
  const liberado = overallLiberado(jogador.avaliacoes_recebidas);
  const tier = liberado ? tierPorNome(jogador.tier_reconhecido) : null;
  const overall = liberado ? Math.round(Number(jogador.overall)) : null;

  return (
    <Link
      to="/jogador/$id"
      params={{ id: jogador.id }}
      className="flex min-w-0 flex-1 flex-col items-center active:opacity-70"
    >
      <span className="relative">
        <span
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-full border-4 bg-muted",
            medalha.foto,
          )}
          style={{
            borderColor: medalha.cor,
            boxShadow: posicao === 1 ? `0 0 24px ${medalha.cor}` : undefined,
          }}
        >
          {foto ? (
            <img src={foto} alt="" className="size-full object-cover" />
          ) : (
            <User className="size-7 text-muted-foreground" />
          )}
        </span>
        <span
          className="absolute -bottom-2 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full text-sm font-black text-primary"
          style={{ background: medalha.cor }}
        >
          {posicao}
        </span>
      </span>
      <span className="mt-3 flex w-full min-w-0 items-center justify-center gap-1">
        <span
          className={cn(
            "truncate text-xs text-primary-foreground",
            eu ? "font-black" : "font-bold",
          )}
        >
          {jogador.nome_exibicao}
        </span>
        {ehPremium(jogador) && <SeloPremium className="size-3" />}
      </span>
      <span className="mt-1 mb-2">
        <TierBadge tier={tier ?? TIERS[0]!} overall={overall} size={30} />
      </span>
      <span
        className={cn("w-full rounded-t-xl", medalha.altura)}
        style={{
          background: `linear-gradient(180deg, color-mix(in oklch, ${medalha.cor} 55%, transparent), color-mix(in oklch, ${medalha.cor} 12%, transparent))`,
        }}
      />
    </Link>
  );
}
