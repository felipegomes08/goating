import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Lock, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FolhaPremium } from "@/components/goating/cadeado";
import { CONQUISTAS, type Conquista } from "@/lib/conquistas";
import { cn } from "@/lib/utils";

/** Quantas medalhas aparecem antes do "Ver todas". */
const MOSTRAR = 8;

type Item = Conquista & { ganha_em: string | null; valor: number; meta: number };

/**
 * Vitrine de conquistas do perfil. No próprio perfil: as ganhas primeiro, depois as que faltam
 * em cinza com o progresso. No perfil de outra pessoa: só as que ela ganhou. Quem é Premium
 * tem as medalhas douradas e brilhando; as exclusivas do Premium levam pra tela do Premium.
 */
export function ConquistasDoJogador({
  userId,
  proprio,
  premiumDono,
}: {
  userId: string;
  proprio: boolean;
  /** o dono do perfil é Premium (as medalhas dele brilham) */
  premiumDono: boolean;
}) {
  const [todas, setTodas] = useState(false);
  const [aberta, setAberta] = useState<Item | null>(null);
  const [convite, setConvite] = useState(false);

  const { data: itens = [] } = useQuery({
    queryKey: ["conquistas", userId, proprio],
    queryFn: async (): Promise<Item[]> => {
      const [ganhasRes, progressoRes] = await Promise.all([
        supabase.from("conquistas").select("codigo, ganha_em").eq("user_id", userId),
        proprio
          ? supabase.rpc("progresso_das_conquistas", { p_user: userId })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (ganhasRes.error) throw ganhasRes.error;
      const ganhas = new Map(ganhasRes.data.map((g) => [g.codigo, g.ganha_em]));
      const progresso = new Map(
        (progressoRes.data ?? []).map((p) => [p.codigo, { valor: p.valor, meta: p.meta }]),
      );
      return CONQUISTAS.map((c) => ({
        ...c,
        ganha_em: ganhas.get(c.codigo) ?? null,
        valor: progresso.get(c.codigo)?.valor ?? 0,
        meta: progresso.get(c.codigo)?.meta ?? 1,
      }))
        .filter((c) => proprio || c.ganha_em)
        .sort((a, b) => {
          // ganhas primeiro (as mais recentes antes); depois as mais perto de completar
          if (a.ganha_em && b.ganha_em) return b.ganha_em.localeCompare(a.ganha_em);
          if (a.ganha_em) return -1;
          if (b.ganha_em) return 1;
          return b.valor / b.meta - a.valor / a.meta;
        });
    },
  });

  const ganhas = itens.filter((i) => i.ganha_em).length;
  if (!proprio && ganhas === 0) return null;
  const visiveis = todas ? itens : itens.slice(0, MOSTRAR);

  return (
    <section
      id="conquistas"
      className="scroll-mt-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Medal className="size-4 text-tier-ouro" />
        Conquistas ({ganhas}/{proprio ? CONQUISTAS.length : ganhas})
      </h2>

      <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">
        {visiveis.map((c) => {
          const ganha = !!c.ganha_em;
          const trancada = !!c.premium && !premiumDono && !ganha;
          return (
            <li key={c.codigo}>
              <button
                type="button"
                onClick={() => (trancada ? setConvite(true) : setAberta(c))}
                className="flex w-full flex-col items-center gap-1 text-center"
              >
                <span
                  className={cn(
                    "relative flex size-14 items-center justify-center overflow-hidden rounded-full",
                    ganha ? "shadow-md" : "bg-secondary",
                    ganha && premiumDono && "medalha-premium",
                  )}
                  style={
                    ganha
                      ? {
                          background: premiumDono
                            ? "linear-gradient(135deg, #FFF3B0, #E9B93A 45%, #8A6A12)"
                            : `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${c.cor} 55%, white), ${c.cor})`,
                        }
                      : undefined
                  }
                >
                  {trancada ? (
                    <Lock className="size-5 text-tier-ouro" />
                  ) : (
                    <c.icone
                      className={cn(
                        "size-6",
                        ganha
                          ? premiumDono
                            ? "text-[#3A2A05]"
                            : "text-white"
                          : "text-muted-foreground/50",
                      )}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "line-clamp-2 text-[10px] leading-tight font-semibold",
                    ganha ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {c.nome}
                </span>
                {proprio && !ganha && !c.premium && (
                  <span className="h-1 w-10 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-1 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (c.valor / c.meta) * 100)}%` }}
                    />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {itens.length > MOSTRAR && (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-bold text-primary"
        >
          {todas ? "Mostrar menos" : `Ver todas as ${itens.length}`}
          <ChevronDown className={cn("size-3.5 transition-transform", todas && "rotate-180")} />
        </button>
      )}

      {aberta && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAberta(null);
          }}
        >
          <div
            role="dialog"
            aria-label={aberta.nome}
            className="w-full max-w-[480px] space-y-2 rounded-t-3xl bg-card p-5 pb-7 text-center"
          >
            <aberta.icone className="mx-auto size-10" style={{ color: aberta.cor }} />
            <h3 className="text-lg font-extrabold text-foreground">{aberta.nome}</h3>
            <p className="text-sm text-muted-foreground">{aberta.descricao}</p>
            {aberta.ganha_em ? (
              <p className="text-xs font-semibold text-primary">
                Conquistada em{" "}
                {new Date(aberta.ganha_em).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            ) : (
              proprio &&
              aberta.unidade && (
                <p className="text-xs font-semibold text-foreground">
                  {Math.min(aberta.valor, aberta.meta)}/{aberta.meta} {aberta.unidade}
                </p>
              )
            )}
          </div>
        </div>
      )}
      {convite && <FolhaPremium recurso="Medalhas exclusivas" onFechar={() => setConvite(false)} />}
    </section>
  );
}
