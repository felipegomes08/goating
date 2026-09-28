import { type CSSProperties, useEffect, useState } from "react";
import { Gift, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type CaixaCarta, type TierConfig, TIERS, avaliacoesFaltando } from "@/lib/tiers";

/** Posiciona um elemento numa área do molde (em %), com folga opcional em cada lado. */
function caixa({ x, y, w, h }: CaixaCarta, folga = 0): CSSProperties {
  return {
    left: `${x - folga}%`,
    top: `${y - folga}%`,
    width: `${w + folga * 2}%`,
    height: `${h + folga * 2}%`,
  };
}

export type AtributosCard = {
  chute: number;
  drible: number;
  velocidade: number;
  toque: number;
  posicionamento: number;
};

/**
 * Renderiza a cartinha. Prioridade:
 * 1. imagem já composta e salva no Storage (users.card_gerado_url) — cache
 * 2. composição ao vivo: foto atrás + molde do tier por cima + textos nas áreas do layout
 */
export function PlayerCard({
  nome,
  posicao,
  overall,
  atributos,
  fotoUrl,
  tier,
  cardGeradoUrl,
  avaliacoesRecebidas,
  recompensaPendente = false,
  abrindo = false,
  revelando = false,
  onRevelar,
}: {
  nome: string;
  posicao: string | null;
  overall: number;
  atributos: AtributosCard;
  fotoUrl: string | null;
  tier: TierConfig | null;
  cardGeradoUrl: string | null;
  avaliacoesRecebidas: number;
  /** Existe um tier novo esperando ser revelado — a carta atual (tier antigo) fica escondida atrás de um presente. */
  recompensaPendente?: boolean;
  /** true logo após o clique, durante a suspense antes da carta nova aparecer (presente "tremendo"). */
  abrindo?: boolean;
  /** true durante a animação de revelação da carta nova. */
  revelando?: boolean;
  onRevelar?: () => void;
}) {
  const [cacheUrl, setCacheUrl] = useState<string | null>(null);
  const bloqueado = avaliacoesFaltando(avaliacoesRecebidas) > 0;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      if (!cardGeradoUrl) return;
      const { data } = await supabase.storage
        .from("player-cards")
        .createSignedUrl(cardGeradoUrl, 3600);
      if (ativo) setCacheUrl(data?.signedUrl ?? null);
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [cardGeradoUrl]);

  // Sem tier ainda (jogador novo) a carta usa o visual do Bronze, o primeiro degrau.
  const visual = tier ?? TIERS[0]!;
  const { hex, escudo, nome: faixaNome, atrib } = visual.layout;
  const cor = visual.textClass;

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[280px]",
        revelando && "animate-goat-reveal",
      )}
    >
      {/* @container: os textos usam cqw pra escalar junto com a largura da carta */}
      <div className="@container relative aspect-[1086/1448] overflow-hidden rounded-2xl">
        {cacheUrl ? (
          <img src={cacheUrl} alt={`Cartinha de ${nome}`} className="size-full object-cover" />
        ) : (
          <>
            {/* Foto atrás do molde: o escudo vazado do PNG faz a máscara. Sobra 1% de cada lado pra não vazar fresta. */}
            <div
              className="absolute flex items-center justify-center bg-primary"
              style={caixa(escudo, 1)}
            >
              {fotoUrl ? (
                <img src={fotoUrl} alt="" className="size-full object-cover object-top" />
              ) : (
                <User className="size-1/2 text-mint/40" strokeWidth={1.5} />
              )}
            </div>

            <img
              src={visual.molde}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full select-none"
            />

            <div
              className="absolute flex flex-col items-center justify-center"
              style={caixa(hex)}
            >
              <p
                className={cn("leading-none font-extrabold tabular-nums", cor)}
                style={{ fontSize: "10cqw" }}
              >
                {Math.round(overall)}
              </p>
              <p
                className={cn("mt-[0.6cqw] font-bold tracking-widest", cor)}
                style={{ fontSize: "3.6cqw" }}
              >
                {posicao ?? "—"}
              </p>
            </div>

            <div className="absolute flex items-center justify-center" style={caixa(faixaNome)}>
              <p
                className={cn("truncate px-[3cqw] font-extrabold tracking-wide uppercase", cor)}
                style={{ fontSize: "5.2cqw" }}
              >
                {nome}
              </p>
            </div>

            <div
              className="absolute grid grid-cols-5 items-center px-[2cqw]"
              style={caixa(atrib)}
            >
              {(
                [
                  ["CHU", atributos.chute],
                  ["DRI", atributos.drible],
                  ["VEL", atributos.velocidade],
                  ["TOQ", atributos.toque],
                  ["POS", atributos.posicionamento],
                ] as const
              ).map(([label, valor]) => (
                <div key={label} className="text-center">
                  <p
                    className={cn("leading-none font-extrabold tabular-nums", cor)}
                    style={{ fontSize: "6.4cqw" }}
                  >
                    {valor}
                  </p>
                  <p
                    className={cn("mt-[1cqw] font-semibold tracking-wider opacity-80", cor)}
                    style={{ fontSize: "3cqw" }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {bloqueado && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary/90 px-6 text-center">
          <Lock className="size-6 text-mint" />
          <p className="text-sm font-semibold text-primary-foreground">Cartinha bloqueada</p>
          <p className="text-xs text-mint">
            Faltam {avaliacoesFaltando(avaliacoesRecebidas)} avaliações pós-pelada para liberar seu
            overall e tier.
          </p>
        </div>
      )}

      {!bloqueado && recompensaPendente && !revelando && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary/95 px-6 text-center">
          <Gift className={cn("size-8 text-mint", abrindo && "animate-gift-shake")} />
          {abrindo ? (
            <p className="text-sm font-bold text-primary-foreground">Abrindo...</p>
          ) : (
            <>
              <p className="text-sm font-bold text-primary-foreground">Recompensa disponível!</p>
              <button
                type="button"
                onClick={onRevelar}
                className="rounded-full bg-mint px-4 py-2 text-xs font-bold text-mint-foreground"
              >
                Toque pra revelar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
