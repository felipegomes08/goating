import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type TierConfig, avaliacoesFaltando } from "@/lib/tiers";

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
 * 2. composição ao vivo: foto atrás + molde PNG do tier por cima
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
}: {
  nome: string;
  posicao: string | null;
  overall: number;
  atributos: AtributosCard;
  fotoUrl: string | null;
  tier: TierConfig | null;
  cardGeradoUrl: string | null;
  avaliacoesRecebidas: number;
}) {
  const [moldeUrl, setMoldeUrl] = useState<string | null>(null);
  const [cacheUrl, setCacheUrl] = useState<string | null>(null);
  const bloqueado = avaliacoesFaltando(avaliacoesRecebidas) > 0;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      if (cardGeradoUrl) {
        const { data } = await supabase.storage
          .from("player-cards")
          .createSignedUrl(cardGeradoUrl, 3600);
        if (ativo) setCacheUrl(data?.signedUrl ?? null);
      }
      if (tier) {
        const { data } = await supabase.storage
          .from("card-moldes")
          .createSignedUrl(tier.molde, 3600);
        if (ativo) setMoldeUrl(data?.signedUrl ?? null);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [cardGeradoUrl, tier]);

  const cor = tier?.textClass ?? "text-mint";
  const offset = tier?.offsetY ?? 0;

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <div className="relative aspect-[1086/1448] overflow-hidden rounded-2xl bg-primary">
        {cacheUrl ? (
          <img src={cacheUrl} alt={`Cartinha de ${nome}`} className="size-full object-cover" />
        ) : (
          <>
            {fotoUrl && (
              <img
                src={fotoUrl}
                alt=""
                className="absolute inset-x-0 top-[14%] mx-auto h-[46%] object-contain"
              />
            )}
            {moldeUrl ? (
              <img src={moldeUrl} alt="" className="absolute inset-0 size-full object-contain" />
            ) : (
              <div className="absolute inset-0 rounded-2xl border-2 border-mint/30" />
            )}

            <div
              className="absolute top-[8%] left-[8%] text-center"
              style={{ transform: `translateY(${offset}px)` }}
            >
              <p className={cn("text-3xl leading-none font-extrabold", cor)}>{overall}</p>
              <p className={cn("text-[11px] font-bold tracking-widest", cor)}>{posicao ?? "—"}</p>
            </div>

            <p
              className={cn(
                "absolute inset-x-0 top-[62%] truncate px-6 text-center text-lg font-extrabold tracking-wide uppercase",
                cor,
              )}
              style={{ transform: `translateY(${offset}px)` }}
            >
              {nome}
            </p>

            <div
              className="absolute inset-x-0 bottom-[10%] grid grid-cols-5 gap-1 px-5"
              style={{ transform: `translateY(${offset}px)` }}
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
                  <p className={cn("text-base leading-none font-extrabold", cor)}>{valor}</p>
                  <p className={cn("text-[9px] font-semibold opacity-80", cor)}>{label}</p>
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
    </div>
  );
}
